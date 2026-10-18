import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";

const url = (path) => new URL(path, import.meta.url).href;
mock.module(url("../middleware/auth.js"), { namedExports: { needLogin: (req, res, next) => next() } });
mock.module(url("../services/logger.js"), { defaultExport: { error() {} } });
mock.module(url("../services/auth/delegationService.js"), { defaultExport: {} });
const { createDelegationsRouter } = await import("./router_delegations.js");
const state = {};
const service = {
    async listDelegations(actorId, context) {
        state.calls.push({ operation: "list", actorId, context });
        if (state.failure) throw state.failure;
        return { sent: [{ id: 1 }], received: [{ id: 2 }] };
    },
    async createDelegation(actorId, input, context) {
        state.calls.push({ operation: "create", actorId, input, context });
        return { id: 3, status: "pending" };
    },
    async respondToDelegation(actorId, delegationId, action, context) {
        state.calls.push({ operation: "respond", actorId, delegationId, action, context });
        return { id: Number(delegationId), status: { accept: "accepted", decline: "declined", revoke: "revoked" }[action] };
    },
};
let server, origin;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/delegations", createDelegationsRouter({ service, login(req, res, next) {
        if (req.headers["x-test-anonymous"]) return res.status(401).json({ status: "error", code: "ZC_ERROR_NEED_LOGIN" });
        res.locals.userid = 5;
        res.locals.tokenType = "personal";
        res.locals.scopes = ["project:7:read"];
        next();
    } }));
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => Object.assign(state, { calls: [], failure: null }));

test("GET /delegations preserves sent/received response contract", async () => {
    const response = await fetch(`${origin}/delegations`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "success", data: { sent: [{ id: 1 }], received: [{ id: 2 }] } });
    assert.equal(state.calls[0].actorId, 5);
});

test("POST /delegations forwards body and actual authentication context", async () => {
    const input = { delegate_id: 2, target_type: "project", target_id: "7", scopes: ["project:7:read"],
        expires_at: "2026-11-01T00:00:00Z", reason: "help", grantor_id: 999 };
    const response = await fetch(`${origin}/delegations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "success", data: { id: 3, status: "pending" } });
    assert.deepEqual(state.calls[0], { operation: "create", actorId: 5, input,
        context: { tokenType: "personal", tokenScopes: ["project:7:read"], delegationId: undefined } });
});

for (const action of ["accept", "decline", "revoke"]) {
    test(`POST /delegations/:id/${action} uses fixed route action and exposes header to reject redelegation`, async () => {
        const response = await fetch(`${origin}/delegations/11/${action}`, { method: "POST", headers: { "X-Zerocat-Delegation": "23" } });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).status, "success");
        assert.deepEqual(state.calls[0], { operation: "respond", actorId: 5, delegationId: "11", action,
            context: { tokenType: "personal", tokenScopes: ["project:7:read"], delegationId: "23" } });
    });
}

test("authentication is required and service errors retain status/code without private details", async () => {
    const anonymous = await fetch(`${origin}/delegations`, { headers: { "x-test-anonymous": "1" } });
    assert.equal(anonymous.status, 401);
    assert.equal(state.calls.length, 0);
    state.failure = Object.assign(new Error("readonly"), { status: 403, code: "ACCOUNT_READ_ONLY" });
    const denied = await fetch(`${origin}/delegations`);
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { status: "error", code: "ACCOUNT_READ_ONLY", message: "readonly" });
    state.failure = new Error("private database connection error");
    const failed = await fetch(`${origin}/delegations`);
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).code, "ZC_ERROR_INTERNAL_SERVER_ERROR");
});
