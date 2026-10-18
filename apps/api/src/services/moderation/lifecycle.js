import { prisma } from "../prisma.js";
import logger from "../logger.js";
import { ModerationError, optionalDate, positiveId } from "./policy.js";
import { assertCanWrite, invalidateModerationCaches } from "./restrictions.js";

function definition(kind) {
    if (kind === "post") return { table: "ow_posts", owner: "author_id", category: "posts" };
    if (kind === "project") return { table: "ow_projects", owner: "authorid", category: "projects" };
    throw new ModerationError(400, "INVALID_CONTENT_KIND", "内容类型必须为 post 或 project");
}

async function permission(actorId, scope, options = {}) {
    const { authorize } = await import("../auth/authorization.js");
    const context = options.authorizationContext || {};
    const delegationId = options.delegationId || context.delegationId;
    const result = await authorize({ userId: actorId, requiredScope: scope, tokenType: context.tokenType || "session",
        tokenScopes: context.tokenScopes || [], delegationId, db: options.db,
        includeDeleted: options.includeDeleted === true,
        allowDelegation: Boolean(delegationId) && context.allowDelegation !== false });
    if (!result.allowed) throw new ModerationError(result.status || 403, result.code, result.message);
    return result;
}

async function transaction(db, work) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return await db.$transaction(work, { isolationLevel: "Serializable" }); }
        catch (error) {
            if (error.code !== "P2034") throw error;
            if (attempt === 2) throw new ModerationError(409, "CONTENT_OPERATION_CONFLICT", "内容正在变化，请刷新后重试");
        }
    }
}

async function assertContentWrite(db, kind, record, actorId, action, principalId = actorId) {
    const categories = [definition(kind).category, ...(kind === "project" && record.type === "article" ? ["blog"] : [])];
    for (const userId of new Set([actorId, principalId])) {
        for (const category of categories) await assertCanWrite(userId, category, action, { db });
    }
}

async function adjustPostCounters(tx, post, restoring) {
    const amount = restoring ? 1 : -1;
    const updates = [];
    if (post.post_type === "reply" && post.in_reply_to_id) updates.push([post.in_reply_to_id, "reply_count"]);
    if (post.post_type === "retweet" && post.retweet_post_id) updates.push([post.retweet_post_id, "retweet_count"]);
    for (const [id, field] of updates) {
        await tx.ow_posts.updateMany({
            where: { id, ...(amount < 0 ? { [field]: { gt: 0 } } : {}) },
            data: { [field]: { increment: amount } },
        });
    }
}

async function audit(tx, kind, id, actorId, action, details) {
    await tx.ow_events.create({ data: {
        event_type: "content_moderation", actor_id: Number(actorId), target_type: kind, target_id: id,
        public: false, event_data: { action, ...details },
    } });
}

async function finish(kind, record, action) {
    const config = definition(kind);
    await invalidateModerationCaches(record[config.owner]);
    try {
        const [{ default: queue }, { default: gorse }] = await Promise.all([
            import("../queue/queueManager.js"), import("../gorse.js"),
        ]);
        if (kind === "post") {
            if (action !== "restore" && action !== "unshadowban") {
                await gorse.hidePost(record.id);
                if (action === "delete") await queue.enqueueSocialPostSync(record.author_id, record.id, "delete");
            }
        } else {
            await queue.enqueueProjectGorseSync(record.id, { reason: `moderation_${action}`, delayMs: 0 });
            if (record.type === "article" && ["delete", "shadowban"].includes(action)) {
                await queue.enqueueBlogSyncRemove(record.id, record.authorid, { reason: `moderation_${action}`, systemModeration: true });
            }
        }
    } catch (error) {
        logger.warn(`[moderation] 内容已更新，后台同步稍后重试 kind=${kind} id=${record.id}: ${error.message}`);
    }
}

