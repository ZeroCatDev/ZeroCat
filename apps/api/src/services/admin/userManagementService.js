import { cleanupUserData, getUserDataSummary } from "./userDataCleanup.js";

export const USER_FIELDS = {
    id: true, username: true, display_name: true, email: true, status: true, type: true,
    avatar: true, images: true, bio: true, motto: true, location: true, region: true,
    birthday: true, sex: true, url: true, custom_status: true, featured_projects: true,
    label: true, regTime: true, loginTime: true, createdAt: true, updatedAt: true,
};

export const CONTACT_FIELDS = {
    contact_id: true, user_id: true, contact_type: true, contact_value: true,
    is_primary: true, verified: true, created_at: true, updated_at: true,
};

export const SESSION_FIELDS = {
    id: true, type: true, name: true, device_info: true, user_agent: true,
    last_used_ip: true, ip_address: true, last_used_at: true, created_at: true,
    expires_at: true, refresh_expires_at: true, activity_count: true,
};

const STATUSES = new Set(["active", "suspended", "banned", "pending"]);
const ADMIN_TYPES = new Set(["admin", "administrator"]);
const EDITABLE_FIELDS = new Set(Object.keys(USER_FIELDS).filter((key) => ![
    "id", "regTime", "loginTime", "createdAt", "updatedAt",
].includes(key)));

export class UserManagementError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function requireUserId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new UserManagementError(400, "INVALID_USER_ID", "无效用户 ID");
    }
    return id;
}

export function safeContact(contact) {
    const result = Object.fromEntries(Object.keys(CONTACT_FIELDS).map((key) => [key, contact[key]]));
    if (["totp", "passkey"].includes(contact.contact_type)) {
        result.contact_value = `${contact.contact_type}:${contact.user_id}`;
    }
    return result;
}

export function safeUser(user) {
    if (!user) return user;
    const result = Object.fromEntries(Object.keys(USER_FIELDS).map((key) => [key, user[key]]));
    if (user.contacts) result.contacts = user.contacts.map(safeContact);
    return result;
}

function validateStatus(status) {
    if (!STATUSES.has(status)) {
        throw new UserManagementError(400, "INVALID_USER_STATUS", "无效用户状态");
    }
}

