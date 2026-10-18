import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const url = path => new URL(path, import.meta.url).href;
const next = (_req, _res, done) => done();
mock.module(url('../middleware/auth.js'), { namedExports: { needLogin: next } });
mock.module(url('../middleware/scope.js'), { namedExports: {
    requireScope(required, options = {}) { return Object.assign(() => {}, { required, options }); },
    requireResource(resource, action, selector, options = {}) { return Object.assign(() => {}, { resource, action, selector, options }); },
} });
mock.module(url('../services/logger.js'), { defaultExport: {} });
mock.module(url('../controllers/notifications.js'), { defaultExport: {} });
mock.module(url('../services/prisma.js'), { namedExports: { prisma: {} } });
mock.module(url('../services/pushNotification.js'), { namedExports: {
    registerPushSubscription() {}, unregisterPushSubscription() {}, getUserPushSubscriptions() {},
} });
const { default: router } = await import('./router_notifications.js');
const guard = (method, path) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[1].handle;

for (const [method, path] of [
    ['post', '/mark-read'], ['put', '/read'], ['put', '/read_all'],
    ['post', '/register-browser'], ['delete', '/register-browser'], ['put', '/settings'], ['put', '/settings/bulk'],
]) {
    test(`${method.toUpperCase()} ${path} permits private state under readonly without losing token checks`, () => {
        const middleware = guard(method, path);
        assert.equal(middleware.options.action, 'private');
        assert.equal(middleware.required || `${middleware.resource}:${middleware.action}`, 'notification:update');
    });
}

for (const path of ['/send', '/send-enhanced']) {
    test(`POST ${path} remains a public mutation subject to readonly`, () => {
        const middleware = guard('post', path);
        assert.equal(middleware.required, 'notification:update');
        assert.equal(middleware.options.action, undefined);
    });
}