export async function softDeleteContent(kind, contentId, actorId, options = {}) {
    const config = definition(kind);
    const id = positiveId(contentId);
    const actor = positiveId(actorId);
    const db = options.db || prisma;
    await assertCanWrite(actor, config.category, "delete", { db });
    const result = await transaction(db, async (tx) => {
        const current = await tx[config.table].findUnique({ where: { id } });
        if (!current) throw new ModerationError(404, "RESOURCE_NOT_FOUND", "内容不存在");
        const decision = await permission(actor, options.administrative ? "admin:content:manage" : `${kind}:${id}:delete`, {
            ...options, db: tx, includeDeleted: Boolean(current.deleted_at || current.is_deleted),
        });
        await assertContentWrite(tx, kind, current, actor, "delete", decision.principalId);
        if (current.deleted_at || current.is_deleted) return { current, changed: false };
        const record = await tx[config.table].update({ where: { id }, data: {
            ...(kind === "post" ? { is_deleted: true } : {}),
            deleted_at: new Date(), deleted_by: actor,
            deletion_source: options.administrative ? "admin" : "author",
            deletion_reason: String(options.reason || "").slice(0, 1000) || null,
        } });
        if (kind === "post") await adjustPostCounters(tx, current, false);
        await audit(tx, kind, id, actor, "delete", { reason: options.reason || "", administrative: !!options.administrative });
        return { current: record, changed: true };
    });
    if (result.changed) await finish(kind, result.current, "delete");
    return { id, deleted: true, changed: result.changed };
}

export async function restoreContent(kind, contentId, actorId, options = {}) {
    const config = definition(kind);
    const id = positiveId(contentId);
    const actor = positiveId(actorId);
    const db = options.db || prisma;
    await assertCanWrite(actor, config.category, "restore", { db });
    const result = await transaction(db, async (tx) => {
        const current = await tx[config.table].findUnique({ where: { id } });
        if (!current) throw new ModerationError(404, "RESOURCE_NOT_FOUND", "内容不存在");
        const decision = await permission(actor, options.administrative ? "admin:content:manage" : `${kind}:${id}:delete`, {
            ...options, db: tx, includeDeleted: Boolean(current.deleted_at || current.is_deleted),
        });
        if (!options.administrative) {
            if (Number(current[config.owner]) !== actor || ["admin", "administrative"].includes(current.deletion_source)) {
                throw new ModerationError(404, "RESOURCE_NOT_FOUND", "内容不存在");
            }
        }
        await assertContentWrite(tx, kind, current, actor, "restore", decision.principalId);
        if (!current.deleted_at && !current.is_deleted) return { current, changed: false };
        const record = await tx[config.table].update({ where: { id }, data: {
            ...(kind === "post" ? { is_deleted: false } : {}),
            deleted_at: null, deleted_by: null, deletion_source: null, deletion_reason: null,
        } });
        if (kind === "post") await adjustPostCounters(tx, current, true);
        await audit(tx, kind, id, actor, "restore", { administrative: !!options.administrative });
        return { current: record, changed: true };
    });
    if (result.changed) await finish(kind, result.current, "restore");
    return { id, restored: true, changed: result.changed };
}

export async function setContentShadowban(kind, contentId, actorId, hidden, options = {}) {
    const config = definition(kind);
    const id = positiveId(contentId);
    const actor = positiveId(actorId);
    const db = options.db || prisma;
    if (typeof hidden !== "boolean") throw new ModerationError(400, "INVALID_SHADOWBAN", "hidden 必须为布尔值");
    const expiresAt = optionalDate(options.expiresAt ?? options.expires_at);
    if (hidden && expiresAt && expiresAt <= new Date()) throw new ModerationError(400, "INVALID_EXPIRY", "到期时间必须晚于当前时间");
    const reason = String(options.reason || "").trim();
    if (hidden && (!reason || reason.length > 1000)) throw new ModerationError(400, "REASON_REQUIRED", "请填写不超过 1000 字的原因");
    const record = await transaction(db, async (tx) => {
        await permission(actor, "admin:content:manage", { ...options, db: tx });
        const current = await tx[config.table].findUnique({ where: { id } });
        if (!current) throw new ModerationError(404, "RESOURCE_NOT_FOUND", "内容不存在");
        const updated = await tx[config.table].update({ where: { id }, data: {
            is_shadowbanned: hidden, shadowban_expires_at: hidden ? expiresAt : null,
            shadowban_by: hidden ? actor : null, shadowban_reason: hidden ? reason : null,
        } });
        await audit(tx, kind, id, actor, hidden ? "shadowban" : "unshadowban", { reason, expires_at: expiresAt });
        return updated;
    });
    await finish(kind, record, hidden ? "shadowban" : "unshadowban");
    return { id, hidden };
}