export function createUserManagementService({
    db, tokens, policyAllowsScope, getConfiguredAdmins,
    assignAdminRole, revokeAdminRole, clearPolicyCache, afterCleanup = async () => [],
    cleanupData = cleanupUserData, summarizeData = getUserDataSummary,
}) {
    async function transaction(work) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await db.$transaction(work, { isolationLevel: "Serializable", timeout: 30000, maxWait: 5000 });
            } catch (error) {
                if (error.code !== "P2034") throw error;
                if (attempt === 2) {
                    throw new UserManagementError(409, "USER_OPERATION_CONFLICT", "用户数据正在变化，请刷新后重试");
                }
            }
        }
    }

    async function findUser(userId, client = db) {
        const user = await client.ow_users.findUnique({ where: { id: requireUserId(userId) }, select: USER_FIELDS });
        if (!user) throw new UserManagementError(404, "USER_NOT_FOUND", "用户不存在");
        return user;
    }

    async function protections(user, actorId, client = db, configuredAdmins = null) {
        const [configured, assignments] = await Promise.all([
            configuredAdmins ?? getConfiguredAdmins(),
            client.ow_user_roles.findMany({
                where: { user_id: user.id, target_type: "global", OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
                select: { role: { select: { key: true, permissions: { select: { scope: true, effect: true } } } } },
            }),
        ]);
        const assignedAdmin = assignments.some(({ role }) => role.key === "admin"
            || role.permissions.some((permission) => permission.effect === "allow"
                && policyAllowsScope({ allow: [permission.scope], deny: [], roles: [] }, "admin:manage")));
        const self = user.id === Number(actorId);
        const admin = assignedAdmin || ADMIN_TYPES.has(String(user.type).toLowerCase())
            || (Array.isArray(configured) && configured.map(String).includes(String(user.id)));
        return {
            self, admin, canManage: !self && !admin,
            reason: self ? "不能在此封禁、清理或删除自己的账号" : admin ? "请先单独移除该用户的管理员身份" : "",
        };
    }

    async function assertManageable(user, actorId, client = db, configuredAdmins = null) {
        const protection = await protections(user, actorId, client, configuredAdmins);
        if (!protection.canManage) {
            throw new UserManagementError(403, protection.self ? "SELF_OPERATION_FORBIDDEN" : "ADMIN_USER_PROTECTED", protection.reason);
        }
    }

    function confirmUser(user, confirmUsername) {
        if (typeof confirmUsername !== "string" || confirmUsername !== user.username) {
            throw new UserManagementError(400, "USERNAME_CONFIRMATION_REQUIRED", "请输入当前用户名以确认操作");
        }
    }

    async function revokeInTransaction(tx, where) {
        const result = await tokens.revokeTokensWhere(where, { db: tx, invalidateCache: false });
        if (!result.success) throw new UserManagementError(500, "TOKEN_REVOCATION_FAILED", "撤销凭据失败，操作已取消");
        return result;
    }

    async function finish(cacheKeys, userId) {
        const warnings = [];
        if (cacheKeys.length) {
            const result = await tokens.invalidateTokenCaches(cacheKeys);
            if (!result.success) warnings.push("操作已完成，部分令牌缓存清理失败；旧令牌仍已失效");
        }
        clearPolicyCache(userId);
        return warnings;
    }

    async function audit(tx, actorId, userId, action, details) {
        await tx.ow_events.create({ data: {
            event_type: "admin_user_management", actor_id: Number(actorId),
            target_type: "user", target_id: userId, public: false,
            event_data: { action, ...details },
        } });
    }

    return {
        findUser,
        protections,
        async update(userId, actorId, input) {
            const id = requireUserId(userId);
            const updates = Object.fromEntries(Object.entries(input).filter(([key]) => EDITABLE_FIELDS.has(key)));
            if (Object.hasOwn(updates, "status")) validateStatus(updates.status);
            const existing = await findUser(id);
            const configuredAdmins = await getConfiguredAdmins();
            const requiresProtection = (user) => updates.status && (updates.status !== user.status || updates.status !== "active");
            if (requiresProtection(existing)) await assertManageable(existing, actorId, db, configuredAdmins);
            if (Object.hasOwn(updates, "type")) {
                if (!["guest", "user", "admin", "administrator"].includes(updates.type)) {
                    throw new UserManagementError(400, "INVALID_USER_TYPE", "无效用户类型");
                }
                if (id === Number(actorId) && updates.type !== existing.type && !ADMIN_TYPES.has(updates.type)) {
                    throw new UserManagementError(403, "CANNOT_REMOVE_SELF_ADMIN", "不能在当前会话中移除自己的管理员权限");
                }
            }
            if (ADMIN_TYPES.has(updates.type) && (updates.status || existing.status) !== "active") {
                throw new UserManagementError(400, "ADMIN_STATUS_CONFLICT", "请先恢复账号为活跃状态，再单独授予管理员身份");
            }
            const result = await transaction(async (tx) => {
                const current = await findUser(id, tx);
                if (requiresProtection(current)) await assertManageable(current, actorId, tx, configuredAdmins);
                if (ADMIN_TYPES.has(updates.type) && (updates.status || current.status) !== "active") {
                    throw new UserManagementError(400, "ADMIN_STATUS_CONFLICT", "请先恢复账号为活跃状态，再单独授予管理员身份");
                }
                const revocation = updates.status && updates.status !== "active"
                    ? await revokeInTransaction(tx, { user_id: id }) : { count: 0, cacheKeys: [] };
                const user = await tx.ow_users.update({
                    where: { id }, data: { ...updates, updatedAt: new Date() }, select: USER_FIELDS,
                });
                if (Object.hasOwn(updates, "type") && updates.type !== current.type) {
                    if (ADMIN_TYPES.has(updates.type)) await assignAdminRole(id, actorId, tx);
                    else await revokeAdminRole(id, tx);
                }
                await audit(tx, actorId, id, "update", { fields: Object.keys(updates), revokedTokens: revocation.count });
                return { user, cacheKeys: revocation.cacheKeys };
            });
            const warnings = await finish(result.cacheKeys, id);
            return { ...result.user, warnings };
        },
        async changeStatus(userId, actorId, status) {
            validateStatus(status);
            return this.update(userId, actorId, { status });
        },
        async sessions(userId, page = 1, itemsPerPage = 20) {
            const user = await findUser(userId);
            const now = new Date();
            const where = {
                user_id: user.id, type: "session", revoked: false,
                OR: [{ refresh_expires_at: { gt: now } }, {
                    refresh_token_hash: null, OR: [{ expires_at: null }, { expires_at: { gt: now } }],
                }],
            };
            const [items, total] = await Promise.all([
                db.ow_tokens.findMany({ where, select: SESSION_FIELDS, orderBy: { created_at: "desc" },
                    skip: (page - 1) * itemsPerPage, take: itemsPerPage }),
                db.ow_tokens.count({ where }),
            ]);
            return { items: items.map((item) => {
                let deviceInfo = item.device_info;
                if (typeof deviceInfo === "string") {
                    try { deviceInfo = JSON.parse(deviceInfo); } catch { deviceInfo = null; }
                }
                return { ...item, device_info: deviceInfo };
            }), total };
        },
        async revokeSessions(userId, actorId, tokenId = null) {
            const id = requireUserId(userId);
            if (id === Number(actorId)) {
                throw new UserManagementError(403, "SELF_SESSION_OPERATION_FORBIDDEN", "请在个人安全设置中管理自己的设备");
            }
            const result = await transaction(async (tx) => {
                await findUser(id, tx);
                const where = { user_id: id, type: "session" };
                if (tokenId !== null) {
                    where.id = requireUserId(tokenId);
                    const token = await tx.ow_tokens.findFirst({ where, select: { id: true } });
                    if (!token) throw new UserManagementError(404, "SESSION_NOT_FOUND", "该用户的设备会话不存在");
                }
                const revoked = await revokeInTransaction(tx, where);
                await audit(tx, actorId, id, "revoke_sessions", { tokenId, count: revoked.count });
                return revoked;
            });
            return { message: "设备会话已结束", count: result.count, warnings: await finish(result.cacheKeys, id) };
        },
        async cleanup(userId, actorId, input, permanent = false) {
            const id = requireUserId(userId);
            const configuredAdmins = await getConfiguredAdmins();
            const result = await transaction(async (tx) => {
                const user = await findUser(id, tx);
                await assertManageable(user, actorId, tx, configuredAdmins);
                confirmUser(user, input.confirmUsername);
                const revocation = permanent
                    ? await revokeInTransaction(tx, { user_id: id }) : { cacheKeys: [], count: 0 };
                const cleaned = await cleanupData(tx, id, input.categories, {
                    permanent, confirmCommentSpaces: input.confirmCommentSpaces === true,
                });
                if (permanent) await tx.ow_users.delete({ where: { id } });
                await audit(tx, actorId, id, permanent ? "delete" : "cleanup", { counts: cleaned.counts });
                return { ...cleaned, cacheKeys: revocation.cacheKeys };
            });
            const cacheKeys = [...result.cacheKeys, ...tokens.tokenCacheKeysForRecords(result.tokenCacheRecords || [])];
            const warnings = await finish(cacheKeys, id);
            for (const affectedUserId of result.affectedUserIds || []) clearPolicyCache(affectedUserId);
            try {
                warnings.push(...await afterCleanup(result, { userId: id, permanent }));
            } catch {
                warnings.push("数据库操作已完成，部分派生数据刷新失败，请稍后检查");
            }
            return { message: permanent ? "用户已永久删除" : "所选数据已清理，账号仍保留", counts: result.counts, warnings };
        },
        async summary(userId, actorId) {
            const user = await findUser(userId);
            const [data, protection] = await Promise.all([summarizeData(db, user.id), protections(user, actorId)]);
            return {
                ...data, user, protections: protection,
                warnings: [
                    "清理仅影响本站数据；外部社交平台副本不会同步删除。",
                    "为保护他人的分叉和引用，共享提交、文件及素材不会物理删除。",
                    ...(data.warnings || []),
                ],
            };
        },
    };
}
