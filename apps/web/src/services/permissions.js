export function hasCapability(user, scope) {
  if (!Array.isArray(user?.capabilities)) return user?.isAdmin === true;
  const capabilities = user.capabilities;
  return capabilities.includes(scope);
}

export function canAccessAdmin(user) {
  return (!Array.isArray(user?.capabilities) && user?.isAdmin === true) || (user?.capabilities || []).some(scope => typeof scope === 'string' && scope.startsWith('admin:'));
}

export function adminPageCapability(path) {
  if (path === '/app/admin' || path === '/app/admin/') return null;
  if (path.startsWith('/app/admin/permissions')) return 'admin:permissions:read';
  if (path.startsWith('/app/admin/moderation')) return 'moderation';
  return 'admin:manage';
}

export function canAccessAdminPage(user, path) {
  const scope = adminPageCapability(path);
  if (!scope) return canAccessAdmin(user);
  if (scope === 'moderation') return ['admin:restrictions:read', 'admin:restrictions:manage', 'admin:content:manage', 'admin:hidden_content:read'].some(value => hasCapability(user, value));
  return hasCapability(user, scope);
}
