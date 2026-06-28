import logger from "../logger.js";
import zcconfig from "../config/zcconfig.js";
import { prisma } from "../prisma.js";
import redisClient from "../redis.js";
import {
    normalizeScopes,
    parseScope,
    scopeSatisfies,
} from "./scopes.js";
import {
    assertExplicitRolePermissions,
    assertSystemRoleDefinitions,
    DEFAULT_USER_PERMISSIONS,
    DEFAULT_USER_ROLE_KEYS,
    SYSTEM_ROLE_KEYS,
    SYSTEM_ROLE_PERMISSIONS,
    SYSTEM_ROLES,
} from "./rolePermissions.js";

export {
    DEFAULT_USER_PERMISSIONS,
    DEFAULT_USER_ROLE_KEYS,
    SYSTEM_ROLE_KEYS,
    SYSTEM_ROLE_PERMISSIONS,
    SYSTEM_ROLES,
};

const ROLE_CACHE_TTL_MS = 30_000;
const ROLE_CACHE_REDIS_TTL_SEC = 5 * 60;
const POLICY_CACHE_VERSION_TTL_MS = 5_000;
const POLICY_CACHE_PREFIX = "auth:policy:user:";
const POLICY_CACHE_VERSION_KEY = "auth:policy:version";
const policyCache = new Map();
let policyCacheVersion = {
    value: "1",
    expiresAt: 0,
};

function normalizeUserId(userId) {
    const value = Number(userId);
    return Number.isInteger(value) && value > 0 ? value : null;
}

function cacheKey(userId) {
    return String(userId);
}

function redisPolicyCacheKey(userId, version = policyCacheVersion.value) {
    return `${POLICY_CACHE_PREFIX}${version}:${userId}`;
}

function normalizeCachedPolicy(value) {
    if (!value || typeof value !== "object") return null;
    return {
        roles: Array.isArray(value.roles) ? value.roles.filter(Boolean) : [],
        allow: normalizeScopes(value.allow || []),
        deny: normalizeScopes(value.deny || []),
    };
}

async function getPolicyCacheVersion() {
    const now = Date.now();
    if (policyCacheVersion.expiresAt > now) {
        return policyCacheVersion.value;
    }

    const cached = await redisClient.get(POLICY_CACHE_VERSION_KEY);
    const value = cached ? String(cached) : "1";
    policyCacheVersion = {
        value,
        expiresAt: now + POLICY_CACHE_VERSION_TTL_MS,
    };

    if (!cached) {
        await redisClient.set(POLICY_CACHE_VERSION_KEY, value);
    }

    return value;
}

function setLocalPolicyCache(key, policy) {
    policyCache.set(key, {
        policy,
        expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
    });
}

export function clearUserPolicyCache(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (normalizedUserId) {
        policyCache.delete(cacheKey(normalizedUserId));
        getPolicyCacheVersion()
            .then((version) => redisClient.delete(redisPolicyCacheKey(normalizedUserId, version)))
            .catch((error) =>
                logger.warn(`[policy] 清理用户策略缓存失败 user=${normalizedUserId}: ${error.message}`)
            );
    }
}

export function clearPolicyCache() {
    policyCache.clear();
    const nextVersion = String(Date.now());
    policyCacheVersion = {
        value: nextVersion,
        expiresAt: Date.now() + POLICY_CACHE_VERSION_TTL_MS,
    };
    redisClient.set(POLICY_CACHE_VERSION_KEY, nextVersion).catch((error) =>
        logger.warn(`[policy] 更新策略缓存版本失败: ${error.message}`)
    );
}

function getSystemRoleDefinition(roleKey) {
    return SYSTEM_ROLES.find((role) => role.key === roleKey) || null;
}

function getSystemRolePermissions(roleKey) {
    const permissions = SYSTEM_ROLE_PERMISSIONS[roleKey] || [];
    assertExplicitRolePermissions(roleKey, permissions);
    return permissions;
}

