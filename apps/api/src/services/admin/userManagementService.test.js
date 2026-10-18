import test from "node:test";
import assert from "node:assert/strict";
import { createUserManagementService, requireUserId, safeContact, safeUser } from "./userManagementService.js";

function fixture({ self = false, admin = false, configured = [], failAudit = false, cacheFailure = false } = {}) {
    const calls = [];
    const state = { id: 7, username: "target", status: "active", type: "user" };
    const tx = {
        ow_users: {
            findUnique: async () => ({ ...state }),
            update: async ({ data }) => { calls.push("update"); return { ...state, ...data }; },
            delete: async () => { calls.push("delete-user"); },
        },
        ow_user_roles: { findMany: async () => admin ? [{ role: { key: "admin", permissions: [] } }] : [] },
        ow_tokens: {
            findFirst: async ({ where }) => where.id === 10 ? { id: 10 } : null,
            findMany: async () => [], count: async () => 0,
        },
        ow_events: { create: async () => { calls.push("audit"); if (failAudit) throw new Error("audit failure"); } },
    };
    const db = { ...tx, $transaction: async (work, options) => {
        calls.push(options.isolationLevel);
        const result = await work(tx);
        calls.push("commit");
        return result;
    } };
    const service = createUserManagementService({
        db,
        tokens: {
            revokeTokensWhere: async (where, options) => {
                assert.equal(options.db, tx);
                assert.equal(options.invalidateCache, false);
                calls.push({ revoke: where });
                return { success: true, count: 1, cacheKeys: ["cache"] };
            },
            invalidateTokenCaches: async () => { calls.push("invalidate"); return { success: !cacheFailure }; },
            tokenCacheKeysForRecords: () => [],
        },
        getPolicy: async () => ({ roles: [], allow: [], deny: [] }),
        policyAllowsScope: (policy) => policy.allow?.includes("admin:manage"),
        getConfiguredAdmins: async () => configured,
        assignAdminRole: async () => { calls.push("assign-admin"); },
        revokeAdminRole: async () => { calls.push("revoke-admin"); },
        clearPolicyCache: () => { calls.push("policy-cache"); },
        cleanupData: async (_tx, id, categories, options) => {
            assert.equal(_tx, tx);
            calls.push({ cleanup: categories, permanent: options.permanent, id });
            return { counts: { posts: 1 }, tokenCacheRecords: [] };
        },
        summarizeData: async () => ({ categories: [], account: {} }),
    });
    return { service, calls, actor: self ? 7 : 1, state };
}

test("invalid user identifiers are rejected", () => {
    for (const id of [0, -1, "7bad", 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => requireUserId(id), { code: "INVALID_USER_ID" });
    }
});

test("safe DTOs exclude password and contact credential metadata", () => {
    const user = safeUser({ id: 7, password: "secret", contacts: [{ user_id: 7, contact_type: "totp", contact_value: "secret", metadata: { secret: "key" } }] });
    assert.equal(user.password, undefined);
    assert.equal(user.contacts[0].metadata, undefined);
    assert.equal(user.contacts[0].contact_value, "totp:7");
    assert.equal(safeContact({ contact_type: "email", contact_value: "x@example.com" }).contact_value, "x@example.com");
});

for (const protectedCase of [{ self: true }, { admin: true }, { configured: [7] }]) {
    test(`protected target rejects ban and cleanup: ${JSON.stringify(protectedCase)}`, async () => {
        const f = fixture(protectedCase);
        await assert.rejects(f.service.changeStatus(7, f.actor, "banned"), { status: 403 });
        await assert.rejects(f.service.cleanup(7, f.actor, { confirmUsername: "target", categories: ["posts"] }), { status: 403 });
        assert.equal(f.calls.includes("update"), false);
    });
}

test("banning via generic update revokes tokens inside tx and invalidates after commit", async () => {
    const f = fixture();
    const result = await f.service.update(7, 1, { status: "banned", password: "ignored", arbitrary: "ignored" });
    assert.equal(result.status, "banned");
    assert.equal(result.password, undefined);
    assert.deepEqual(f.calls.find((call) => call?.revoke), { revoke: { user_id: 7 } });
    assert.ok(f.calls.indexOf("invalidate") > f.calls.indexOf("commit"));
});

test("promotion cannot be combined with a non-active status", async () => {
    const f = fixture();
    await assert.rejects(f.service.update(7, 1, { type: "admin", status: "banned" }), { code: "ADMIN_STATUS_CONFLICT" });
    assert.equal(f.calls.includes("update"), false);
});

test("same-status disabled protected target cannot bypass revocation guard", async () => {
    const f = fixture({ admin: true });
    f.state.status = "banned";
    await assert.rejects(f.service.update(7, 1, { status: "banned" }), { code: "ADMIN_USER_PROTECTED" });
    assert.equal(f.calls.some((call) => call?.revoke), false);
});

test("self demotion through generic PUT cannot bypass role guard", async () => {
    const f = fixture({ self: true });
    f.state.type = "admin";
    await assert.rejects(f.service.update(7, 7, { type: "user" }), { code: "CANNOT_REMOVE_SELF_ADMIN" });
});

test("saving unchanged legacy type cannot silently revoke an assigned admin role", async () => {
    const f = fixture({ admin: true });
    await f.service.update(7, 1, { type: "user", display_name: "Renamed" });
    assert.equal(f.calls.includes("revoke-admin"), false);
});

test("session revoke is limited to requested user's session", async () => {
    const f = fixture();
    await f.service.revokeSessions(7, 1, 10);
    assert.deepEqual(f.calls.find((call) => call?.revoke), { revoke: { user_id: 7, type: "session", id: 10 } });
    await assert.rejects(f.service.revokeSessions(7, 1, 999), { code: "SESSION_NOT_FOUND" });
    await assert.rejects(f.service.revokeSessions(7, 7), { code: "SELF_SESSION_OPERATION_FORBIDDEN" });
});

test("cleanup requires exact current username and does not revoke credentials or delete user", async () => {
    const f = fixture();
    await assert.rejects(f.service.cleanup(7, 1, { confirmUsername: "wrong" }), { code: "USERNAME_CONFIRMATION_REQUIRED" });
    await f.service.cleanup(7, 1, { confirmUsername: "target", categories: ["posts"] });
    assert.equal(f.calls.some((call) => call?.revoke), false);
    assert.equal(f.calls.includes("delete-user"), false);
});

test("permanent deletion removes user after cleanup and keeps internal hashes out of response", async () => {
    const f = fixture();
    const result = await f.service.cleanup(7, 1, { confirmUsername: "target", confirmCommentSpaces: true }, true);
    const cleanupIndex = f.calls.findIndex((call) => call?.cleanup === undefined && call?.permanent === true);
    assert.ok(cleanupIndex >= 0);
    assert.ok(f.calls.indexOf("delete-user") > cleanupIndex);
    assert.equal(result.tokenCacheRecords, undefined);
    assert.equal(result.cacheKeys, undefined);
});

test("transaction failure does not invalidate caches or report success", async () => {
    const f = fixture({ failAudit: true });
    await assert.rejects(f.service.changeStatus(7, 1, "banned"), /audit failure/);
    assert.equal(f.calls.includes("commit"), false);
    assert.equal(f.calls.includes("invalidate"), false);
});

test("cache invalidation failure is a warning after successful database revocation", async () => {
    const f = fixture({ cacheFailure: true });
    const result = await f.service.changeStatus(7, 1, "banned");
    assert.equal(result.status, "banned");
    assert.equal(result.warnings.length, 1);
});
