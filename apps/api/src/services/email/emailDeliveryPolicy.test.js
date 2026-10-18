import test, { beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const state = {};
const noop = () => {};
mock.module('../logger.js', { defaultExport: { info: noop, warn: noop, error: noop, debug: noop } });
mock.module('../prisma.js', { namedExports: { prisma: { ow_notifications: {
    findUnique: async ({ where }) => { state.ids.push(where.id); return state.notification; },
} } } });
mock.module('../../controllers/notifications.js', { namedExports: {
    notificationCanSend: async (notification, viewerId) => {
        state.checked.push({ notification, viewerId }); return state.allowed;
    },
} });
mock.module('bullmq', { namedExports: { Worker: class {
    constructor(queue, processor) { state.processor = processor; }
    on() {}
} } });
mock.module('../queue/redisConnectionFactory.js', { namedExports: { createConnection: async () => ({}) } });
mock.module('../queue/queues.js', { namedExports: { QUEUE_NAMES: { EMAIL: 'email' } } });
mock.module('../config/zcconfig.js', { defaultExport: { get: async () => false } });
mock.module('./emailSender.js', { namedExports: {
    getMailProvider: async () => 'amail',
    sendMail: async (delivery) => { state.sent.push(delivery); return { id: 'sent' }; },
} });
mock.module('nodemailer', { namedExports: { createTransport: () => { throw new Error('Unexpected SMTP initialization'); } } });
const { prepareEmailDelivery, emailDeliveryAllowed } = await import('./emailDeliveryPolicy.js');
const { createEmailWorker } = await import('../queue/workers/emailWorker.js');
const payload = () => ({ to: 'recipient@example.test', subject: 'old private title', html: 'old hidden body', notificationId: 17 });
const job = () => ({ data: payload(), log: async () => {} });
beforeEach(() => Object.assign(state, { notification: { id: 17, user_id: 9, actor_id: 3, target_type: 'post', target_id: 8 },
    ids: [], checked: [], allowed: true, sent: [], processor: null }));

test('current canonical notification governs direct and queued delivery eligibility', async () => {
    state.allowed = false;
    assert.equal(await emailDeliveryAllowed({ notificationId: 17 }), false);
    assert.equal(await prepareEmailDelivery(payload()), null);
    assert.equal(await prepareEmailDelivery(payload(), { queued: true }), null);
    assert.ok(state.checked.every(call => call.notification === state.notification && call.viewerId === 9));
});

test('a deleted canonical notification suppresses a queued snapshot', async () => {
    state.notification = null;
    assert.equal(await prepareEmailDelivery(payload(), { queued: true }), null);
    assert.deepEqual(state.checked, []);
});

test('community mail replaces historical profile and content snapshots with a generic notification', async () => {
    const delivery = await prepareEmailDelivery(payload(), { queued: true });
    assert.equal(delivery.to, payload().to);
    assert.equal(delivery.subject, '社区通知');
    assert.ok(!delivery.html.includes('old hidden body'));
    assert.equal(delivery.notificationId, 17);
});

test('legacy untraceable queue mail is suppressed while versioned transactional mail still sends', async () => {
    const transactional = { to: 'recipient@example.test', subject: 'login', html: 'verification code' };
    assert.equal(await prepareEmailDelivery(transactional, { queued: true }), null);
    assert.deepEqual(await prepareEmailDelivery({ ...transactional, deliveryVersion: 1 }, { queued: true }), { ...transactional, deliveryVersion: 1 });
    assert.deepEqual(await prepareEmailDelivery(transactional), transactional);
});

test('email worker reloads visibility at execution and never sends a revoked notification', async () => {
    await createEmailWorker();
    state.allowed = false;
    assert.deepEqual(await state.processor(job()), { skipped: true, reason: 'content_unavailable' });
    assert.deepEqual(state.sent, []);
});

test('email worker sends sanitized community mail after its live check', async () => {
    await createEmailWorker();
    await state.processor(job());
    assert.equal(state.sent.length, 1);
    assert.equal(state.sent[0].subject, '社区通知');
    assert.ok(!state.sent[0].html.includes('old hidden body'));
});