async function upsertRole(db, role) {
    const rows = await db.$queryRaw`
        INSERT INTO "ow_roles" ("key", "name", "description", "system", "priority", "created_at", "updated_at")
        VALUES (${role.key}, ${role.name}, ${role.description || null}, ${role.system === true}, ${role.priority || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO UPDATE SET
            "name" = EXCLUDED."name",
            "description" = EXCLUDED."description",
            "system" = EXCLUDED."system",
            "priority" = EXCLUDED."priority",
            "updated_at" = CURRENT_TIMESTAMP
        RETURNING "id", "key"
    `;
    return rows[0] || null;
}

async function upsertRolePermission(db, roleId, scope, effect = "allow") {
    await db.$executeRaw`
        INSERT INTO "ow_role_permissions" ("role_id", "scope", "effect", "conditions", "created_at", "updated_at")
        VALUES (${roleId}, ${scope}, ${effect}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("role_id", "scope", "effect") DO UPDATE SET
            "updated_at" = CURRENT_TIMESTAMP
    `;
}

async function replaceRoleAllowPermissions(db, roleId, permissions) {
    await db.$executeRaw`
        DELETE FROM "ow_role_permissions"
        WHERE "role_id" = ${roleId}
          AND "effect" = 'allow'
    `;
    for (const permission of permissions) {
        await upsertRolePermission(db, roleId, permission, "allow");
    }
}

async function ensureSystemRole(db, roleKey, { syncPermissions = false } = {}) {
    const roleDefinition = getSystemRoleDefinition(roleKey);
    if (!roleDefinition) {
        throw new Error(`未知系统角色: ${roleKey}`);
    }

    const role = await upsertRole(db, roleDefinition);
    if (syncPermissions) {
        const permissions = getSystemRolePermissions(roleKey);
        await replaceRoleAllowPermissions(db, role.id, permissions);
    }
    return role;
}

async function findRoleByKey(db, roleKey) {
    const rows = await db.$queryRaw`
        SELECT "id", "key"
        FROM "ow_roles"
        WHERE "key" = ${roleKey}
        LIMIT 1
    `;
    return rows[0] || null;
}

async function ensureSystemRoleForAssignment(db, roleKey) {
    const role = await findRoleByKey(db, roleKey);
    if (role) return role;
    return ensureSystemRole(db, roleKey, { syncPermissions: true });
}

async function insertUserRole(db, userId, roleId, {
    assignedBy = null,
    reason = "manual",
    expiresAt = null,
} = {}) {
    // 账号级授予：target_type/target_id 走数据库默认值 'global'。
    await db.$executeRaw`
        INSERT INTO "ow_user_roles" ("user_id", "role_id", "assigned_by", "reason", "expires_at", "created_at", "updated_at")
        VALUES (${userId}, ${roleId}, ${assignedBy}, ${reason}, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("user_id", "role_id", "target_type", "target_id") DO UPDATE SET
            "assigned_by" = COALESCE(EXCLUDED."assigned_by", "ow_user_roles"."assigned_by"),
            "reason" = EXCLUDED."reason",
            "expires_at" = EXCLUDED."expires_at",
            "updated_at" = CURRENT_TIMESTAMP
    `;
}

async function backfillRoleToActiveLocalUsers(db, roleId, reason) {
    await db.$executeRaw`
        INSERT INTO "ow_user_roles" ("user_id", "role_id", "assigned_by", "reason", "expires_at", "created_at", "updated_at")
        SELECT "id", ${roleId}, NULL, ${reason}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "ow_users"
        WHERE "status" = 'active'
          AND COALESCE("type", '') <> 'remote_activitypub'
        ON CONFLICT ("user_id", "role_id", "target_type", "target_id") DO NOTHING
    `;
}

async function backfillDefaultUserRoles(db) {
    for (const roleKey of DEFAULT_USER_ROLE_KEYS) {
        const role = await ensureSystemRoleForAssignment(db, roleKey);
        await backfillRoleToActiveLocalUsers(db, role.id, `system-default-${roleKey}`);
    }
}

/**
 * 同步系统角色和默认策略。这个函数是幂等的，可在应用启动时重复执行。
 */
