import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const url = (path) => new URL(path, import.meta.url).href;
mock.module(url("../logger.js"), { defaultExport: { error() {}, warn() {}, info() {} } });
mock.module(url("../prisma.js"), { namedExports: { prisma: {} } });
mock.module(url("../redis.js"), { defaultExport: { async set() {} } });
mock.module(url("../config/zcconfig.js"), { defaultExport: { async get() { return []; } } });
const { createDelegationService } = await import("./delegationService.js");
const state = {};
const currentTime = new Date("2026-10-18T10:00:00Z");
const base = { id: 11, grantor_id: 1, delegate_id: 2, target_type: "project", target_id: "7",
    scopes: ["project:7:read", "project:7:update", "project:7:delete", "project:7:interact"], status: "accepted",
    accepted_at: new Date("2026-10-17T10:00:00Z"), revoked_at: null, expires_at: new Date("2026-10-19T10:00:00Z") };
const tx = {
    ow_users: { async findUnique({ where }) { return state.users.find((user) => user.id === where.id); } },
    ow_projects: { async findUnique() { return state.project; } },
    ow_posts: { async findUnique() { return state.post; } },
    ow_projects_lists: { async findUnique() { return state.list; } },
    ow_comment_spaces: { async findUnique() { return state.space; } },
    ow_comment_service: { async findUnique() { return state.comment; } },
    ow_permission_delegations: {
        async findUnique({ where }) { return structuredClone(state.records.find((record) => record.id === where.id)); },
        async findMany(query) { state.listQuery = query; return structuredClone(state.records); },
        async create({ data }) { const record = { id: 12, ...data }; state.records.push(record); return structuredClone(record); },
        async update({ where, data }) { const record = state.records.find((entry) => entry.id === where.id); Object.assign(record, data); return structuredClone(record); },
    },
    ow_events: { async create({ data }) { if (state.auditFails) throw new Error("audit failed"); state.audits.push(data); } },
};
const db = { ...tx, async $transaction(work, options) {
    state.transactions.push(options);
    if (state.conflicts-- > 0) throw Object.assign(new Error("conflict"), { code: "P2034" });
    const snapshot = structuredClone({ records: state.records, audits: state.audits });
    try { return await work(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
} };
const service = createDelegationService({ db, now: () => currentTime,
    async getPolicy(userId, options) { state.policyReads.push({ userId, options }); return state.policies[userId]; },
    async assertWrite(userId, category, action, transaction) {
        state.writeChecks.push({ userId, category, action, transaction });
        if (action !== "read" && (state.readonly.has(userId) || state.readonlyCategory === category)) {
            throw Object.assign(new Error("readonly"), { status: 403, code: "ACCOUNT_READ_ONLY" });
        }
    },
});
const input = (extra = {}) => ({ delegate_id: 2, target_type: "project", target_id: "7", scopes: ["project:7:update"], ...extra });
const request = (extra = {}) => ({ actorId: 2, delegationId: 11, allowDelegation: true,
    requiredScope: "project:7:update", tokenType: "session", ...extra });
const session = { tokenType: "session" };
const pending = () => Object.assign(state.records[0], { status: "pending", accepted_at: null });
beforeEach(() => Object.assign(state, {
    users: [{ id: 1, status: "active" }, { id: 2, status: "active" }, { id: 3, status: "active" }],
    records: [structuredClone(base)], project: { id: 7, authorid: 1, type: "scratch" },
    post: { id: 7, author_id: 1 }, list: { id: 7, authorid: 1 }, comment: { id: 7, account_user_id: 1 },
    space: { owner_id: 1, status: "active" },
    policies: { 1: { valid: true, allow: ["*"], deny: [] }, 2: { valid: true, allow: [], deny: [] } },
    readonly: new Set(), readonlyCategory: null, policyReads: [], writeChecks: [], transactions: [], audits: [], conflicts: 0, auditFails: false,
}));

test("owner creates pending exact resource scopes with private atomic audit", async () => {
    const result = await service.createDelegation(1, input({ reason: "help" }), session);
    assert.equal(result.status, "pending");
    assert.equal(result.accepted_at, null);
    assert.equal(result.grantor_id, 1);
    assert.equal(state.transactions[0].isolationLevel, "Serializable");
    assert.equal(state.audits[0].actor_id, 1);
    assert.equal(state.audits[0].public, false);
    assert.equal(state.audits[0].event_data.action, "create");
    assert.ok(state.policyReads.every((read) => read.options.db === tx));
    assert.deepEqual(state.writeChecks.map(({ userId, action }) => ({ userId, action })), [{ userId: 1, action: "update" }, { userId: 2, action: "update" }]);
});

for (const type of ["project", "post", "comment", "list", "blog"]) {
    test(`${type} delegation checks actual ownership and exact scope`, async () => {
        state.project.type = "article";
        const result = await service.createDelegation(1, input({ target_type: type, scopes: [`${type}:7:delete`] }), session);
        assert.equal(result.target_type, type);
        assert.deepEqual(result.scopes, [`${type}:7:delete`]);
    });
}

test("comment author ownership cannot be replaced by comment-space moderation", async () => {
    state.comment.account_user_id = 3;
    await assert.rejects(service.createDelegation(1, input({ target_type: "comment", scopes: ["comment:7:delete"] }), session),
        { code: "ZC_ERROR_DELEGATION_OWNER_REQUIRED" });
    const result = await service.createDelegation(1, input({ target_type: "comment", target_id: "space_abc", scopes: ["comment:space_abc:read"] }), session);
    assert.equal(result.target_id, "space_abc");
});

test("wildcards, type-wide and privileged actions fail without writing", async () => {
    for (const scope of ["*", "project:*", "project:7:*", "project:update", "project:8:update", "project:7:create",
        "project:7:manage", "project:7:write", "admin:manage", "user:1:update", "token:7:manage"]) {
        await assert.rejects(service.createDelegation(1, input({ scopes: [scope] }), session), { code: "ZC_ERROR_INVALID_DELEGATION_SCOPES" });
    }
    assert.equal(state.records.length, 1);
});

test("create rejects self, nonowner, deleted resource, wrong blog type and redelegation", async () => {
    await assert.rejects(service.createDelegation(1, input({ delegate_id: 1 }), session), { code: "ZC_ERROR_DELEGATION_SELF" });
    await assert.rejects(service.createDelegation(3, input(), session), { code: "ZC_ERROR_DELEGATION_OWNER_REQUIRED" });
    state.project.deleted_at = currentTime;
    await assert.rejects(service.createDelegation(1, input(), session), { code: "ZC_ERROR_DELEGATION_OWNER_REQUIRED" });
    state.project.deleted_at = null;
    await assert.rejects(service.createDelegation(1, input({ target_type: "blog", scopes: ["blog:7:update"] }), session), { code: "ZC_ERROR_DELEGATION_OWNER_REQUIRED" });
    await assert.rejects(service.createDelegation(1, input(), { ...session, delegationId: 11 }), { code: "ZC_ERROR_REDELEGATION_FORBIDDEN" });
});

test("creation validates expiry, reason and caller token ceiling", async () => {
    for (const expires_at of ["invalid", currentTime.toISOString(), "2025-01-01", 42]) {
        await assert.rejects(service.createDelegation(1, input({ expires_at }), session), { code: "ZC_ERROR_INVALID_EXPIRATION" });
    }
    await assert.rejects(service.createDelegation(1, input({ reason: "x".repeat(1001) }), session), { code: "ZC_ERROR_INVALID_REASON" });
    await assert.rejects(service.createDelegation(1, input(), { tokenType: "personal", tokenScopes: ["project:read"] }), { code: "ZC_ERROR_INSUFFICIENT_SCOPE" });
});

test("only recipient accepts pending delegation and accept remains readonly guarded", async () => {
    pending();
    await assert.rejects(service.respondToDelegation(1, 11, "accept", session), { code: "ZC_ERROR_DELEGATION_RECIPIENT_REQUIRED" });
    await assert.rejects(service.respondToDelegation(3, 11, "accept", session), { status: 404 });
    state.readonly.add(2);
    await assert.rejects(service.respondToDelegation(2, 11, "accept", session), { code: "ACCOUNT_READ_ONLY" });
    state.readonly.clear();
    const result = await service.respondToDelegation(2, 11, "accept", session);
    assert.equal(result.status, "accepted");
    assert.deepEqual(result.accepted_at, currentTime);
    assert.equal(state.audits[0].event_data.action, "accept");
    await assert.rejects(service.respondToDelegation(2, 11, "accept", session), { status: 409 });
});

test("accept rechecks expiry, grantor authority and recipient token ceiling", async () => {
    pending();
    state.records[0].expires_at = currentTime;
    await assert.rejects(service.respondToDelegation(2, 11, "accept", session), { code: "ZC_ERROR_DELEGATION_EXPIRED" });
    state.records[0].expires_at = null;
    state.project.authorid = 3;
    await assert.rejects(service.respondToDelegation(2, 11, "accept", session), { code: "ZC_ERROR_DELEGATION_OWNER_REQUIRED" });
    state.project.authorid = 1;
    await assert.rejects(service.respondToDelegation(2, 11, "accept", { tokenType: "oauth", tokenScopes: ["project:update"] }), { code: "ZC_ERROR_INSUFFICIENT_SCOPE" });
});

for (const actor of [1, 2]) {
    test(`participant ${actor} can revoke readonly without current grantor policy`, async () => {
        state.readonly.add(actor);
        state.policies[1].allow = [];
        const result = await service.respondToDelegation(actor, 11, "revoke", session);
        assert.equal(result.status, "revoked");
        assert.deepEqual(result.revoked_at, currentTime);
        assert.equal(state.writeChecks.length, 0);
        assert.equal(state.audits[0].actor_id, actor);
        assert.equal(state.audits[0].public, false);
    });
}

test("recipient can decline readonly and grantor cannot decline", async () => {
    pending();
    state.readonly.add(2);
    await assert.rejects(service.respondToDelegation(1, 11, "decline", session), { status: 403 });
    assert.equal((await service.respondToDelegation(2, 11, "decline", session)).status, "declined");
    assert.equal(state.writeChecks.length, 0);
});

test("runtime keeps real actor separate and requires explicit opt-in", async () => {
    const result = await service.authorizeDelegation(request());
    assert.deepEqual(Object.keys(result).sort(), ["allowed", "code", "message", "principalId", "sources", "status"]);
    assert.equal(result.allowed, true);
    assert.equal(result.principalId, 1);
    assert.equal(result.sources[0].delegate_id, 2);
    assert.equal((await service.authorizeDelegation(request({ allowDelegation: false }))).code, "ZC_ERROR_DELEGATION_NOT_SUPPORTED");
    assert.equal((await service.authorizeDelegation(request({ actorId: 3 }))).allowed, false);
});

for (const stateChange of ["expiry", "revoke", "pending", "owner", "grantor-policy", "grantor-inactive", "actor-inactive", "grantor-readonly", "actor-readonly", "grantor-deny", "actor-deny"]) {
    test(`runtime immediately observes ${stateChange}`, async () => {
        assert.equal((await service.authorizeDelegation(request())).allowed, true);
        if (stateChange === "expiry") state.records[0].expires_at = currentTime;
        if (stateChange === "revoke") state.records[0].revoked_at = currentTime;
        if (stateChange === "pending") pending();
        if (stateChange === "owner") state.project.authorid = 3;
        if (stateChange === "grantor-policy") state.policies[1].allow = [];
        if (stateChange === "grantor-inactive") state.users[0].status = "banned";
        if (stateChange === "actor-inactive") state.users[1].status = "banned";
        if (stateChange === "grantor-readonly") state.readonly.add(1);
        if (stateChange === "actor-readonly") state.readonly.add(2);
        if (stateChange === "grantor-deny") state.policies[1].deny = ["project:7:update"];
        if (stateChange === "actor-deny") state.policies[2].deny = ["project:update"];
        assert.equal((await service.authorizeDelegation(request())).allowed, false);
    });
}

test("runtime cannot widen resource, action or token scope and checks valid policies", async () => {
    for (const scope of ["project:8:update", "post:7:update", "project:update", "project:7:manage", "project:7:create"]) {
        assert.equal((await service.authorizeDelegation(request({ requiredScope: scope }))).allowed, false);
    }
    assert.equal((await service.authorizeDelegation(request({ tokenType: "personal", tokenScopes: ["project:read"] }))).code, "ZC_ERROR_INSUFFICIENT_SCOPE");
    state.policies[2].valid = false;
    assert.equal((await service.authorizeDelegation(request())).code, "ZC_ERROR_POLICY_UNAVAILABLE");
});

test("article delegation enforces both blog and projects readonly categories", async () => {
    state.project.type = "article";
    for (const category of ["projects", "blog"]) {
        state.readonlyCategory = category;
        assert.equal((await service.authorizeDelegation(request())).code, "ACCOUNT_READ_ONLY");
        await assert.rejects(service.createDelegation(1, input({ target_type: "blog", scopes: ["blog:7:read"] }), session), { code: "ACCOUNT_READ_ONLY" });
    }
});

test("list returns only delegation metadata and participant-specific buckets", async () => {
    state.records[0].resource = { title: "private" };
    state.records[0].grantor = { email: "private" };
    state.policies[2].allow = ["user:read"];
    const result = await service.listDelegations(2, session);
    assert.equal(result.sent.length, 0);
    assert.equal(result.received.length, 1);
    assert.equal(result.received[0].resource, undefined);
    assert.equal(result.received[0].grantor, undefined);
    assert.deepEqual(state.listQuery.where, { OR: [{ grantor_id: 2 }, { delegate_id: 2 }] });
    assert.equal(state.listQuery.select.scopes, true);
});

test("delegated execution reuses the caller transaction without nesting another transaction", async () => {
    assert.equal((await service.authorizeDelegation(request({ db: tx }))).allowed, true);
    assert.equal(state.transactions.length, 0);
    assert.ok(state.policyReads.every(read => read.options.db === tx));
});

test("delegation management preserves fixed token ceilings while readonly revocation remains available", async () => {
    state.policies[2].allow = ["user:read"];
    await assert.rejects(service.listDelegations(2, { tokenType: "personal", tokenScopes: [] }), { code: "ZC_ERROR_INSUFFICIENT_SCOPE" });
    await assert.rejects(service.respondToDelegation(2, 11, "revoke", { tokenType: "personal", tokenScopes: ["project:7:read"] }), { code: "ZC_ERROR_INSUFFICIENT_SCOPE" });
    state.readonly.add(2);
    assert.equal((await service.respondToDelegation(2, 11, "revoke", { tokenType: "personal", tokenScopes: ["user:update"] })).status, "revoked");
});

test("serializable conflicts retry and audit failures roll back state", async () => {
    state.conflicts = 1;
    await service.createDelegation(1, input(), session);
    assert.equal(state.transactions.length, 2);
    assert.equal(state.audits.length, 1);
    state.auditFails = true;
    await assert.rejects(service.respondToDelegation(2, 11, "revoke", session), /audit failed/);
    assert.equal(state.records[0].status, "accepted");
});
