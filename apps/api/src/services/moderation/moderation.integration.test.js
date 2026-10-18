import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Opt in with ADMIN_USERS_TEST_DATABASE_URL pointing to an already migrated local test database.
// Run with node --import tsx --experimental-test-module-mocks --test moderation.integration.test.js.
const databaseUrl = process.env.ADMIN_USERS_TEST_DATABASE_URL;
if (databaseUrl) {
    const url = new URL(databaseUrl);
    if (!["postgresql:", "postgres:"].includes(url.protocol)
        || !["127.0.0.1", "localhost"].includes(url.hostname)
        || url.pathname !== "/zerocat_admin_test" || url.search) {
        throw new Error("Integration tests require a local, dedicated zerocat_admin_test database");
    }
    process.env.DATABASE_URL = databaseUrl;
    process.env.DOTENV_CONFIG_PATH = new URL("./missing-integration.env", import.meta.url).pathname;
    // Database semantics stay real; background publishing and shared cache services stay offline.
    mock.module(new URL("../redis.js", import.meta.url).href, { defaultExport: {
        async set() { return true; }, async get() { return null; }, async del() { return true; },
    } });
    mock.module(new URL("../queue/queueManager.js", import.meta.url).href, { defaultExport: {
        async enqueueSocialPostSync() {}, async enqueueProjectGorseSync() {}, async enqueueBlogSyncRemove() {},
    } });
    mock.module(new URL("../gorse.js", import.meta.url).href, { defaultExport: { async hidePost() {} } });
}

