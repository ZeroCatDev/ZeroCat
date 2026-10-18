import { isValidScope, parseScope, scopeSatisfies, userCanAccessResourceScope } from "./scopes.js";
import { getUserPolicy, policyAllowsScope, policyDeniesScope, resourcePolicyAllowsScope } from "./policyEngine.js";

const fail = (status, code, message, required, actorId) => ({
    allowed: false, status, code, message, required, actorId, principalId: actorId,
});

const CATEGORY = {
    project: "projects", blog: "blog", post: "posts", comment: "comments",
    list: "lists", follow: "relations", user: "profile", asset: "assets",
    event: "activity", extension: "extensions", git_sync: "projects",
};

export function createAuthorizer({ getUser, getPolicy, checkBoundary, assertWrite, checkVisibility,
    resolveDelegation = async () => ({ allowed: false }) }) {
    return async function authorize(context = {}) {
        const actorId = Number(context.actorId ?? context.userId ?? context.locals?.userid);
        const required = context.requiredScope ?? context.scope;
        const parsed = parseScope(required);
        if (!Number.isSafeInteger(actorId) || actorId <= 0) {
            return fail(401, "ZC_ERROR_NEED_LOGIN", "需要登录", required, null);
        }
        if (!isValidScope(required) || !parsed || parsed.wildcard || parsed.action === "*") {
            return fail(400, "ZC_ERROR_INVALID_SCOPE", "无效的权限要求", required, actorId);
        }
        const user = await getUser(actorId, { db: context.db });
        if (!user || user.status !== "active") {
            return fail(403, "ZC_ERROR_ACCOUNT_INACTIVE", "账号当前不可用", required, actorId);
        }
        const tokenType = context.tokenType ?? context.locals?.tokenType;
        const tokenScopes = context.tokenScopes ?? context.locals?.scopes ?? [];
        if (tokenType !== "session" && !scopeSatisfies(tokenScopes, required)) {
            return fail(403, "ZC_ERROR_INSUFFICIENT_SCOPE", "令牌权限不足", required, actorId);
        }
        try {
            await assertWrite(actorId, context.category ?? CATEGORY[parsed.resource] ?? parsed.resource,
                context.action ?? parsed.action, { db: context.db });
        } catch (error) {
            if (!error.status) throw error;
            return fail(error.status, error.code || "ZC_ERROR_READONLY", error.message, required, actorId);
        }
        const targetType = parsed.resource === "admin" ? null : parsed.resource;
        const policy = await getPolicy(actorId, { targetType, targetId: parsed.id, db: context.db });
        if (policy.valid === false) {
            return fail(403, "ZC_ERROR_POLICY_UNAVAILABLE", "无法确认账号权限", required, actorId);
        }
        if (policyDeniesScope(policy, required)) {
            return { ...fail(403, "ZC_ERROR_EXPLICIT_DENY", "权限被明确拒绝", required, actorId),
                sources: (policy.sources || []).filter((source) => source.effect === "deny"
                    && scopeSatisfies([source.scope], required)) };
        }
        let principalId = actorId;
        let delegated = null;
        if (context.delegationId !== undefined && context.delegationId !== null) {
            if (!context.allowDelegation) {
                return fail(403, "ZC_ERROR_DELEGATION_NOT_SUPPORTED", "此操作不支持授权委托", required, actorId);
            }
            delegated = await resolveDelegation({ ...context, actorId, requiredScope: required, tokenType, tokenScopes });
            if (!delegated?.allowed) {
                return { ...fail(delegated?.status || 403, delegated?.code || "ZC_ERROR_DELEGATION_FORBIDDEN",
                    delegated?.message || "授权委托不可用", required, actorId), sources: delegated?.sources || [] };
            }
            principalId = Number(delegated.principalId);
            if (!Number.isSafeInteger(principalId) || principalId <= 0) {
                return fail(403, "ZC_ERROR_DELEGATION_FORBIDDEN", "授权委托不可用", required, actorId);
            }
        }
        if (!delegated && !policyAllowsScope(policy, required)) {
            return fail(403, "ZC_ERROR_ROLE_POLICY_FORBIDDEN", "账号角色权限不足", required, actorId);
        }
        let resourceGrant = false;
        if (parsed.id !== null && parsed.resource !== "admin") {
            resourceGrant = !delegated && resourcePolicyAllowsScope(policy, required);
            const restoring = context.includeDeleted === true;
            if (restoring && (delegated || parsed.action !== "delete" || !["project", "post", "blog"].includes(parsed.resource))) {
                return fail(403, "ZC_ERROR_SCOPE_RESOURCE_FORBIDDEN", "无权恢复该资源", required, actorId);
            }
            // Restore visibility verifies the actual owner of the deleted canonical row.
            const boundary = restoring || Boolean(delegated) || resourceGrant
                || await checkBoundary(actorId, required, { db: context.db });
            if (!(await checkVisibility(parsed, actorId, { ...context, resourceGrant, principalId, ignorePrivacy: boundary }))) {
                return fail(404, "ZC_ERROR_NOT_FOUND", "资源不存在", required, actorId);
            }
            if (!boundary) return fail(403, "ZC_ERROR_SCOPE_RESOURCE_FORBIDDEN", "无权访问该资源", required, actorId);
        }
        return { allowed: true, status: 200, actorId, principalId, required, resourceGrant,
            delegationId: delegated ? context.delegationId : null,
            sources: [...(policy.sources || []).filter((source) => source.effect === "allow"
                && scopeSatisfies([source.scope], required)), ...(delegated?.sources || [])] };
    };
}

