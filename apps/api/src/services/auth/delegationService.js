import { prisma } from "../prisma.js";
import { isValidScope, parseScope, scopeSatisfies } from "./scopes.js";
import { getUserPolicy, policyAllowsScope, policyDeniesScope } from "./policyEngine.js";

const TYPES = new Set(["project", "post", "comment", "list", "blog"]);
const ACTIONS = new Set(["read", "update", "delete", "interact"]);
const CATEGORY = { project: "projects", post: "posts", comment: "comments", list: "lists", blog: "blog" };
const FIELDS = {
    id: true, grantor_id: true, delegate_id: true, target_type: true, target_id: true,
    scopes: true, status: true, reason: true, expires_at: true, accepted_at: true,
    revoked_at: true, created_at: true, updated_at: true,
};

export class DelegationError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function error(status, code, message) { throw new DelegationError(status, code, message); }
function id(value) {
    if (!["number", "string"].includes(typeof value) || !/^\d+$/.test(String(value))) {
        error(400, "ZC_ERROR_INVALID_ID", "无效 ID");
    }
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result <= 0) error(400, "ZC_ERROR_INVALID_ID", "无效 ID");
    return result;
}
function target(type, value) {
    if (!TYPES.has(type) || !["number", "string"].includes(typeof value)) {
        error(400, "ZC_ERROR_INVALID_DELEGATION_TARGET", "不支持此委托资源");
    }
    const targetId = String(value);
    if (!targetId || targetId.length > 64 || /[\s:*]/.test(targetId)) {
        error(400, "ZC_ERROR_INVALID_DELEGATION_TARGET", "无效委托资源");
    }
    if (type !== "comment" || /^\d+$/.test(targetId)) {
        if (String(id(targetId)) !== targetId) error(400, "ZC_ERROR_INVALID_DELEGATION_TARGET", "无效委托资源 ID");
    }
    return { targetType: type, targetId };
}
function scopesFor(values, targetType, targetId) {
    if (!Array.isArray(values) || !values.length || values.length > ACTIONS.size) {
        error(400, "ZC_ERROR_INVALID_DELEGATION_SCOPES", "请指定具体资源的委托权限");
    }
    for (const scope of values) {
        const parsed = parseScope(scope);
        if (!isValidScope(scope) || scope !== `${targetType}:${targetId}:${parsed?.action}`
            || parsed.resource !== targetType || parsed.id !== targetId || !ACTIONS.has(parsed.action)) {
            error(400, "ZC_ERROR_INVALID_DELEGATION_SCOPES", "委托仅支持具体资源的查看、修改、删除和互动权限");
        }
    }
    return [...new Set(values)];
}
function expiration(value, now) {
    if (value === undefined || value === null || value === "") return null;
    if (!(typeof value === "string" || value instanceof Date)) error(400, "ZC_ERROR_INVALID_EXPIRATION", "无效到期时间");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date <= now) error(400, "ZC_ERROR_INVALID_EXPIRATION", "到期时间必须晚于当前时间");
    return date;
}
function publicRecord(record) {
    return Object.fromEntries(Object.keys(FIELDS).map((key) => [key, record[key] ?? null]));
}
function assertNoDelegation(context) {
    if (context.delegationId !== undefined && context.delegationId !== null) {
        error(403, "ZC_ERROR_REDELEGATION_FORBIDDEN", "不能使用委托权限继续转委托");
    }
}
function assertToken(context, scopes) {
    if (context.tokenType !== "session" && scopes.some((scope) => !scopeSatisfies(context.tokenScopes || [], scope))) {
        error(403, "ZC_ERROR_INSUFFICIENT_SCOPE", "令牌权限不足");
    }
}
function assertPolicy(policy, scope, requireAllow) {
    if (!policy || policy.valid === false) error(403, "ZC_ERROR_POLICY_UNAVAILABLE", "无法确认账号权限");
    if (policyDeniesScope(policy, scope)) error(403, "ZC_ERROR_EXPLICIT_DENY", "权限被明确拒绝");
    if (requireAllow && !policyAllowsScope(policy, scope)) error(403, "ZC_ERROR_ROLE_POLICY_FORBIDDEN", "账号角色权限不足");
}

async function ownedResource(db, targetType, targetId) {
    if (targetType === "comment") {
        if (!/^\d+$/.test(targetId)) {
            const space = await db.ow_comment_spaces.findUnique({ where: { cuid: targetId } });
            return space?.status === "active" ? { ownerId: space.owner_id } : null;
        }
        const comment = await db.ow_comment_service.findUnique({ where: { id: id(targetId) } });
        return comment && { ownerId: comment.account_user_id };
    }
    const tables = { project: "ow_projects", blog: "ow_projects", post: "ow_posts", list: "ow_projects_lists" };
    const record = await db[tables[targetType]].findUnique({ where: { id: id(targetId) } });
    if (!record || record.deleted_at || record.is_deleted || (targetType === "blog" && record.type !== "article")) return null;
    return { ownerId: targetType === "post" ? record.author_id : record.authorid,
        article: record.type === "article" };
}