export async function syncRolePolicyCatalog() {
    try {
        assertSystemRoleDefinitions();
        await prisma.$transaction(async (tx) => {
            for (const role of SYSTEM_ROLES) {
                await ensureSystemRole(tx, role.key, { syncPermissions: true });
            }
            await backfillDefaultUserRoles(tx);
        });
        await syncConfiguredAdminRoles(prisma, { syncPermissions: false });
        clearPolicyCache();
        logger.info("[policy] 已同步角色策略目录");
    } catch (error) {
        logger.error(`[policy] 同步角色策略目录失败: ${error.message}`);
    }
}

/**
 * 将配置文件中的 security.adminusers 同步为数据库 admin 角色，保留旧配置兼容。
 */
export async function syncConfiguredAdminRoles(db = prisma, { syncPermissions = true } = {}) {
    try {
        const adminRole = await ensureSystemRole(db, SYSTEM_ROLE_KEYS.ADMIN, { syncPermissions });
        const adminUsers = await zcconfig.get("security.adminusers");
        const adminIds = Array.isArray(adminUsers)
            ? adminUsers.map(normalizeUserId).filter(Boolean)
            : [];

        for (const userId of adminIds) {
            await insertUserRole(db, userId, adminRole.id, {
                reason: "system-config-admin",
            });
            clearUserPolicyCache(userId);
        }

        const rows = await db.$queryRaw`
            SELECT "id"
            FROM "ow_users"
            WHERE "status" = 'active'
              AND "type" IN ('admin', 'administrator')
        `;
        for (const row of rows) {
            const userId = normalizeUserId(row.id);
            if (!userId) continue;
            await insertUserRole(db, userId, adminRole.id, {
                reason: "system-user-type-admin",
            });
            clearUserPolicyCache(userId);
        }
    } catch (error) {
        logger.error(`[policy] 同步配置管理员角色失败: ${error.message}`);
    }
}

/**
 * 注册/创建本地账户时批量授予默认功能角色。
 * @param {number} userId
 * @param {object} [db] Prisma client 或 transaction client
 */
export async function assignDefaultRolesToUser(userId, db = prisma) {
    return assignRolesToUser(userId, DEFAULT_USER_ROLE_KEYS, {
        reason: "system-register",
        db,
    });
}

export async function assignRolesToUser(userId, roleKeys, {
    assignedBy = null,
    reason = "manual",
    expiresAt = null,
    db = prisma,
} = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    const uniqueRoleKeys = [...new Set((roleKeys || []).filter(Boolean))];
    for (const roleKey of uniqueRoleKeys) {
        const role = await ensureSystemRoleForAssignment(db, roleKey);
        await insertUserRole(db, normalizedUserId, role.id, {
            assignedBy: normalizeUserId(assignedBy),
            reason,
            expiresAt,
        });
    }
    clearUserPolicyCache(normalizedUserId);
}

/**
 * 给用户授予角色，可供管理后台或兼容逻辑调用。
 */
export async function assignRoleToUser(userId, roleKey, {
    assignedBy = null,
    reason = "manual",
    expiresAt = null,
    db = prisma,
} = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    let role = await findRoleByKey(db, roleKey);
    if (!role && getSystemRoleDefinition(roleKey)) {
        role = await ensureSystemRole(db, roleKey, { syncPermissions: true });
    }
    if (!role) {
        throw new Error(`角色不存在: ${roleKey}`);
    }

    await insertUserRole(db, normalizedUserId, role.id, {
        assignedBy: normalizeUserId(assignedBy),
        reason,
        expiresAt,
    });
    clearUserPolicyCache(normalizedUserId);
}

export async function revokeRoleFromUser(userId, roleKey, { db = prisma } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    const role = await findRoleByKey(db, roleKey);
    if (!role) return;

    await db.$executeRaw`
        DELETE FROM "ow_user_roles"
        WHERE "user_id" = ${normalizedUserId}
          AND "role_id" = ${role.id}
          AND "target_type" = 'global'
    `;
    clearUserPolicyCache(normalizedUserId);
}

const SCOPED_GRANT_RESERVED_TARGET = "global";

/**
 * 实例级（资源级）授予一个角色，并打上 grant_type 标记。
 * 与账号级 grant 区分：target_type/target_id 指向具体资源（如 project / <id>）。
 */
