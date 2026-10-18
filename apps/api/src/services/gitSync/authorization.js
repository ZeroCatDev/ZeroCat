import { authorize } from '../auth/authorization.js';
import { canViewContent } from '../moderation/visibility.js';
import { ModerationError } from '../moderation/policy.js';
import { prisma } from '../prisma.js';

export function syncAuthorizationContext(payload = {}) {
    const context = payload.authorizationContext || {};
    return {
        actorId: Number(payload.actorId),
        tokenType: context.tokenType,
        tokenScopes: Array.isArray(context.tokenScopes) ? context.tokenScopes : [],
    };
}

export async function assertSyncAuthorized(payload, project = null, { blog = false } = {}) {
    const context = syncAuthorizationContext(payload);
    if (context.actorId && (!context.tokenType || !Array.isArray(payload?.authorizationContext?.tokenScopes))) {
        throw new ModerationError(403, 'TOKEN_CONTEXT_REQUIRED', '缺少原始令牌权限');
    }
    const scopes = [{ requiredScope: 'git_sync:manage', category: 'projects' }];
    if (blog) scopes.push({ requiredScope: 'blog:update', category: 'blog' });
    if (project) {
        scopes.push({ requiredScope: `project:${project.id}:update`, category: 'projects' });
        if (project.type === 'article') {
            scopes.push({ requiredScope: `blog:${project.id}:update`, category: 'blog' });
        }
    }
    for (const scope of scopes) {
        const decision = await authorize({ ...context, ...scope, action: 'sync' });
        if (!decision.allowed) {
            throw new ModerationError(decision.status || 403, decision.code, decision.message);
        }
    }
    // Exporting a private project is supported, but moderation must not be bypassed by an external copy.
    if (project && !await canViewContent('project', project, null, { ignorePrivacy: true })) {
        throw new ModerationError(404, 'RESOURCE_NOT_FOUND', '内容不存在');
    }
    return context;
}

export async function assertBlogSyncAuthorized(payload, project) {
    await assertSyncAuthorized(payload, null, { blog: true });
    if (syncAuthorizationContext(payload).actorId !== Number(payload.userId)) {
        throw new ModerationError(403, 'BLOG_SYNC_OWNER_REQUIRED', '只能同步自己的博客');
    }
    if (!project || project.type !== 'article' || Number(project.authorid) !== Number(payload.userId)) {
        throw new ModerationError(404, 'RESOURCE_NOT_FOUND', '内容不存在');
    }
    return assertSyncAuthorized(payload, project);
}

export async function loadSyncProject(payload, { blog = false } = {}) {
    await assertSyncAuthorized(payload, null, { blog });
    const project = await prisma.ow_projects.findFirst({ where: { id: Number(payload.projectId) } });
    if (!project) throw new ModerationError(404, 'RESOURCE_NOT_FOUND', '内容不存在');
    if (blog) await assertBlogSyncAuthorized(payload, project);
    else await assertSyncAuthorized(payload, project);
    return project;
}

// Only internal moderation jobs may use this path; it never authorizes publishing other articles.
export async function moderationRemovalProject(payload, { db = prisma } = {}) {
    if (payload.systemModeration !== true) return null;
    const project = await db.ow_projects.findFirst({ where: { id: Number(payload.projectId) } });
    if (!project || project.type !== 'article' || Number(project.authorid) !== Number(payload.userId)) return null;
    return await canViewContent('project', project, null, { ignorePrivacy: true }) ? null : project;
}