export function createDelegationService({ db, getPolicy = getUserPolicy, now = () => new Date(),
    assertWrite = async (userId, category, action, tx) => {
        const { assertCanWrite } = await import("../moderation/restrictions.js");
        await assertCanWrite(userId, category, action, { db: tx });
    } }) {
    async function transaction(work) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await db.$transaction(work, { isolationLevel: "Serializable", timeout: 30000, maxWait: 5000 });
            } catch (cause) {
                if (cause.code !== "P2034") throw cause;
                if (attempt === 2) error(409, "ZC_ERROR_DELEGATION_CONFLICT", "委托正在变化，请刷新后重试");
            }
        }
    }
    async function activeUser(tx, userId) {
        const user = await tx.ow_users.findUnique({ where: { id: id(userId) }, select: { id: true, status: true } });
        if (!user || user.status !== "active") error(403, "ZC_ERROR_ACCOUNT_INACTIVE", "账号当前不可用");
    }
    async function authority(tx, record, scopes, { guardCreation = false } = {}) {
        const { targetType, targetId } = target(record.target_type, record.target_id);
        await activeUser(tx, record.grantor_id);
        await activeUser(tx, record.delegate_id);
        const resource = await ownedResource(tx, targetType, targetId);
        if (!resource || Number(resource.ownerId) !== record.grantor_id) {
            error(403, "ZC_ERROR_DELEGATION_OWNER_REQUIRED", "委托人不再拥有该资源");
        }
        const options = { db: tx, targetType, targetId };
        const grantorPolicy = await getPolicy(record.grantor_id, options);
        const delegatePolicy = await getPolicy(record.delegate_id, options);
        for (const scope of scopes) {
            assertPolicy(grantorPolicy, scope, true);
            assertPolicy(delegatePolicy, scope, false);
            const action = guardCreation ? "update" : parseScope(scope).action;
            const categories = [...new Set([CATEGORY[targetType],
                ...(resource.article ? ["projects", "blog"] : [])])];
            for (const category of categories) {
                await assertWrite(record.grantor_id, category, action, tx);
                await assertWrite(record.delegate_id, category, action, tx);
            }
        }
    }
    async function audit(tx, actorId, record, action) {
        await tx.ow_events.create({ data: {
            actor_id: actorId, event_type: "permission_delegation", public: false,
            target_type: "delegation", target_id: record.id,
            event_data: { action, grantor_id: record.grantor_id, delegate_id: record.delegate_id,
                target_type: record.target_type, target_id: record.target_id, scopes: record.scopes,
                expires_at: record.expires_at?.toISOString() || null, reason: record.reason || null },
        } });
    }
    function assertPending(record) {
        if (record.status !== "pending" || record.revoked_at || record.accepted_at) {
            error(409, "ZC_ERROR_DELEGATION_NOT_PENDING", "委托不再等待接受");
        }
        if (record.expires_at && new Date(record.expires_at) <= now()) {
            error(403, "ZC_ERROR_DELEGATION_EXPIRED", "委托已过期");
        }
    }

    return {
        async createDelegation(actorId, input = {}, context = {}) {
            assertNoDelegation(context);
            const grantorId = id(actorId), delegateId = id(input.delegate_id);
            if (grantorId === delegateId) error(400, "ZC_ERROR_DELEGATION_SELF", "不能向自己发起委托");
            const { targetType, targetId } = target(input.target_type, input.target_id);
            const scopes = scopesFor(input.scopes, targetType, targetId);
            const expiresAt = expiration(input.expires_at, now());
            if (input.reason != null && (typeof input.reason !== "string" || input.reason.length > 1000)) {
                error(400, "ZC_ERROR_INVALID_REASON", "原因不能超过 1000 字");
            }
            assertToken(context, scopes);
            const data = { grantor_id: grantorId, delegate_id: delegateId, target_type: targetType,
                target_id: targetId, scopes, status: "pending", expires_at: expiresAt, reason: input.reason?.trim() || null };
            return transaction(async (tx) => {
                if (expiresAt && expiresAt <= now()) error(400, "ZC_ERROR_INVALID_EXPIRATION", "到期时间必须晚于当前时间");
                await authority(tx, data, scopes, { guardCreation: true });
                const record = await tx.ow_permission_delegations.create({ data });
                await audit(tx, grantorId, record, "create");
                return publicRecord(record);
            });
        },
        async respondToDelegation(actorId, delegationId, action, context = {}) {
            assertNoDelegation(context);
            const actor = id(actorId), delegation = id(delegationId);
            if (!["accept", "decline", "revoke"].includes(action)) error(400, "ZC_ERROR_INVALID_DELEGATION_ACTION", "无效委托操作");
            return transaction(async (tx) => {
                await activeUser(tx, actor);
                const record = await tx.ow_permission_delegations.findUnique({ where: { id: delegation } });
                if (!record || ![record.grantor_id, record.delegate_id].includes(actor)) {
                    error(404, "ZC_ERROR_DELEGATION_NOT_FOUND", "委托不存在");
                }
                if (action !== "revoke" && record.delegate_id !== actor) {
                    error(403, "ZC_ERROR_DELEGATION_RECIPIENT_REQUIRED", "只有受托人可以接受或拒绝委托");
                }
                if (action === "accept") {
                    assertPending(record);
                    const { targetType, targetId } = target(record.target_type, record.target_id);
                    const scopes = scopesFor(record.scopes, targetType, targetId);
                    assertToken(context, scopes);
                    await authority(tx, record, scopes, { guardCreation: true });
                } else {
                    assertToken(context, ["user:update"]);
                    assertPolicy(await getPolicy(actor, { db: tx }), "user:update", false);
                    // Removing authority stays available when a participant becomes readonly.
                    if (action === "decline" && record.status !== "pending") {
                        error(409, "ZC_ERROR_DELEGATION_NOT_PENDING", "委托不再等待接受");
                    }
                    if (action === "revoke" && record.status === "revoked") return publicRecord(record);
                    if (action === "revoke" && !["pending", "accepted"].includes(record.status)) {
                        error(409, "ZC_ERROR_DELEGATION_INACTIVE", "委托已结束");
                    }
                }
                const updated = await tx.ow_permission_delegations.update({ where: { id: delegation }, data: {
                    status: { accept: "accepted", decline: "declined", revoke: "revoked" }[action],
                    ...(action === "accept" ? { accepted_at: now() } : action === "revoke" ? { revoked_at: now() } : {}),
                } });
                await audit(tx, actor, updated, action);
                return publicRecord(updated);
            });
        },
        async authorizeDelegation(context = {}) {
            try {
                const actor = id(context.actorId ?? context.userId ?? context.locals?.userid);
                const delegation = id(context.delegationId);
                const required = context.requiredScope ?? context.scope;
                const parsed = parseScope(required);
                if (!parsed || parsed.id === null) error(403, "ZC_ERROR_DELEGATION_FORBIDDEN", "委托仅限指定资源操作");
                const { targetType, targetId } = target(parsed.resource, parsed.id);
                scopesFor([required], targetType, targetId);
                if (context.allowDelegation !== true) error(403, "ZC_ERROR_DELEGATION_NOT_SUPPORTED", "此操作不支持授权委托");
                assertToken({ tokenType: context.tokenType ?? context.locals?.tokenType,
                    tokenScopes: context.tokenScopes ?? context.locals?.scopes }, [required]);
                const work = async (tx) => {
                    const record = await tx.ow_permission_delegations.findUnique({ where: { id: delegation } });
                    if (!record || record.delegate_id !== actor) error(403, "ZC_ERROR_DELEGATION_FORBIDDEN", "授权委托不可用");
                    if (record.status !== "accepted" || !record.accepted_at || record.revoked_at) {
                        error(403, "ZC_ERROR_DELEGATION_INACTIVE", "委托尚未接受或已撤销");
                    }
                    if (record.expires_at && new Date(record.expires_at) <= now()) error(403, "ZC_ERROR_DELEGATION_EXPIRED", "委托已过期");
                    const resource = target(record.target_type, record.target_id);
                    const scopes = scopesFor(record.scopes, resource.targetType, resource.targetId);
                    if (resource.targetType !== targetType || resource.targetId !== targetId || !scopes.includes(required)) {
                        error(403, "ZC_ERROR_DELEGATION_SCOPE_FORBIDDEN", "操作超出委托范围");
                    }
                    await authority(tx, record, [required]);
                    return { allowed: true, principalId: record.grantor_id, status: 200, code: null, message: null,
                        sources: [{ source: "delegation", effect: "allow", scope: required, delegation_id: record.id,
                            grantor_id: record.grantor_id, delegate_id: actor, target_type: targetType,
                            target_id: targetId, expires_at: record.expires_at }] };
                };
                return await (context.db ? work(context.db) : transaction(work));
            } catch (cause) {
                if (!cause.status) throw cause;
                return { allowed: false, principalId: null, sources: [], status: cause.status, code: cause.code, message: cause.message };
            }
        },
        async listDelegations(actorId, context = {}) {
            assertNoDelegation(context);
            const actor = id(actorId);
            await activeUser(db, actor);
            assertToken(context, ["user:read"]);
            assertPolicy(await getPolicy(actor, { db }), "user:read", true);
            const rows = await db.ow_permission_delegations.findMany({
                where: { OR: [{ grantor_id: actor }, { delegate_id: actor }] },
                select: FIELDS, orderBy: [{ created_at: "desc" }, { id: "desc" }],
            });
            return { sent: rows.filter((record) => record.grantor_id === actor).map(publicRecord),
                received: rows.filter((record) => record.delegate_id === actor).map(publicRecord) };
        },
    };
}

const service = createDelegationService({ db: prisma });
export const listDelegations = (...args) => service.listDelegations(...args);
export const createDelegation = (...args) => service.createDelegation(...args);
export const respondToDelegation = (...args) => service.respondToDelegation(...args);
export const authorizeDelegation = (...args) => service.authorizeDelegation(...args);
export default service;