export async function assignScopedRole(userId, roleKey, {
    targetType,
    targetId,
    grantType = "manual",
    assignedBy = null,
    reason = "manual",
    expiresAt = null,
    metadata = null,
    db = prisma,
} = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    const normalizedTargetType = String(targetType || "").trim();
    const normalizedTargetId = String(targetId ?? "").trim();
    if (!normalizedTargetType || !normalizedTargetId) {
        throw new Error("实例级授予需要 target_type 和 target_id");
    }
    if (normalizedTargetType === SCOPED_GRANT_RESERVED_TARGET) {
        throw new Error("target_type 不能使用保留值 global");
    }

    const role = await ensureSystemRoleForAssignment(db, roleKey);
    const metadataJson = metadata === null || metadata === undefined
        ? null
        : JSON.stringify(metadata);

    await db.$executeRaw`
        INSERT INTO "ow_user_roles" ("user_id", "role_id", "assigned_by", "reason", "expires_at", "grant_type", "target_type", "target_id", "metadata", "created_at", "updated_at")
        VALUES (${normalizedUserId}, ${role.id}, ${normalizeUserId(assignedBy)}, ${reason}, ${expiresAt}, ${grantType}, ${normalizedTargetType}, ${normalizedTargetId}, ${metadataJson}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("user_id", "role_id", "target_type", "target_id") DO UPDATE SET
            "assigned_by" = COALESCE(EXCLUDED."assigned_by", "ow_user_roles"."assigned_by"),
            "reason" = EXCLUDED."reason",
            "expires_at" = EXCLUDED."expires_at",
            "grant_type" = EXCLUDED."grant_type",
            "metadata" = EXCLUDED."metadata",
            "updated_at" = CURRENT_TIMESTAMP
    `;

    return role;
}

/**
 * 解除一个实例级角色授予。
 */
export async function revokeScopedRole(userId, roleKey, { targetType, targetId, db = prisma } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    const role = await findRoleByKey(db, roleKey);
    if (!role) return;

    await db.$executeRaw`
        DELETE FROM "ow_user_roles"
        WHERE "user_id" = ${normalizedUserId}
          AND "role_id" = ${role.id}
          AND "target_type" = ${String(targetType || "")}
          AND "target_id" = ${String(targetId ?? "")}
    `;
}

/**
 * 读取用户在某资源实例上有效（未过期）角色授予所覆盖的 allow scope 集合。
 * 资源边界检查用它判断协作者能否操作。
 */
export async function getUserResourceRoleScopes(userId, targetType, targetId, { db = prisma } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return [];
    const tType = String(targetType || "").trim();
    const tId = String(targetId ?? "").trim();
    if (!tType || !tId || tType === SCOPED_GRANT_RESERVED_TARGET) return [];

    const rows = await db.$queryRaw`
        SELECT rp."scope" AS "scope"
        FROM "ow_user_roles" ur
        INNER JOIN "ow_roles" r ON r."id" = ur."role_id"
        INNER JOIN "ow_role_permissions" rp ON rp."role_id" = r."id"
        WHERE ur."user_id" = ${normalizedUserId}
          AND ur."target_type" = ${tType}
          AND ur."target_id" = ${tId}
          AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
          AND rp."effect" = 'allow'
    `;

    return normalizeScopes(rows.map((row) => String(row.scope || "")).filter(Boolean));
}

/**
 * 列出用户被特殊授予的实例级角色（自助管理用）。可按 grant_type 过滤。
 */
