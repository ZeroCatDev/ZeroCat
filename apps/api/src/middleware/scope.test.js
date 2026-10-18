import assert from "node:assert/strict";
import { mock, test } from "node:test";

const calls = [];
let result = { allowed: true, actorId: 3, principalId: 3 };
mock.module(new URL("../services/auth/authorization.js", import.meta.url).href, { namedExports: {
    async authorize(context) { calls.push(context); return result; },
} });
const { requireScope, requireResource } = await import("./scope.js");
function response() {
    return { locals: { userid: 3, tokenType: "session", scopes: [] }, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } };
}

test("scope middleware passes session and preserves actor/principal result", async () => {
    calls.length = 0;
    const res = response();
    let advanced = false;
    await requireScope("project:7:update")({ headers: {} }, res, () => { advanced = true; });
    assert.equal(advanced, true);
    assert.equal(calls[0].tokenType, "session");
    assert.deepEqual(calls[0].tokenScopes, []);
    assert.equal(res.locals.userid, 3);
    assert.equal(res.locals.authorization.actorId, 3);
});

test("missing selected instance id fails closed before authorization", async () => {
    calls.length = 0;
    const res = response();
    await requireResource("project", "delete", "id")({ headers: {}, params: {} }, res, () => assert.fail("must deny"));
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

test("empty explicit requirements fail closed", async () => {
    for (const requirement of [[], "", undefined]) {
        const res = response();
        await requireScope(requirement)({ headers: {} }, res, () => assert.fail("must deny"));
        assert.equal(res.statusCode, 400);
    }
});

test("denied decisions return stable status and code and do not call next", async () => {
    result = { allowed: false, status: 403, code: "ZC_ERROR_EXPLICIT_DENY", message: "拒绝", required: "post:delete" };
    const res = response();
    await requireScope("post:delete")({ headers: {} }, res, () => assert.fail("must deny"));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "ZC_ERROR_EXPLICIT_DENY");
    result = { allowed: true, actorId: 3, principalId: 3 };
});

test("private state override retains original token and resource requirement", async () => {
    calls.length = 0;
    const res = response();
    res.locals.tokenType = "personal";
    res.locals.scopes = ["notification:update"];
    await requireResource("notification", "update", "id", { action: "private" })({ params: { id: 7 }, headers: {} }, res, () => {});
    assert.equal(calls[0].requiredScope, "notification:7:update");
    assert.equal(calls[0].action, "private");
    assert.equal(calls[0].tokenType, "personal");
    assert.deepEqual(calls[0].tokenScopes, ["notification:update"]);
});

test("delegation header does not replace current actor and route must opt in", async () => {
    calls.length = 0;
    const res = response();
    await requireResource("project", "update", "id", { allowDelegation: true })({ params: { id: 7 }, headers: { "x-zerocat-delegation": "9" } }, res, () => {});
    assert.equal(calls[0].userId, 3);
    assert.equal(calls[0].delegationId, "9");
    assert.equal(calls[0].allowDelegation, true);
});
