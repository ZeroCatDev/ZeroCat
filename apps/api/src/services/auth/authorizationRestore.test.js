import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const url = (path) => new URL(path, import.meta.url).href;
const state = {};
mock.module(url("../logger.js"), { defaultExport: { error() {}, warn() {}, info() {} } });
const { scopeSatisfies } = await import("./scopes.js");
const db = {
    ow_users: { async findUnique({ where }) { return { id: where.id, status: "active" }; } },
    ow_projects: { async findUnique() { return structuredClone(state.record); } },
    ow_posts: { async findUnique() { return structuredClone(state.record); } },
};
mock.module(url("../prisma.js"), { namedExports: { prisma: db } });
mock.module(url("./policyEngine.js"), { namedExports: {
    getUserPolicy: async () => state.policy,
    policyAllowsScope: (policy, scope) => scopeSatisfies(policy.allow, scope),
    policyDeniesScope: (policy, scope) => scopeSatisfies(policy.deny, scope),
    resourcePolicyAllowsScope: () => state.resourceGrant,
} });
mock.module(url("../moderation/visibility.js"), { namedExports: {
    async assertCanWrite(actorId, category, action) {
        state.writeChecks.push({ actorId, category, action });
        if (state.readonly) throw Object.assign(new Error("只读"), { status: 403, code: "ACCOUNT_READ_ONLY" });
    },
    async canViewContent(kind, record, actorId, options = {}) {
        state.visibilityChecks.push({ kind, record: structuredClone(record), actorId, options });
        return !record.deleted_at && !record.is_deleted
            && (!state.private || options.ignorePrivacy || Number(record.authorid ?? record.author_id) === actorId)
            && !state.hidden;
    },
} });
const { authorize } = await import("./authorization.js");
const request = (extra = {}) => ({ actorId: 3, tokenType: "session", requiredScope: "project:7:delete", includeDeleted: true, ...extra });
beforeEach(() => Object.assign(state, {
    record: { id: 7, authorid: 3, deleted_at: new Date(), deletion_source: "owner", is_shadowbanned: false, state: "private", type: "scratch" },
    policy: { valid: true, allow: ["project:delete", "post:delete", "project:update"], deny: [], sources: [] },
    resourceGrant: false, readonly: false, private: false, hidden: false, writeChecks: [], visibilityChecks: [],
}));

test("owner restore passes the deleted boundary only for an explicit delete action", async () => {
    const result = await authorize(request());
    assert.equal(result.allowed, true);
    assert.equal(result.actorId, 3);
    assert.equal(result.principalId, 3);
    assert.equal(state.writeChecks[0].action, "delete");
});

test("post owner can restore a legacy soft-deleted row", async () => {
    state.record = { id: 7, author_id: 3, is_deleted: true, deleted_at: null, deletion_source: null, is_shadowbanned: false };
    assert.equal((await authorize(request({ requiredScope: "post:7:delete" }))).allowed, true);
});

for (const change of ["admin", "administrative", "other-owner", "update", "ordinary-delete"]) {
    test(`includeDeleted cannot bypass ${change} boundary`, async () => {
        state.resourceGrant = true;
        const input = request();
        if (["admin", "administrative"].includes(change)) state.record.deletion_source = change;
        if (change === "other-owner") state.record.authorid = 9;
        if (change === "update") input.requiredScope = "project:7:update";
        if (change === "ordinary-delete") input.includeDeleted = false;
        assert.equal((await authorize(input)).allowed, false);
    });
}

test("restore still applies current policy, explicit deny, readonly, and fixed token ceiling", async () => {
    state.policy.allow = [];
    assert.equal((await authorize(request())).allowed, false);
    state.policy.allow = ["project:delete"];
    state.policy.deny = ["project:delete"];
    assert.equal((await authorize(request())).code, "ZC_ERROR_EXPLICIT_DENY");
    state.policy.deny = [];
    state.readonly = true;
    assert.equal((await authorize(request())).code, "ACCOUNT_READ_ONLY");
    state.readonly = false;
    assert.equal((await authorize(request({ tokenType: "personal", tokenScopes: ["project:read"] }))).code,
        "ZC_ERROR_INSUFFICIENT_SCOPE");
});

test("normal resource grants skip privacy only after permission checks and retain the real actor", async () => {
    state.record.deleted_at = null;
    state.record.authorid = 9;
    state.resourceGrant = true;
    state.private = true;
    const result = await authorize(request({ requiredScope: "project:7:update", includeDeleted: false }));
    assert.equal(result.allowed, true);
    assert.equal(state.visibilityChecks.at(-1).options.ignorePrivacy, true);
    assert.equal(state.visibilityChecks.at(-1).actorId, 3);
    state.hidden = true;
    assert.equal((await authorize(request({ requiredScope: "project:7:update", includeDeleted: false }))).status, 404);
});
