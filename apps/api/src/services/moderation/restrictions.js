import { prisma } from "../prisma.js";
import logger from "../logger.js";
import {
    ModerationError, categoryFor, isPublicMutation, normalizeCategories,
    optionalDate, positiveId, RESTRICTION_CATEGORIES,
} from "./policy.js";

export { RESTRICTION_CATEGORIES };

export function activeRestrictionWhere(type, category, now = new Date()) {
    return {
        ...(type ? { type } : {}),
        revoked_at: null,
        starts_at: { lte: now },
        AND: [
            { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
            ...(category ? [{ categories: { hasSome: ["*", categoryFor(category)] } }] : []),
        ],
    };
}

export async function getActiveRestrictions(userId, { db = prisma, type, category } = {}) {
    return db.ow_user_restrictions.findMany({
        where: { user_id: positiveId(userId), ...activeRestrictionWhere(type, category) },
        orderBy: { created_at: "desc" },
    });
}

export async function assertCanWrite(userId, category, action, { db = prisma } = {}) {
    if (!userId || !isPublicMutation(action)) return;
    const id = positiveId(userId);
    const user = await db.ow_users.findUnique({ where: { id }, select: { status: true } });
    if (!user || user.status !== "active") throw new ModerationError(403, "ACCOUNT_UNAVAILABLE", "账号当前不可用");
    const rule = await db.ow_user_restrictions.findFirst({
        where: { user_id: id, ...activeRestrictionWhere("readonly", category) },
        select: { id: true },
    });
    if (rule) throw new ModerationError(403, "ACCOUNT_READ_ONLY", "账号当前为只读状态，暂时无法执行此操作");
}

export async function getReadOnlyState(userId, { db = prisma } = {}) {
    const rules = await getActiveRestrictions(userId, { db, type: "readonly" });
    return {
        readonly: rules.some((rule) => rule.categories.includes("*")),
        restrictions: rules.map(({ id, categories, expires_at }) => ({ id, type: "readonly", categories, expires_at })),
    };
}

async function assertModerator(actorId, scope, options = {}) {
    const { authorize } = await import("../auth/authorization.js");
    const decision = await authorize({ userId: actorId, requiredScope: scope, tokenType: options.authorizationContext?.tokenType || "session",
        tokenScopes: options.authorizationContext?.tokenScopes || [], db: options.db });
    if (!decision.allowed) throw new ModerationError(decision.status || 403, decision.code, decision.message);
}

async function restrictionTransaction(db, work) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return await db.$transaction(work, { isolationLevel: "Serializable" }); }
        catch (error) {
            if (error.code !== "P2034") throw error;
            if (attempt === 2) throw new ModerationError(409, "RESTRICTION_OPERATION_CONFLICT", "限制正在变化，请刷新后重试");
        }
    }
}

export async function createRestriction(userId, actorId, input, options = {}) {
    const db = options.db || prisma;
    const id = positiveId(userId);
    const actor = positiveId(actorId);
    if (id === actor) throw new ModerationError(403, "SELF_OPERATION_FORBIDDEN", "不能在此限制自己的账号");
    if (!["readonly", "shadowban"].includes(input.type)) throw new ModerationError(400, "INVALID_RESTRICTION_TYPE", "无效的限制类型");
    const categories = normalizeCategories(input.categories);
    const startsAt = optionalDate(input.starts_at, "starts_at") || new Date();
    const expiresAt = optionalDate(input.expires_at);
    if (expiresAt && expiresAt <= startsAt) throw new ModerationError(400, "INVALID_RESTRICTION_EXPIRY", "到期时间必须晚于开始时间");
    const reason = String(input.reason || "").trim();
    if (!reason || reason.length > 1000) throw new ModerationError(400, "REASON_REQUIRED", "请填写不超过 1000 字的操作原因");
    const result = await restrictionTransaction(db, async (tx) => {
        await assertModerator(actorId, "admin:restrictions:manage", { ...options, db: tx });
        const user = await tx.ow_users.findUnique({ where: { id }, select: { id: true, type: true } });
        if (!user) throw new ModerationError(404, "USER_NOT_FOUND", "用户不存在");
        const { getUserPolicy, policyAllowsScope } = await import("../auth/policyEngine.js");
        const policy = await getUserPolicy(id, { db: tx, useCache: false });
        if (policy.valid === false) throw new ModerationError(403, "POLICY_UNAVAILABLE", "无法确认目标账号权限");
        const { default: zcconfig } = await import("../config/zcconfig.js");
        const admins = await zcconfig.get("security.adminusers");
        if (["admin", "administrator"].includes(user.type) || policyAllowsScope(policy, "admin:manage")
            || (Array.isArray(admins) && admins.map(String).includes(String(id)))) {
            throw new ModerationError(403, "ADMIN_USER_PROTECTED", "请先单独移除该用户的管理员身份");
        }
        const rule = await tx.ow_user_restrictions.create({ data: {
            user_id: id, type: input.type, categories, reason,
            starts_at: startsAt, expires_at: expiresAt, created_by: actor,
        } });
        await tx.ow_events.create({ data: {
            event_type: "user_restriction", actor_id: actor, target_type: "user", target_id: id,
            public: false, event_data: { action: "create", restriction_id: rule.id, type: input.type, categories, reason },
        } });
        return rule;
    });
    await invalidateModerationCaches(id);
    return result;
}

export async function revokeRestriction(restrictionId, actorId, options = {}) {
    const db = options.db || prisma;
    const result = await restrictionTransaction(db, async (tx) => {
        await assertModerator(actorId, "admin:restrictions:manage", { ...options, db: tx });
        const rule = await tx.ow_user_restrictions.findUnique({ where: { id: positiveId(restrictionId) } });
        if (!rule) throw new ModerationError(404, "RESTRICTION_NOT_FOUND", "限制不存在");
        if (rule.revoked_at) return rule;
        const updated = await tx.ow_user_restrictions.update({ where: { id: rule.id }, data: { revoked_at: new Date(), revoked_by: positiveId(actorId) } });
        await tx.ow_events.create({ data: {
            event_type: "user_restriction", actor_id: Number(actorId), target_type: "user", target_id: rule.user_id,
            public: false, event_data: { action: "revoke", restriction_id: rule.id },
        } });
        return updated;
    });
    await invalidateModerationCaches(result.user_id);
    return result;
}

export async function invalidateModerationCaches(userId) {
    const [{ default: memoryCache }, { clearUserPolicyCache }] = await Promise.all([
        import("../memoryCache.js"), import("../auth/policyEngine.js"),
    ]);
    memoryCache.cache.clear();
    if (userId) clearUserPolicyCache(userId);
    // Readers still apply live visibility predicates to cached candidates.
    try {
        const { default: redis } = await import("../redis.js");
        await redis.set("moderation:version", String(Date.now()));
    } catch (error) {
        logger.warn(`[moderation] 治理变更已提交，更新缓存版本失败: ${error.message}`);
    }
}
