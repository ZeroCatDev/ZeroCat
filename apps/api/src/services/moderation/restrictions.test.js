import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const url = (path) => new URL(path, import.meta.url).href;
const state = {};
const cache = new Map();
mock.module(url("../prisma.js"), { namedExports: { prisma: {} } });
mock.module(url("../logger.js"), { defaultExport: { warn(message) { state.warnings.push(message); } } });
mock.module(url("../memoryCache.js"), { defaultExport: { cache } });
mock.module(url("../redis.js"), { defaultExport: { async set() { if (state.redisFails) throw new Error("redis unavailable"); } } });
mock.module(url("../config/zcconfig.js"), { defaultExport: { async get() { return state.configuredAdmins; } } });
mock.module(url("../auth/policyEngine.js"), { namedExports: {
    async getUserPolicy(_id, options) { state.policyDb = options.db; return state.policy; },
    policyAllowsScope(policy, scope) { return policy.allow.includes(scope); },
    clearUserPolicyCache(id) { state.invalidated.push(id); },
} });
mock.module(url("../auth/authorization.js"), { namedExports: { async authorize(context) {
    state.authorization = context;
    return state.denied ? { allowed: false, status: 403, code: "DENIED", message: "denied" } : { allowed: true };
} } });
const { createRestriction, revokeRestriction, assertCanWrite, invalidateModerationCaches } = await import("./restrictions.js");
const tx = {
    ow_users: { async findUnique() { return state.user; } },
    ow_user_restrictions: {
        async create({ data }) { const rule = { id: state.rules.length + 1, ...data }; state.rules.push(rule); return rule; },
        async findUnique({ where }) { return state.rules.find(rule => rule.id === where.id); },
        async update({ where, data }) { const rule = state.rules.find(rule => rule.id === where.id); Object.assign(rule, data); return rule; },
        async findFirst() { return state.rules.find(rule => !rule.revoked_at && rule.type === "readonly"); },
    },
    ow_events: { async create({ data }) { if (state.auditFails) throw new Error("audit failed"); state.audits.push(data); } },
};
const db = { ...tx, async $transaction(work, options) {
    state.transactions.push(options);
    if (state.conflicts-- > 0) throw Object.assign(new Error("conflict"), { code: "P2034" });
    const snapshot = structuredClone({ rules: state.rules, audits: state.audits });
    try { return await work(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
} };
const input = { type: "readonly", categories: ["posts"], reason: "test restriction" };
const options = { db, authorizationContext: { tokenType: "personal", tokenScopes: ["admin:restrictions:manage"] } };
beforeEach(() => {
    cache.clear();
    Object.assign(state, { user: { id: 1, type: "user", status: "active" }, policy: { valid: true, allow: [] },
        configuredAdmins: [], rules: [], audits: [], transactions: [], invalidated: [], warnings: [],
        redisFails: false, denied: false, auditFails: false, conflicts: 0 });
});

test("restriction authority, target policy and private audit share one serializable transaction", async () => {
    await createRestriction(1, 2, input, options);
    assert.equal(state.authorization.db, tx);
    assert.equal(state.policyDb, tx);
    assert.equal(state.authorization.tokenType, "personal");
    assert.deepEqual(state.authorization.tokenScopes, ["admin:restrictions:manage"]);
    assert.equal(state.transactions[0].isolationLevel, "Serializable");
    assert.equal(state.audits[0].public, false);
    assert.equal(state.audits[0].actor_id, 2);
});

test("Redis outage after commit clears local caches and reports successful restriction", async () => {
    state.redisFails = true;
    cache.set("public-candidates", [1]);
    const rule = await createRestriction(1, 2, input, options);
    assert.equal(rule.id, 1);
    assert.equal(state.rules.length, 1);
    assert.equal(state.audits.length, 1);
    assert.equal(cache.size, 0);
    assert.deepEqual(state.invalidated, [1]);
    assert.match(state.warnings[0], /redis unavailable/);
    await invalidateModerationCaches(1);
});

test("revoking one stacked restriction leaves the other active and is idempotent", async () => {
    await createRestriction(1, 2, input, options);
    await createRestriction(1, 2, { ...input, type: "shadowban" }, options);
    await revokeRestriction(1, 2, options);
    await revokeRestriction(1, 2, options);
    assert.ok(state.rules[0].revoked_at);
    assert.equal(state.rules[1].revoked_at, undefined);
    assert.equal(state.audits.length, 3);
});

test("audit failure rolls back restriction and conflicts retry without duplicate rows", async () => {
    state.auditFails = true;
    await assert.rejects(createRestriction(1, 2, input, options), /audit failed/);
    assert.equal(state.rules.length, 0);
    assert.equal(state.invalidated.length, 0);
    state.auditFails = false;
    state.conflicts = 1;
    await createRestriction(1, 2, input, options);
    assert.equal(state.rules.length, 1);
    assert.equal(state.audits.length, 1);
    state.conflicts = 3;
    await assert.rejects(revokeRestriction(1, 2, options), { code: "RESTRICTION_OPERATION_CONFLICT" });
    assert.equal(state.rules[0].revoked_at, undefined);
});

test("unavailable target policy, inherited admin, configured admin and self restrictions fail closed", async () => {
    state.policy.valid = false;
    await assert.rejects(createRestriction(1, 2, input, options), { code: "POLICY_UNAVAILABLE" });
    state.policy = { valid: true, allow: ["admin:manage"] };
    await assert.rejects(createRestriction(1, 2, input, options), { code: "ADMIN_USER_PROTECTED" });
    state.policy.allow = [];
    state.configuredAdmins = [1];
    await assert.rejects(createRestriction(1, 2, input, options), { code: "ADMIN_USER_PROTECTED" });
    await assert.rejects(createRestriction(1, 1, input, options), { code: "SELF_OPERATION_FORBIDDEN" });
    assert.equal(state.rules.length, 0);
});

test("readonly permits private state and security maintenance while denying public writes", async () => {
    state.rules.push({ id: 1, type: "readonly" });
    for (const action of ["read", "private", "security"]) await assertCanWrite(1, "posts", action, { db });
    for (const action of ["create", "update", "delete", "interact", "restore", "sync"]) {
        await assert.rejects(assertCanWrite(1, "posts", action, { db }), { code: "ACCOUNT_READ_ONLY" });
    }
});