async function checkVisibility(parsed, actorId, options) {
    const { prisma: defaultDb } = await import("../prisma.js");
    const prisma = options.db || defaultDb;
    const { canViewContent } = await import("../moderation/visibility.js");
    const entries = {
        project: ["ow_projects", "project"], blog: ["ow_projects", "project"],
        post: ["ow_posts", "post"], list: ["ow_projects_lists", "list"],
        user: ["ow_users", "profile"], event: ["ow_events", "event"],
        asset: ["ow_assets", "asset"], extension: ["ow_scratch_extensions", "extension"],
    };
    if (parsed.resource === "comment") {
        const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid: String(parsed.id) } });
        if (space) {
            const { userPublicDataVisible } = await import("../moderation/visibility.js");
            return userPublicDataVisible(space.owner_id, "comments", actorId, { db: prisma });
        }
        const commentId = Number(parsed.id);
        if (!Number.isSafeInteger(commentId) || commentId <= 0) return false;
        const comment = await prisma.ow_comment_service.findUnique({ where: { id: commentId } });
        return Boolean(comment) && canViewContent("comment_service", comment, actorId, { db: prisma });
    }
    if (parsed.resource === "asset" && !/^\d+$/.test(String(parsed.id))) {
        const record = await prisma.ow_assets.findUnique({ where: { md5: String(parsed.id).replace(/\.[a-z0-9]+$/i, "") } });
        return Boolean(record) && canViewContent("asset", record, actorId, { db: prisma });
    }
    const entry = entries[parsed.resource];
    if (!entry) return true;
    const id = Number(parsed.id);
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    const record = await prisma[entry[0]].findUnique({ where: { id } });
    if (!record || (parsed.resource === "blog" && record.type !== "article")) return false;
    let visibleRecord = record;
    if (options.includeDeleted === true) {
        const ownerId = Number(parsed.resource === "post" ? record.author_id : record.authorid);
        if (parsed.action !== "delete" || ownerId !== actorId || options.principalId !== actorId
            || ["admin", "administrative"].includes(record.deletion_source) || !(record.deleted_at || record.is_deleted)) return false;
        // Only the deletion marker is ignored; actor-based shadowban visibility remains live.
        visibleRecord = { ...record, deleted_at: null, ...(parsed.resource === "post" ? { is_deleted: false } : {}) };
    }
    return canViewContent(entry[1], visibleRecord, actorId, {
        context: "public", ignorePrivacy: options.ignorePrivacy === true, db: prisma,
    });
}

export const authorize = createAuthorizer({
    async getUser(userId, { db } = {}) {
        const { prisma } = await import("../prisma.js");
        return (db || prisma).ow_users.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    },
    getPolicy: getUserPolicy,
    checkBoundary: userCanAccessResourceScope,
    async assertWrite(userId, category, action, options) {
        const { assertCanWrite } = await import("../moderation/visibility.js");
        return assertCanWrite(userId, category, action, options);
    },
    checkVisibility,
    async resolveDelegation(context) {
        const { authorizeDelegation } = await import("./delegationService.js");
        return authorizeDelegation(context);
    },
});

export async function can(context) {
    return (await authorize(context)).allowed;
}

export default { authorize, can, createAuthorizer };