export async function listUserScopedGrants(userId, { grantType = null, db = prisma } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return [];

    const rows = await db.$queryRaw`
        SELECT
            ur."id" AS "assignment_id",
            ur."role_id" AS "role_id",
            ur."grant_type" AS "grant_type",
            ur."target_type" AS "target_type",
            ur."target_id" AS "target_id",
            ur."reason" AS "reason",
            ur."metadata" AS "metadata",
            ur."expires_at" AS "expires_at",
            ur."created_at" AS "created_at",
            r."key" AS "role_key",
            r."name" AS "role_name",
            r."priority" AS "role_priority"
        FROM "ow_user_roles" ur
        INNER JOIN "ow_roles" r ON r."id" = ur."role_id"
        WHERE ur."user_id" = ${normalizedUserId}
          AND ur."target_type" <> 'global'
          AND (${grantType}::text IS NULL OR ur."grant_type" = ${grantType})
        ORDER BY ur."created_at" DESC
    `;

    return rows.map((row) => ({
        id: row.assignment_id,
        role_key: row.role_key,
        role_name: row.role_name,
        role_priority: row.role_priority,
        grant_type: row.grant_type,
        target_type: row.target_type,
        target_id: row.target_id,
        reason: row.reason,
        metadata: row.metadata,
        expires_at: row.expires_at,
        created_at: row.created_at,
        active: !row.expires_at || row.expires_at > new Date(),
    }));
}

/**
 * 列出某资源实例上的全部角色授予（含被授予人信息），供资源所有者查看成员名单。
 */
export async function listResourceGrants(targetType, targetId, { db = prisma } = {}) {
    const tType = String(targetType || "").trim();
    const tId = String(targetId ?? "").trim();
    if (!tType || !tId || tType === SCOPED_GRANT_RESERVED_TARGET) return [];

    const rows = await db.$queryRaw`
        SELECT
            ur."id" AS "assignment_id",
            ur."user_id" AS "user_id",
            ur."grant_type" AS "grant_type",
            ur."reason" AS "reason",
            ur."assigned_by" AS "assigned_by",
            ur."expires_at" AS "expires_at",
            ur."created_at" AS "created_at",
            r."key" AS "role_key",
            r."name" AS "role_name",
            r."priority" AS "role_priority",
            u."username" AS "username",
            u."display_name" AS "display_name",
            u."avatar" AS "avatar",
            au."username" AS "assigned_by_username",
            au."display_name" AS "assigned_by_display_name"
        FROM "ow_user_roles" ur
        INNER JOIN "ow_roles" r ON r."id" = ur."role_id"
        INNER JOIN "ow_users" u ON u."id" = ur."user_id"
        LEFT JOIN "ow_users" au ON au."id" = ur."assigned_by"
        WHERE ur."target_type" = ${tType}
          AND ur."target_id" = ${tId}
          AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
        ORDER BY r."priority" DESC, u."username" ASC
    `;

    return rows.map((row) => ({
        id: row.assignment_id,
        user_id: row.user_id,
        user: {
            id: row.user_id,
            username: row.username,
            display_name: row.display_name,
            avatar: row.avatar,
        },
        role_key: row.role_key,
        role_name: row.role_name,
        role_priority: row.role_priority,
        grant_type: row.grant_type,
        reason: row.reason,
        assigned_by: row.assigned_by,
        assigned_by_user: row.assigned_by
            ? {
                id: row.assigned_by,
                username: row.assigned_by_username,
                display_name: row.assigned_by_display_name,
            }
            : null,
        expires_at: row.expires_at,
        created_at: row.created_at,
    }));
}

export async function listRoles({ db = prisma } = {}) {
    const rows = await db.$queryRaw`
        SELECT
            r."id" AS "role_id",
            r."key" AS "role_key",
            r."name" AS "role_name",
            r."description" AS "role_description",
            r."system" AS "role_system",
            r."priority" AS "role_priority",
            r."created_at" AS "role_created_at",
            r."updated_at" AS "role_updated_at",
            rp."id" AS "permission_id",
            rp."scope" AS "permission_scope",
            rp."effect" AS "permission_effect",
            rp."conditions" AS "permission_conditions",
            rp."created_at" AS "permission_created_at",
            rp."updated_at" AS "permission_updated_at"
        FROM "ow_roles" r
        LEFT JOIN "ow_role_permissions" rp ON rp."role_id" = r."id"
        ORDER BY r."priority" ASC, r."key" ASC, rp."effect" ASC, rp."scope" ASC
    `;

    const roles = [];
    const roleMap = new Map();
    for (const row of rows) {
        let role = roleMap.get(row.role_id);
        if (!role) {
            role = {
                id: row.role_id,
                key: row.role_key,
                name: row.role_name,
                description: row.role_description,
                system: row.role_system,
                priority: row.role_priority,
                created_at: row.role_created_at,
                updated_at: row.role_updated_at,
                permissions: [],
            };
            roleMap.set(row.role_id, role);
            roles.push(role);
        }

        if (row.permission_id) {
            role.permissions.push({
                id: row.permission_id,
                scope: row.permission_scope,
                effect: row.permission_effect || "allow",
                conditions: row.permission_conditions,
                created_at: row.permission_created_at,
                updated_at: row.permission_updated_at,
            });
        }
    }

    return roles;
}

