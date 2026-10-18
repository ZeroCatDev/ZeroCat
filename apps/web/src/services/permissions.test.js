import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCapability, canAccessAdmin, canAccessAdminPage } from './permissions.js';

test('effective capability list does not expand admin:manage over an explicit module denial', () => {
  const user = { isAdmin: true, capabilities: ['admin:manage', 'admin:restrictions:read'] };
  assert.equal(hasCapability(user, 'admin:manage'), true);
  assert.equal(hasCapability(user, 'admin:permissions:manage'), false);
  assert.equal(canAccessAdminPage(user, '/app/admin/permissions'), false);
  assert.equal(canAccessAdminPage(user, '/app/admin/moderation'), true);
});

test('specialist reviewers enter only their module', () => {
  const user = { capabilities: ['admin:hidden_content:read'] };
  assert.equal(canAccessAdmin(user), true);
  assert.equal(canAccessAdminPage(user, '/app/admin'), true);
  assert.equal(canAccessAdminPage(user, '/app/admin/moderation'), true);
  assert.equal(canAccessAdminPage(user, '/app/admin/config'), false);
});

test('capability snapshot is authoritative even when the legacy admin flag is true', () => {
  assert.equal(canAccessAdmin({ isAdmin: true, capabilities: [] }), false);
  assert.equal(hasCapability({ isAdmin: true, capabilities: [] }, 'admin:manage'), false);
  assert.equal(hasCapability({ isAdmin: true }, 'admin:manage'), true);
  assert.equal(canAccessAdmin(undefined), false);
});
