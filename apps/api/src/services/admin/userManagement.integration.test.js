import test from "node:test";
import assert from "node:assert/strict";
import { cleanupUserData } from "./userDataCleanup.js";
import { createUserManagementService } from "./userManagementService.js";

const databaseUrl = process.env.ADMIN_USERS_TEST_DATABASE_URL;
const enabled = Boolean(databaseUrl);
if (enabled) {
    const url = new URL(databaseUrl);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("/zerocat_admin_test")) {
        throw new Error("Integration tests require a local, dedicated zerocat_admin_test database");
    }
}

test("PostgreSQL cleanup regression", { skip: !enabled }, async (t) => {
    const { PrismaClient } = await import("../../../generated/prisma/client.ts");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    try {
        await db.ow_users.createMany({ data: [
            { id: 91001, username: "admin-cleanup-fixture", status: "active" },
            { id: 91002, username: "target-cleanup-fixture", status: "active" },
            { id: 91003, username: "other-cleanup-fixture", status: "active" },
        ] });
        await t.test("internal Restrict links and other people's references survive selective post cleanup", async () => {
            const root = await db.ow_posts.create({ data: { author_id: 91002, content: "target root" } });
            const child = await db.ow_posts.create({ data: {
                author_id: 91002, content: "soft deleted target", is_deleted: true,
                in_reply_to_id: root.id, thread_root_id: root.id,
            } });
            const otherRoot = await db.ow_posts.create({ data: { author_id: 91003, content: "other root" } });
            const reply = await db.ow_posts.create({ data: {
                author_id: 91003, content: "other reply", post_type: "reply",
                in_reply_to_id: root.id, thread_root_id: otherRoot.id,
            } });
            const quote = await db.ow_posts.create({ data: { author_id: 91003, content: "other quote", post_type: "quote", quoted_post_id: child.id } });
            const retweet = await db.ow_posts.create({ data: { author_id: 91003, post_type: "retweet", retweet_post_id: root.id } });
            const result = await db.$transaction((tx) => cleanupUserData(tx, 91002, ["posts"]));
            assert.equal(result.counts.posts, 2);
            assert.equal(await db.ow_posts.count({ where: { author_id: 91002 } }), 0);
            const surviving = await db.ow_posts.findUnique({ where: { id: reply.id } });
            assert.equal(surviving.content, "other reply");
            assert.equal(surviving.in_reply_to_id, null);
            assert.equal(surviving.thread_root_id, otherRoot.id);
            assert.equal((await db.ow_posts.findUnique({ where: { id: quote.id } })).quoted_post_id, null);
            assert.equal((await db.ow_posts.findUnique({ where: { id: retweet.id } })).retweet_post_id, null);
            assert.ok(await db.ow_users.findUnique({ where: { id: 91002 } }));
        });
        await t.test("real transaction rolls back cleanup and detached references on failure", async () => {
            const root = await db.ow_posts.create({ data: { author_id: 91002, content: "rollback root" } });
            const reply = await db.ow_posts.create({ data: { author_id: 91003, content: "rollback reply", in_reply_to_id: root.id } });
            await assert.rejects(db.$transaction(async (tx) => {
                await cleanupUserData(tx, 91002, ["posts"]);
                throw new Error("intentional rollback");
            }), /intentional rollback/);
            assert.ok(await db.ow_posts.findUnique({ where: { id: root.id } }));
            assert.equal((await db.ow_posts.findUnique({ where: { id: reply.id } })).in_reply_to_id, root.id);
        });
        await t.test("permanent deletion preserves shared fork history and other users' comments", async () => {
            const original = await db.ow_projects.create({ data: { authorid: 91002, name: "original" } });
            const fork = await db.ow_projects.create({ data: { authorid: 91003, name: "fork", fork: original.id } });
            const commitId = "admin-cleanup-shared-commit";
            await db.ow_projects_commits.create({ data: {
                id: commitId, project_id: original.id, author_id: 91002,
                commit_message: "shared", commit_date: new Date(), commit_file: "shared-cas-file",
            } });
            await db.ow_projects_branch.create({ data: { projectid: fork.id, name: "main", description: "fork", latest_commit_hash: commitId } });
            const comment = await db.ow_comment.create({ data: { user_id: 91002, text: "target comment" } });
            const reply = await db.ow_comment.create({ data: { user_id: 91003, text: "other comment", pid: comment.id, rid: comment.id } });
            const app = await db.ow_oauth_applications.create({ data: { owner_id: 91002, name: "target app", client_id: "fixture-app", client_secret: "fixture-only", redirect_uris: [], scopes: [] } });
            await db.ow_tokens.create({ data: { user_id: 91003, application_id: app.id, token_hash: "f".repeat(64), scopes: [], type: "oauth" } });
            await db.ow_users_totp.create({ data: { user_id: 91002 } });
            const service = createUserManagementService({
                db,
                tokens: {
                    revokeTokensWhere: async (where, { db: tx }) => ({ success: true, count: (await tx.ow_tokens.updateMany({ where, data: { revoked: true } })).count, cacheKeys: [] }),
                    tokenCacheKeysForRecords: () => [], invalidateTokenCaches: async () => ({ success: true }),
                },
                policyAllowsScope: () => false, getConfiguredAdmins: async () => [], clearPolicyCache: () => {},
            });
            const result = await service.cleanup(91002, 91001, { confirmUsername: "target-cleanup-fixture", confirmCommentSpaces: true }, true);
            assert.equal(result.counts.projects, 1);
            assert.equal(await db.ow_users.findUnique({ where: { id: 91002 } }), null);
            assert.equal(await db.ow_projects.findUnique({ where: { id: original.id } }), null);
            assert.ok(await db.ow_projects.findUnique({ where: { id: fork.id } }));
            assert.equal((await db.ow_projects_commits.findUnique({ where: { id: commitId } })).author_id, null);
            assert.equal((await db.ow_projects_branch.findFirst({ where: { projectid: fork.id } })).latest_commit_hash, commitId);
            assert.equal((await db.ow_comment.findUnique({ where: { id: reply.id } })).text, "other comment");
            assert.equal((await db.ow_comment.findUnique({ where: { id: reply.id } })).pid, null);
            assert.equal(await db.ow_tokens.count({ where: { application_id: app.id } }), 0);
            assert.equal(await db.ow_users_totp.count({ where: { user_id: 91002 } }), 0);
            assert.equal(result.tokenCacheRecords, undefined);
        });
    } finally {
        const userIds = [91001, 91002, 91003];
        const projects = await db.ow_projects.findMany({ where: { authorid: { in: userIds } }, select: { id: true } });
        const projectIds = projects.map(({ id }) => id);
        await db.ow_posts.updateMany({ where: { author_id: { in: userIds } }, data: {
            in_reply_to_id: null, thread_root_id: null, quoted_post_id: null, retweet_post_id: null,
        } });
        await db.ow_posts.deleteMany({ where: { author_id: { in: userIds } } });
        await db.ow_comment.deleteMany({ where: { user_id: { in: userIds } } });
        await db.ow_projects_branch.deleteMany({ where: { projectid: { in: projectIds } } });
        await db.ow_projects_commits.deleteMany({ where: { id: "admin-cleanup-shared-commit" } });
        await db.ow_projects.deleteMany({ where: { id: { in: projectIds } } });
        await db.ow_events.deleteMany({ where: { actor_id: { in: userIds } } });
        await db.ow_users.deleteMany({ where: { id: { in: userIds } } });
        await db.$disconnect();
    }
});