export async function getUserRoleAssignments(userId, { db = prisma } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return [];

    const rows = await db.$queryRaw`
        SELECT
            ur."id" AS "assignment_id",
            ur."user_id" AS "user_id",
            ur."role_id" AS "role_id",
            ur."assigned_by" AS "assigned_by",
            ur."reason" AS "reason",
            ur."expires_at" AS "expires_at",
            ur."created_at" AS "created_at",
            ur."updated_at" AS "updated_at",
            r."key" AS "role_key",
            r."name" AS "role_name",
            r."description" AS "role_description",
            r."system" AS "role_system",
            r."priority" AS "role_priority",
            au."username" AS "assigned_by_username",
            au."display_name" AS "assigned_by_display_name"
        FROM "ow_user_roles" ur
        INNER JOIN "ow_roles" r ON r."id" = ur."role_id"
        LEFT JOIN "ow_users" au ON au."id" = ur."assigned_by"
        WHERE ur."user_id" = ${normalizedUserId}
          AND ur."target_type" = 'global'
        ORDER BY r."priority" ASC, r."key" ASC
    `;

    return rows.map((row) => ({
        id: row.assignment_id,
        user_id: row.user_id,
        role_id: row.role_id,
        role_key: row.role_key,
        role_name: row.role_name,
        role_description: row.role_description,
        role_system: row.role_system,
        role_priority: row.role_priority,
        assigned_by: row.assigned_by,
        assigned_by_user: row.assigned_by
            ? {
                id: row.assigned_by,
                username: row.assigned_by_username,
                display_name: row.assigned_by_display_name,
            }
            : null,
        reason: row.reason,
        expires_at: row.expires_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        active: !row.expires_at || row.expires_at > new Date(),
    }));
}

export async function replaceUserRoles(userId, roleKeys, {
    assignedBy = null,
    reason = "admin-set-user-roles",
    expiresAt = null,
} = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        throw new Error("无效的用户 ID");
    }

    const uniqueRoleKeys = [...new Set((roleKeys || [])
        .map((roleKey) => String(roleKey || "").trim())
        .filter(Boolean))];

    await prisma.$transaction(async (tx) => {
        // 先确保所有目标角色存在；不存在的非系统角色会抛错。
        for (const roleKey of uniqueRoleKeys) {
            await ensureSystemRoleForAssignment(tx, roleKey);
        }

        const currentAssignments = await getUserRoleAssignments(normalizedUserId, { db: tx });
        const desired = new Set(uniqueRoleKeys);
        for (const assignment of currentAssignments) {
            if (!desired.has(assignment.role_key)) {
                await revokeRoleFromUser(normalizedUserId, assignment.role_key, { db: tx });
            }
        }

        await assignRolesToUser(normalizedUserId, uniqueRoleKeys, {
            assignedBy,
            reason,
            expiresAt,
            db: tx,
        });
    });

    clearUserPolicyCache(normalizedUserId);
}