// Dynamic imports happen only after validating and selecting the isolated database.
test("PostgreSQL moderation and authorization regression", { skip: !databaseUrl }, async (t) => {
    const { prisma: db } = await import("../prisma.js");
    const { Prisma } = await import("../../../generated/prisma/client.ts");
    const { visibleWhere, visibleSql, canViewContent } = await import("./visibility.js");
    const { assertCanWrite, createRestriction, revokeRestriction } = await import("./restrictions.js");
    const { softDeleteContent, restoreContent, setContentShadowban } = await import("./lifecycle.js");
    const { getUserPolicy, policyAllowsScope, resourcePolicyAllowsScope } = await import("../auth/policyEngine.js");
    const users = [92001, 92002, 92003, 92004];
    const projects = [];
    const posts = [];
    const roles = [];
    const commitId = "moderation-integration-preserved-commit";
    const actor = users[0], owner = users[1], other = users[2], viewer = users[3];
    const createProject = async (data) => {
        const row = await db.ow_projects.create({ data: { authorid: owner, name: "moderation-integration", state: "public", ...data } });
        projects.push(row.id);
        return row;
    };
    const createPost = async (data) => {
        const row = await db.ow_posts.create({ data: { author_id: owner, content: "moderation integration", ...data } });
        posts.push(row.id);
        return row;
    };
    const createRole = async (key, scopes) => {
        const role = await db.ow_roles.create({ data: { key: `moderation_integration_${key}`, name: key,
            permissions: { create: scopes.map((scope) => ({ scope })) } } });
        roles.push(role.id);
        return role;
    };
    const parity = async (kind, ids, userId, options = {}) => {
        const table = kind === "post" ? "ow_posts" : "ow_projects";
        const where = { AND: [{ id: { in: ids } }, await visibleWhere(kind, userId, { db, ...options })] };
        const rows = await db[table].findMany({ where, orderBy: { id: "asc" } });
        const predicate = await visibleSql(kind, "v", userId, { db, ...options });
        const sqlRows = await db.$queryRaw(Prisma.sql`SELECT v.* FROM ${Prisma.raw(`"${table}"`)} v
            WHERE v."id" IN (${Prisma.join(ids)}) AND ${predicate} ORDER BY v."id"`);
        const actual = rows.map((row) => row.id);
        assert.deepEqual(sqlRows.map((row) => row.id), actual, `${kind} SQL and Prisma disagree for viewer ${userId}`);
        for (const row of await db[table].findMany({ where: { id: { in: ids } } })) {
            assert.equal(await canViewContent(kind, row, userId, { db, ...options }), actual.includes(row.id),
                `${kind} detail and listing disagree for ${row.id}, viewer ${userId}`);
        }
        assert.equal(await db[table].count({ where }), actual.length);
        assert.deepEqual((await db[table].findMany({ where, orderBy: { id: "asc" }, skip: 1, take: 2 })).map((row) => row.id), actual.slice(1, 3));
        return actual;
    };
    t.beforeEach(async () => {
        await db.ow_user_restrictions.deleteMany({ where: { user_id: { in: users } } });
    });
    try {
        await db.ow_users.createMany({ data: users.map((id) => ({ id, username: `moderation-integration-${id}`, status: "active" })) });
        const moderator = await createRole("moderator", ["admin:content:manage", "admin:restrictions:manage"]);
        const authorRole = await createRole("author", ["post:delete", "project:delete"]);
        await db.ow_user_roles.createMany({ data: [
            { user_id: actor, role_id: moderator.id }, { user_id: owner, role_id: authorRole.id },
        ] });

        await t.test("Prisma, parameterized SQL, detail, pagination and counts share visibility", async () => {
            const clean = await createPost({ author_id: other });
            const hidden = await createPost({ is_shadowbanned: true });
            const expired = await createPost({ author_id: other, is_shadowbanned: true, shadowban_expires_at: new Date(Date.now() - 1000) });
            const deleted = await createPost({ author_id: other, is_deleted: true, deleted_at: new Date() });
            const retweet = await createPost({ author_id: other, post_type: "retweet", retweet_post_id: hidden.id, content: null });
            const visibleRetweet = await createPost({ author_id: other, post_type: "retweet", retweet_post_id: clean.id, content: null });
            const chain = await createPost({ author_id: other, post_type: "retweet", retweet_post_id: visibleRetweet.id, content: null });
            const article = await createProject({ type: "article" });
            const ordinary = await createProject({ type: "scratch" });
            const privateProject = await createProject({ state: "private", authorid: other });
            const hiddenProject = await createProject({ is_shadowbanned: true });
            const deletedProject = await createProject({ deleted_at: new Date() });
            const nullableProject = await createProject({ authorid: null, type: null });
            const rule = await db.ow_user_restrictions.create({ data: { user_id: owner, type: "shadowban", categories: ["posts", "blog"], created_by: actor } });
            await db.ow_user_restrictions.createMany({ data: [
                { user_id: other, type: "shadowban", categories: ["*"], starts_at: new Date(Date.now() - 2000), expires_at: new Date(Date.now() - 1000) },
                { user_id: other, type: "shadowban", categories: ["*"], starts_at: new Date(Date.now() + 60000) },
                { user_id: other, type: "shadowban", categories: ["*"], revoked_at: new Date() },
            ] });
            const resourceRole = await createRole("reader", ["project:read"]);
            await db.ow_user_roles.create({ data: { user_id: viewer, role_id: resourceRole.id, target_type: "project", target_id: String(privateProject.id) } });
            const postIds = [clean, hidden, expired, deleted, retweet, visibleRetweet, chain].map((row) => row.id);
            const projectIds = [article, ordinary, privateProject, hiddenProject, deletedProject, nullableProject].map((row) => row.id);
            for (const currentViewer of [null, owner, viewer, actor]) {
                await parity("post", postIds, currentViewer);
                await parity("project", projectIds, currentViewer);
            }
            assert.deepEqual(await parity("post", postIds, null), [clean.id, expired.id, visibleRetweet.id]);
            assert.ok((await parity("post", postIds, owner)).includes(retweet.id));
            assert.deepEqual(await parity("project", projectIds, null), [ordinary.id, nullableProject.id]);
            assert.ok((await parity("project", projectIds, viewer)).includes(privateProject.id));
            assert.equal((await parity("project", projectIds, actor)).includes(hiddenProject.id), false);
            assert.deepEqual(await parity("project", projectIds, actor, { review: true, reviewAuthorized: true }), projectIds);
            await db.ow_user_restrictions.update({ where: { id: rule.id }, data: { categories: ["*"] } });
            assert.equal((await parity("project", projectIds, null)).includes(ordinary.id), false);
            await db.ow_user_restrictions.deleteMany({ where: { user_id: { in: users } } });
        });

        await t.test("every visibility kind generates executable Prisma and SQL under an account shadowban", async () => {
            await db.ow_user_restrictions.create({ data: {
                user_id: owner, type: "shadowban", categories: ["*"], created_by: actor,
            } });
            const tables = {
                profile: "ow_users", comment: "ow_comment", comment_service: "ow_comment_service",
                list: "ow_projects_lists", activity: "ow_events", relation: "ow_user_relationships",
                asset: "ow_assets", extension: "ow_scratch_extensions",
            };
            for (const [kind, table] of Object.entries(tables)) {
                const rows = await db[table].findMany({ where: await visibleWhere(kind, null, { db }),
                    select: { id: true }, orderBy: { id: "asc" }, take: 1 });
                const predicate = await visibleSql(kind, "v", null, { db });
                const sqlRows = await db.$queryRaw(Prisma.sql`SELECT v."id" FROM ${Prisma.raw(`"${table}"`)} v
                    WHERE ${predicate} ORDER BY v."id" LIMIT 1`);
                assert.deepEqual(sqlRows, rows, `${kind} SQL and Prisma disagree`);
            }
        });

        await t.test("recursive role SQL keeps resource grants bounded and explicit deny live", async () => {
            const parent = await createRole("parent", ["project:read", "project:update"]);
            const child = await createRole("child", []);
            const root = await createRole("root", []);
            await db.ow_role_inheritance.createMany({ data: [
                { role_id: root.id, parent_role_id: child.id }, { role_id: child.id, parent_role_id: parent.id },
            ] });
            const resource = await createProject({ state: "private" });
            await db.ow_user_roles.create({ data: { user_id: viewer, role_id: root.id, target_type: "project", target_id: String(resource.id) } });
            const scoped = await getUserPolicy(viewer, { db, targetType: "project", targetId: String(resource.id) });
            assert.equal(scoped.valid, true);
            assert.equal(resourcePolicyAllowsScope(scoped, `project:${resource.id}:update`), true);
            assert.equal(policyAllowsScope(await getUserPolicy(viewer, { db }), "project:update"), false);
            await db.ow_user_permissions.create({ data: { user_id: viewer, scope: "project:update", effect: "deny", target_type: "project", target_id: String(resource.id) } });
            assert.equal(policyAllowsScope(await getUserPolicy(viewer, { db, targetType: "project", targetId: String(resource.id) }), `project:${resource.id}:update`), false);
            await db.ow_user_permissions.create({ data: { user_id: viewer, scope: "post:create", expires_at: new Date(Date.now() - 1000) } });
            assert.equal(policyAllowsScope(await getUserPolicy(viewer, { db }), "post:create"), false);
        });

        await t.test("delegation acceptance and live participant authority stay bounded to the original resource", async () => {
            const { createDelegationService } = await import("../auth/delegationService.js");
            const { authorize } = await import("../auth/authorization.js");
            const service = createDelegationService({ db });
            const post = await createPost({});
            const scope = `post:${post.id}:delete`;
            const invitation = await service.createDelegation(owner, {
                delegate_id: viewer, target_type: "post", target_id: String(post.id), scopes: [scope],
            }, { tokenType: "session" });
            const context = { userId: viewer, requiredScope: scope, tokenType: "session",
                delegationId: invitation.id, allowDelegation: true, db };
            assert.equal((await authorize(context)).allowed, false);
            await service.respondToDelegation(viewer, invitation.id, "accept", { tokenType: "session" });
            assert.equal((await authorize(context)).principalId, owner);
            assert.equal((await authorize({ ...context, delegationId: null })).allowed, false);
            assert.equal((await authorize({ ...context, requiredScope: "post:create" })).allowed, false);
            const deny = await db.ow_user_permissions.create({ data: { user_id: viewer, scope: "post:delete", effect: "deny" } });
            assert.equal((await authorize(context)).code, "ZC_ERROR_EXPLICIT_DENY");
            await db.ow_user_permissions.delete({ where: { id: deny.id } });
            const restriction = await db.ow_user_restrictions.create({ data: {
                user_id: owner, type: "readonly", categories: ["posts"], created_by: actor,
            } });
            assert.equal((await authorize(context)).allowed, false);
            await db.ow_user_restrictions.delete({ where: { id: restriction.id } });
            await db.ow_posts.update({ where: { id: post.id }, data: { author_id: other } });
            assert.equal((await authorize(context)).code, "ZC_ERROR_DELEGATION_OWNER_REQUIRED");
            await db.ow_posts.update({ where: { id: post.id }, data: { author_id: owner } });
            await service.respondToDelegation(owner, invitation.id, "revoke", { tokenType: "session" });
            assert.equal((await authorize(context)).allowed, false);
            assert.equal(await db.ow_events.count({ where: { actor_id: { in: users }, event_type: "permission_delegation", public: true } }), 0);
        });

        await t.test("independent readonly and shadowban restrictions revoke separately and expire live", async () => {
            const readonly = await createRestriction(owner, actor, { type: "readonly", categories: ["posts"], reason: "integration readonly" }, { db });
            const shadowban = await createRestriction(owner, actor, { type: "shadowban", categories: ["posts"], reason: "integration shadowban" }, { db });
            await assert.rejects(assertCanWrite(owner, "posts", "create", { db }), { code: "ACCOUNT_READ_ONLY" });
            await assertCanWrite(owner, "projects", "create", { db });
            await assertCanWrite(owner, "posts", "read", { db });
            await revokeRestriction(readonly.id, actor, { db });
            await assertCanWrite(owner, "posts", "create", { db });
            assert.equal((await db.ow_user_restrictions.findUnique({ where: { id: shadowban.id } })).revoked_at, null);
            await db.ow_user_restrictions.update({ where: { id: shadowban.id }, data: { starts_at: new Date(Date.now() - 2000), expires_at: new Date(Date.now() - 1000) } });
            const post = await createPost({});
            assert.equal(await canViewContent("post", post, null, { db }), true);
            assert.equal(await db.ow_events.count({ where: { actor_id: actor, event_type: "user_restriction", public: false } }), 3);
            await db.ow_user_restrictions.deleteMany({ where: { user_id: { in: users } } });
        });

        await t.test("soft deletion and restore preserve history, authorship, shadowban and private audit", async () => {
            const project = await createProject({});
            await db.ow_projects_commits.create({ data: { id: commitId, project_id: project.id, author_id: owner,
                commit_message: "preserve me", commit_date: new Date(), commit_file: "moderation-fixture-cas" } });
            await db.ow_projects_branch.create({ data: { projectid: project.id, name: "main", description: "integration", latest_commit_hash: commitId } });
            await setContentShadowban("project", project.id, actor, true, { db, reason: "integration hidden" });
            assert.equal((await softDeleteContent("project", project.id, owner, { db })).changed, true);
            assert.equal((await softDeleteContent("project", project.id, owner, { db })).changed, false);
            assert.equal(await db.ow_projects_commits.count({ where: { id: commitId } }), 1);
            assert.equal(await db.ow_projects_branch.count({ where: { projectid: project.id } }), 1);
            await restoreContent("project", project.id, owner, { db });
            const restored = await db.ow_projects.findUnique({ where: { id: project.id } });
            assert.equal(restored.authorid, owner);
            assert.equal(restored.is_shadowbanned, true);
            assert.equal(await canViewContent("project", restored, null, { db }), false);
            assert.equal(await canViewContent("project", restored, owner, { db }), true);
            await softDeleteContent("project", project.id, actor, { db, administrative: true });
            await assert.rejects(restoreContent("project", project.id, owner, { db }), { status: 404 });
            await restoreContent("project", project.id, actor, { db, administrative: true });
            assert.equal(await db.ow_events.count({ where: { actor_id: { in: users }, event_type: "content_moderation", public: true } }), 0);
        });

        await t.test("post counters are idempotent and transactional audit failure rolls content back", async () => {
            const root = await createPost({ reply_count: 1 });
            const reply = await createPost({ post_type: "reply", in_reply_to_id: root.id });
            await softDeleteContent("post", reply.id, owner, { db });
            assert.equal((await db.ow_posts.findUnique({ where: { id: root.id } })).reply_count, 0);
            await softDeleteContent("post", reply.id, owner, { db });
            assert.equal((await db.ow_posts.findUnique({ where: { id: root.id } })).reply_count, 0);
            await restoreContent("post", reply.id, owner, { db });
            await restoreContent("post", reply.id, owner, { db });
            assert.equal((await db.ow_posts.findUnique({ where: { id: root.id } })).reply_count, 1);
            const failingDb = new Proxy(db, { get(target, name) {
                if (name !== "$transaction") return Reflect.get(target, name);
                return (callback, options) => target.$transaction((tx) => callback(new Proxy(tx, { get(transaction, key) {
                    if (key !== "ow_events") return Reflect.get(transaction, key);
                    return { create: async () => { throw new Error("intentional audit failure"); } };
                } })), options);
            } });
            await assert.rejects(softDeleteContent("post", reply.id, owner, { db: failingDb }), /intentional audit failure/);
            assert.equal((await db.ow_posts.findUnique({ where: { id: reply.id } })).is_deleted, false);
            assert.equal((await db.ow_posts.findUnique({ where: { id: root.id } })).reply_count, 1);
        });
    } finally {
        await db.ow_user_restrictions.deleteMany({ where: { user_id: { in: users } } });
        await db.ow_user_permissions.deleteMany({ where: { user_id: { in: users } } });
        await db.ow_permission_delegations.deleteMany({ where: { grantor_id: { in: users } } });
        await db.ow_user_roles.deleteMany({ where: { user_id: { in: users } } });
        await db.ow_role_inheritance.deleteMany({ where: { role_id: { in: roles } } });
        await db.ow_role_permissions.deleteMany({ where: { role_id: { in: roles } } });
        await db.ow_roles.deleteMany({ where: { id: { in: roles } } });
        await db.ow_posts.updateMany({ where: { id: { in: posts } }, data: { in_reply_to_id: null, thread_root_id: null, retweet_post_id: null, quoted_post_id: null } });
        await db.ow_posts.deleteMany({ where: { id: { in: posts } } });
        await db.ow_projects_branch.deleteMany({ where: { projectid: { in: projects } } });
        await db.ow_projects_commits.deleteMany({ where: { id: commitId } });
        await db.ow_projects.deleteMany({ where: { id: { in: projects } } });
        await db.ow_events.deleteMany({ where: { actor_id: { in: users } } });
        await db.ow_users.deleteMany({ where: { id: { in: users } } });
        const { default: redis } = await import("../redis.js");
        redis.client?.disconnect();
        await db.$disconnect();
    }
});
