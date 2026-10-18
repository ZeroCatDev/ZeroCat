import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const url = path => new URL(path, import.meta.url).href;
const state = {};
const store = table => ({
    async findUnique({ where }) { return state[table].get(where.id) || null; },
    async update({ where, data }) {
        const row = { ...state[table].get(where.id), ...data };
        state[table].set(where.id, row);
        return row;
    },
    async updateMany({ where, data }) {
        const row = state[table].get(where.id);
        if (!row) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
            if (where[key]?.gt !== undefined && !(row[key] > where[key].gt)) continue;
            row[key] += value.increment;
        }
        return { count: 1 };
    },
});
const db = {
    ow_posts: store("posts"), ow_projects: store("projects"),
    ow_events: { async create({ data }) { if (state.auditFails) throw new Error("audit unavailable"); state.audits.push(data); } },
    async $transaction(work, options) {
        state.transactions.push(options);
        if (state.conflicts-- > 0) throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
        const snapshot = structuredClone({ posts: state.posts, projects: state.projects, audits: state.audits });
        try { return await work(db); } catch (error) { Object.assign(state, snapshot); throw error; }
    },
};
mock.module(url("../prisma.js"), { namedExports: { prisma: db } });
mock.module(url("../logger.js"), { defaultExport: { warn() {} } });
mock.module(url("./restrictions.js"), { namedExports: {
    async assertCanWrite(userId, category, action) {
        state.guards.push({ userId, category, action });
        if (state.blocked.some(rule => rule.userId === userId && rule.category === category)) {
            throw Object.assign(new Error("readonly"), { status: 403, code: "ACCOUNT_READ_ONLY" });
        }
    },
    async invalidateModerationCaches() { state.invalidations++; },
} });
mock.module(url("../auth/authorization.js"), { namedExports: {
    async authorize(context) {
        state.authorizations.push(context);
        return state.denied ? { allowed: false, status: 403, code: "EXPLICIT_DENY", message: "denied" }
            : { allowed: true, principalId: state.principalId || context.userId };
    },
} });
mock.module(url("../queue/queueManager.js"), { defaultExport: {
    async enqueueSocialPostSync(...args) { state.effects.push(["social", ...args]); },
    async enqueueProjectGorseSync(...args) { state.effects.push(["project", ...args]); },
    async enqueueBlogSyncRemove(...args) { state.effects.push(["blog-remove", ...args]); },
} });
mock.module(url("../gorse.js"), { defaultExport: { async hidePost(id) { state.effects.push(["hide", id]); } } });
const { softDeleteContent, restoreContent, setContentShadowban } = await import("./lifecycle.js");
const post = (id, authorId, extra = {}) => ({ id, author_id: authorId, is_deleted: false, deleted_at: null, post_type: "normal", is_shadowbanned: true, content: "retained text", ...extra });
beforeEach(() => Object.assign(state, {
    posts: new Map(), projects: new Map(), audits: [], guards: [], effects: [], authorizations: [], transactions: [],
    blocked: [], principalId: null, invalidations: 0, conflicts: 0, denied: false, auditFails: false,
}));

test("soft deletion and restore preserve body/hidden state and adjust reply counter exactly once", async () => {
    state.posts.set(1, post(1, 7, { reply_count: 1 }));
    state.posts.set(2, post(2, 7, { post_type: "reply", in_reply_to_id: 1 }));
    await softDeleteContent("post", 2, 7);
    await softDeleteContent("post", 2, 7);
    assert.equal(state.posts.get(1).reply_count, 0);
    assert.equal(state.posts.get(2).content, "retained text");
    assert.equal(state.audits.length, 1);
    await restoreContent("post", 2, 7);
    await restoreContent("post", 2, 7);
    assert.equal(state.posts.get(1).reply_count, 1);
    assert.equal(state.posts.get(2).is_deleted, false);
    assert.equal(state.posts.get(2).is_shadowbanned, true);
    assert.equal(state.audits.length, 2);
    assert.equal(state.effects.filter(([type]) => type === "social").length, 1);
});

test("restore always rechecks explicit token context and includeDeleted within transaction", async () => {
    state.posts.set(1, post(1, 7, { is_deleted: true, deleted_at: new Date() }));
    const authorizationContext = { tokenType: "personal", tokenScopes: ["post:1:delete"] };
    await restoreContent("post", 1, 7, { authorizationContext });
    const call = state.authorizations[0];
    assert.equal(call.tokenType, "personal");
    assert.deepEqual(call.tokenScopes, ["post:1:delete"]);
    assert.equal(call.includeDeleted, true);
    assert.equal(call.db, db);
});

for (const source of ["admin", "administrative"]) {
    test(`author cannot restore ${source} deletion`, async () => {
        state.posts.set(1, post(1, 7, { is_deleted: true, deletion_source: source }));
        await assert.rejects(restoreContent("post", 1, 7), { status: 404 });
        assert.equal(state.posts.get(1).is_deleted, true);
        assert.equal(state.audits.length, 0);
    });
}

test("article lifecycle checks blog readonly for both actual actor and delegated principal", async () => {
    state.projects.set(1, { id: 1, authorid: 9, type: "article", deleted_at: null });
    state.principalId = 9;
    state.blocked = [{ userId: 9, category: "blog" }];
    await assert.rejects(softDeleteContent("project", 1, 7, { delegationId: 3 }), { code: "ACCOUNT_READ_ONLY" });
    assert.equal(state.projects.get(1).deleted_at, null);
    assert.equal(state.audits.length, 0);
    assert.ok(state.guards.some(rule => rule.userId === 7 && rule.category === "blog"));
});

test("audit failure rolls deletion and counter updates back and never runs side effects", async () => {
    state.posts.set(1, post(1, 7, { retweet_count: 1 }));
    state.posts.set(2, post(2, 7, { post_type: "retweet", retweet_post_id: 1 }));
    state.auditFails = true;
    await assert.rejects(softDeleteContent("post", 2, 7), /audit unavailable/);
    assert.equal(state.posts.get(2).is_deleted, false);
    assert.equal(state.posts.get(1).retweet_count, 1);
    assert.equal(state.invalidations, 0);
    assert.deepEqual(state.effects, []);
});

test("serializable retry commits once and explicit deny prevents writes", async () => {
    state.posts.set(1, post(1, 7));
    state.conflicts = 1;
    await softDeleteContent("post", 1, 7);
    assert.equal(state.transactions.length, 2);
    assert.equal(state.audits.length, 1);
    assert.equal(state.transactions[0].isolationLevel, "Serializable");
    state.denied = true;
    await assert.rejects(restoreContent("post", 1, 7), { code: "EXPLICIT_DENY" });
    assert.equal(state.posts.get(1).is_deleted, true);
});

test("item shadowban is independent from deletion and administrative removal is explicit", async () => {
    state.projects.set(1, { id: 1, authorid: 7, type: "article", deleted_at: new Date() });
    await setContentShadowban("project", 1, 3, true, { reason: "moderation" });
    assert.ok(state.projects.get(1).deleted_at);
    assert.equal(state.projects.get(1).is_shadowbanned, true);
    const effect = state.effects.find(([type]) => type === "blog-remove");
    assert.equal(effect[3].systemModeration, true);
    await setContentShadowban("project", 1, 3, false);
    assert.ok(state.projects.get(1).deleted_at);
    assert.equal(state.projects.get(1).is_shadowbanned, false);
});