export async function getUserPolicy(userId, { useCache = true } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
        return { roles: [], allow: [], deny: [] };
    }

    const key = cacheKey(normalizedUserId);
    const cached = policyCache.get(key);
    if (useCache && cached && cached.expiresAt > Date.now()) {
        return cached.policy;
    }

    try {
        const version = await getPolicyCacheVersion();
        if (useCache) {
            const distributedCached = normalizeCachedPolicy(
                await redisClient.get(redisPolicyCacheKey(normalizedUserId, version))
            );
            if (distributedCached) {
                setLocalPolicyCache(key, distributedCached);
                return distributedCached;
            }
        }

        const rows = await prisma.$queryRaw`
            SELECT
                r."key" AS "role_key",
                r."priority" AS "priority",
                rp."scope" AS "scope",
                rp."effect" AS "effect"
            FROM "ow_user_roles" ur
            INNER JOIN "ow_roles" r ON r."id" = ur."role_id"
            INNER JOIN "ow_role_permissions" rp ON rp."role_id" = r."id"
            WHERE ur."user_id" = ${normalizedUserId}
              AND ur."target_type" = 'global'
              AND (ur."expires_at" IS NULL OR ur."expires_at" > CURRENT_TIMESTAMP)
            ORDER BY r."priority" DESC, r."key" ASC
        `;

        const roles = [...new Set(rows.map((row) => row.role_key).filter(Boolean))];
        const allow = [];
        const deny = [];

        for (const row of rows) {
            const scope = String(row.scope || "").trim();
            if (!scope) continue;
            if (String(row.effect || "allow").toLowerCase() === "deny") {
                deny.push(scope);
            } else {
                allow.push(scope);
            }
        }

        const policy = {
            roles,
            allow: normalizeScopes(allow),
            deny: normalizeScopes(deny),
        };

        setLocalPolicyCache(key, policy);
        await redisClient.set(
            redisPolicyCacheKey(normalizedUserId, version),
            policy,
            ROLE_CACHE_REDIS_TTL_SEC
        );

        return policy;
    } catch (error) {
        logger.error(`[policy] 读取用户角色策略失败 user=${normalizedUserId}: ${error.message}`);
        return { roles: [], allow: [], deny: [] };
    }
}

function hasNonAdminDeny(policy) {
    return policy.deny.some((scope) => {
        const parsed = parseScope(scope);
        return parsed?.wildcard || parsed?.resource !== "admin";
    });
}

function policyAllowsConcreteScope(policy, requiredScope) {
    if (scopeSatisfies(policy.deny, requiredScope)) {
        return false;
    }
    return scopeSatisfies(policy.allow, requiredScope);
}

export function policyAllowsScope(policy, requiredScope) {
    const parsed = parseScope(requiredScope);
    if (!parsed) return false;

    if (parsed.wildcard) {
        return DEFAULT_USER_PERMISSIONS.every((permission) =>
            policyAllowsConcreteScope(policy, permission)
        ) && !hasNonAdminDeny(policy);
    }

    return policyAllowsConcreteScope(policy, requiredScope);
}

export async function userSatisfiesPolicy(userId, requiredScope) {
    const policy = await getUserPolicy(userId);
    return policyAllowsScope(policy, requiredScope);
}

/**
 * 校验用户是否能转授权一组 scope。角色策略是账号上限，token 自身 scope 是调用上下文上限。
 */
export async function canUserGrantScopes(userId, scopes) {
    const normalized = normalizeScopes(scopes);
    const policy = await getUserPolicy(userId);
    const denied = normalized.filter((scope) => !policyAllowsScope(policy, scope));
    const admin = policyAllowsScope(policy, "admin:manage");

    return {
        allowed: denied.length === 0,
        denied,
        admin,
        roles: policy.roles,
    };
}

export default {
    SYSTEM_ROLE_KEYS,
    DEFAULT_USER_PERMISSIONS,
    DEFAULT_USER_ROLE_KEYS,
    SYSTEM_ROLES,
    SYSTEM_ROLE_PERMISSIONS,
    syncRolePolicyCatalog,
    syncConfiguredAdminRoles,
    assignDefaultRolesToUser,
    assignRolesToUser,
    assignRoleToUser,
    revokeRoleFromUser,
    assignScopedRole,
    revokeScopedRole,
    getUserResourceRoleScopes,
    listUserScopedGrants,
    listResourceGrants,
    listRoles,
    getUserRoleAssignments,
    replaceUserRoles,
    getUserPolicy,
    policyAllowsScope,
    userSatisfiesPolicy,
    canUserGrantScopes,
    clearUserPolicyCache,
    clearPolicyCache,
};
