import test, { beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const state = { allowed: true, visible: true, anonymous: true, calls: [], writes: 0, reads: 0 };
const noop = () => {};
mock.module('./logger.js', { defaultExport: { info: noop, error: noop, warn: noop, debug: noop } });
mock.module('./redis.js', { defaultExport: {
    get client() { return state.redisClient || null; }, get isConnected() { return Boolean(state.redisClient); },
} });
mock.module('./auth/tokenService.js', { namedExports: { verifyToken: async () => ({ valid: state.tokenValid,
    user: { userid: 3 }, scopes: ['project:7:read'], tokenType: 'oauth' }) } });
mock.module('./auth/authorization.js', { namedExports: { authorize: async (context) => {
    state.calls.push(context); return { allowed: state.allowed && !state.deniedActors?.includes(context.actorId) && !state.deny?.(context) };
} } });
const publicDataVisible = (userId, category, viewerId) => Number(userId) === Number(viewerId)
    || !state.restrictions?.some(rule => rule.userId === userId && (rule.categories.includes('*') || rule.categories.includes(category)));
mock.module('./moderation/visibility.js', { namedExports: {
    canViewContent: async (kind, project, viewerId) => state.visible && publicDataVisible(project.authorid, 'projects', viewerId),
    userPublicDataVisible: async (userId, category, viewerId) => {
        state.publicChecks.push({ userId, category, viewerId });
        return publicDataVisible(userId, category, viewerId);
    },
} });
mock.module('./prisma.js', { namedExports: { prisma: {
    ow_projects: { findFirst: async () => ({ id: 7, authorid: 9, state: 'public', type: 'scratch' }) },
    ow_target_configs: { findMany: async () => [{ key: 'scratch.clouddata.anonymouswrite', value: state.anonymous }] },
    ow_cache_kv: {
        findUnique: async () => { state.reads++; state.onSnapshotRead?.(); return { value: state.vars || {} }; },
        upsert: async ({ update }) => { state.writes++; state.snapshots++; state.savedVars = update.value; },
    },
    ow_events: { create: async () => { state.writes++; state.events++; state.onEvent?.(); return { id: 1, created_at: new Date() }; } },
    project_clouddata_history: { create: async () => { state.writes++; state.history++; } },
} } });
const { processRawMessage } = await import('./scratchCloudWs.js');
function socket(userId = 3) {
    return { authUser: { userid: userId, username: 'actual-actor' }, authScopes: ['project:7:read'], tokenType: 'oauth',
        project: null, user: null, ip: '127.0.0.1', readyState: 1, sent: [], closed: [],
        send(message) { this.sent.push(message); }, close(code) { this.closed.push(code); this.readyState = 3; } };
}
const handshake = JSON.stringify({ method: 'handshake', project_id: 7, user: 'spoofed-owner' });
const write = JSON.stringify({ method: 'set', name: ':cloud: score', value: '123' });
beforeEach(() => Object.assign(state, { allowed: true, visible: true, anonymous: true, calls: [], writes: 0, reads: 0,
    onSnapshotRead: null, onEvent: null, deniedActors: [], vars: {}, deny: null, tokenValid: true,
    restrictions: [], publicChecks: [], snapshots: 0, events: 0, history: 0, savedVars: null, redisClient: null, redisWrites: 0 }));

test('anonymous-enabled cloud still checks authenticated actor token and live interact policy', async () => {
    const ws = socket();
    await processRawMessage(ws, handshake);
    assert.equal(ws.user.userid, 3);
    assert.equal(ws.user.username, 'actual-actor');
    state.deny = context => context.action === 'interact';
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assert.equal(state.writes, 0);
    assert.equal(state.calls.at(-1).requiredScope, 'project:7:interact');
    assert.equal(state.calls.at(-1).tokenType, 'oauth');
    assert.deepEqual(state.calls.at(-1).tokenScopes, ['project:7:read']);
});

test('moderation changes after handshake block writes before accessing cloud state', async () => {
    const ws = socket();
    await processRawMessage(ws, handshake);
    const reads = state.reads;
    state.visible = false;
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assert.equal(state.writes, 0);
    assert.equal(state.reads, reads);
});

test('anonymous readers cannot join a currently hidden project', async () => {
    state.visible = false;
    const ws = socket(); ws.authUser = null;
    await assert.rejects(processRawMessage(ws, handshake), { code: 4004 });
    assert.equal(state.reads, 0);
});

test('disabling anonymous writes takes effect for an existing anonymous socket', async () => {
    const ws = socket(); ws.authUser = null;
    await processRawMessage(ws, handshake);
    state.anonymous = false;
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assert.equal(state.writes, 0);
});

test('an initial snapshot cannot escape when moderation changes during its load', async () => {
    const ws = socket();
    state.vars = { ':cloud: score': '123' };
    state.onSnapshotRead = () => { state.visible = false; };
    await assert.rejects(processRawMessage(ws, handshake), { code: 4004 });
    assert.deepEqual(ws.sent, []);
});

test('broadcast rechecks each existing recipient current token policy', async () => {
    const source = socket(3);
    const recipient = socket(4);
    await processRawMessage(source, handshake);
    await processRawMessage(recipient, handshake);
    state.deniedActors = [4];
    await processRawMessage(source, write);
    assert.deepEqual(recipient.sent, []);
    assert.deepEqual(recipient.closed, [4004]);
});

test('moderation applied after a cloud write prevents stale broadcast to existing clients', async () => {
    const source = socket(3);
    const recipient = socket(5);
    await processRawMessage(source, handshake);
    await processRawMessage(recipient, handshake);
    state.onEvent = () => { state.visible = false; };
    await processRawMessage(source, write);
    assert.deepEqual(recipient.sent, []);
    assert.deepEqual(recipient.closed, [4004]);
});

test('revoking the original token blocks an existing socket before another write', async () => {
    const ws = socket(); ws.authToken = 'original-token';
    await processRawMessage(ws, handshake);
    state.tokenValid = false;
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assert.equal(state.writes, 0);
});

function assertNoPersistence() {
    assert.equal(state.snapshots, 0);
    assert.equal(state.events, 0);
    assert.equal(state.history, 0);
    assert.equal(state.redisWrites, 0);
}

for (const categories of [['projects'], ['*']]) {
    test(`${categories[0]} shadowban blocks writes to another visible project without persistence or broadcast`, async () => {
        const source = socket(3);
        const recipient = socket(6);
        await processRawMessage(source, handshake);
        await processRawMessage(recipient, handshake);
        state.restrictions = [{ userId: 3, categories }];
        const reads = state.reads;
        await assert.rejects(processRawMessage(source, write), { code: 4004 });
        assertNoPersistence();
        assert.equal(state.reads, reads);
        assert.deepEqual(recipient.sent, []);
        assert.deepEqual(state.publicChecks.at(-1), { userId: 3, category: 'projects', viewerId: null });
    });
}

test('a project-shadowbanned author can still write their own project without broadcasting to others', async () => {
    const owner = socket(9);
    const recipient = socket(7);
    await processRawMessage(owner, handshake);
    await processRawMessage(recipient, handshake);
    state.restrictions = [{ userId: 9, categories: ['projects'] }];
    await processRawMessage(owner, write);
    assert.equal(state.snapshots, 1);
    assert.equal(state.events, 1);
    assert.equal(state.history, 1);
    assert.deepEqual(recipient.sent, []);
    assert.deepEqual(recipient.closed, [4004]);
});

test('profile-only shadowban does not change project cloud write eligibility', async () => {
    const source = socket(3);
    const recipient = socket(8);
    await processRawMessage(source, handshake);
    await processRawMessage(recipient, handshake);
    state.restrictions = [{ userId: 3, categories: ['profile'] }];
    await processRawMessage(source, write);
    assert.equal(state.snapshots, 1);
    assert.equal(state.events, 1);
    assert.equal(state.history, 1);
    assert.equal(recipient.sent.length, 1);
    assert.equal(JSON.parse(recipient.sent[0]).value, '123');
});

for (const [name, message] of [
    ['set', write],
    ['rename', JSON.stringify({ method: 'rename', name: ':cloud: score', new_name: ':cloud: total' })],
    ['delete', JSON.stringify({ method: 'delete', name: ':cloud: score' })],
]) {
    test(`a shadowban applied while loading ${name} state is checked before the first persistence`, async () => {
        const source = socket(3);
        const recipient = socket(10);
        await processRawMessage(source, handshake);
        await processRawMessage(recipient, handshake);
        state.vars = { ':cloud: score': '5' };
        state.redisClient = {
            hgetall: async key => key.endsWith(':vars') ? {} : { anonymousWriteEnabled: 'true', historyEnabled: 'true' },
            hset: async () => { state.redisWrites++; },
        };
        state.onSnapshotRead = () => { state.restrictions = [{ userId: 3, categories: ['projects'] }]; };
        await assert.rejects(processRawMessage(source, message), { code: 4004 });
        assertNoPersistence();
        assert.deepEqual(state.vars, { ':cloud: score': '5' });
        assert.deepEqual(recipient.sent, []);
    });
}

test('an allowed write restores the full database snapshot to an empty Redis cache after authorization', async () => {
    const ws = socket();
    await processRawMessage(ws, handshake);
    state.vars = { ':cloud: existing': '5' };
    let cached;
    state.redisClient = {
        hgetall: async key => key.endsWith(':vars') ? {} : { anonymousWriteEnabled: 'true', historyEnabled: 'true' },
        hset: async (key, vars) => { state.redisWrites++; cached = structuredClone(vars); },
    };
    await processRawMessage(ws, write);
    assert.deepEqual(cached, { ':cloud: existing': '5', ':cloud: score': '123' });
    assert.deepEqual(state.savedVars, cached);
    assert.deepEqual(state.vars, { ':cloud: existing': '5' });
    assert.equal(state.redisWrites, 1);
});

test('write permission revoked during state loading is rechecked before persistence', async () => {
    const ws = socket();
    await processRawMessage(ws, handshake);
    state.onSnapshotRead = () => { state.deny = context => context.action === 'interact'; };
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assertNoPersistence();
});

test('current read denial blocks an existing socket even if interact remains allowed', async () => {
    const ws = socket();
    await processRawMessage(ws, handshake);
    state.deny = context => context.action === 'read';
    await assert.rejects(processRawMessage(ws, write), { code: 4004 });
    assert.equal(state.writes, 0);
});
