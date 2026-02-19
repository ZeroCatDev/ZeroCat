import crypto from 'crypto';
import { prisma } from '../prisma.js';
import logger from '../logger.js';

// 默认空间配置
const DEFAULT_SPACE_CONFIG = {
    audit: 'false',
    login: '',
    ipqps: '60',
    forbiddenWords: '',
    disableUserAgent: 'false',
    disableRegion: 'false',
    secureDomains: '',
    avatarProxy: '',
    levels: '',
};

/**
 * 生成空间 CUID (16字符hex)
 */
function generateCuid() {
    return crypto.randomBytes(16).toString('hex').slice(0, 32);
}

/**
 * 生成空间 JWT 密钥
 */
function generateJwtSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 创建评论空间
 */
export async function createSpace(ownerId, name, domain = null) {
    const cuid = generateCuid();
    const jwtSecret = generateJwtSecret();

    const space = await prisma.ow_comment_spaces.create({
        data: {
            cuid,
            owner_id: ownerId,
            name,
            domain,
            jwt_secret: jwtSecret,
        },
    });

    // 创建默认配置
    const configEntries = Object.entries(DEFAULT_SPACE_CONFIG).map(([key, value]) => ({
        target_type: 'comment_space',
        target_id: cuid,
        key,
        value,
    }));

    await prisma.ow_target_configs.createMany({ data: configEntries });

    // 将 owner 注册为空间的 administrator
    await prisma.ow_comment_service_users.create({
        data: {
            space_id: space.id,
            user_id: ownerId,
            type: 'administrator',
        },
    });

    return space;
}

/**
 * 获取空间详情
 */
export async function getSpaceByGuid(cuid) {
    return prisma.ow_comment_spaces.findUnique({
        where: { cuid },
    });
}

/**
 * 列出用户拥有的空间
 */
export async function listSpaces(ownerId) {
    return prisma.ow_comment_spaces.findMany({
        where: { owner_id: ownerId },
        orderBy: { created_at: 'desc' },
    });
}

/**
 * 更新空间
 */
export async function updateSpace(cuid, ownerId, data) {
    const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid } });
    if (!space || space.owner_id !== ownerId) return null;

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.ow_comment_spaces.update({
        where: { cuid },
        data: updateData,
    });
}

/**
 * 删除空间
 */
export async function deleteSpace(cuid, ownerId) {
    const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid } });
    if (!space || space.owner_id !== ownerId) return false;

    // 删除相关配置
    await prisma.ow_target_configs.deleteMany({
        where: { target_type: 'comment_space', target_id: cuid },
    });

    await prisma.ow_comment_spaces.delete({ where: { cuid } });
    return true;
}

/**
 * 获取空间配置
 */
export async function getSpaceConfig(cuid) {
    const configs = await prisma.ow_target_configs.findMany({
        where: { target_type: 'comment_space', target_id: cuid },
    });

    const result = { ...DEFAULT_SPACE_CONFIG };
    for (const config of configs) {
        result[config.key] = config.value;
    }
    return result;
}

/**
 * 更新空间配置
 */
export async function updateSpaceConfig(cuid, ownerId, configData) {
    const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid } });
    if (!space || space.owner_id !== ownerId) return null;

    const allowedKeys = Object.keys(DEFAULT_SPACE_CONFIG);
    const updates = [];

    for (const [key, value] of Object.entries(configData)) {
        if (!allowedKeys.includes(key)) continue;
        updates.push(
            prisma.ow_target_configs.upsert({
                where: {
                    target_type_target_id_key: {
                        target_type: 'comment_space',
                        target_id: cuid,
                        key,
                    },
                },
                update: { value: String(value) },
                create: {
                    target_type: 'comment_space',
                    target_id: cuid,
                    key,
                    value: String(value),
                },
            })
        );
    }

    await Promise.all(updates);
    return getSpaceConfig(cuid);
}

/**
 * 获取或创建空间用户映射
 */
export async function getOrCreateSpaceUser(spaceId, userId, defaults = {}) {
    let spaceUser = await prisma.ow_comment_service_users.findUnique({
        where: { space_id_user_id: { space_id: spaceId, user_id: userId } },
    });

    if (!spaceUser) {
        spaceUser = await prisma.ow_comment_service_users.create({
            data: {
                space_id: spaceId,
                user_id: userId,
                type: defaults.type || 'guest',
                display_name: defaults.display_name || null,
                email: defaults.email || null,
                avatar: defaults.avatar || null,
            },
        });
    }

    return spaceUser;
}

/**
 * 获取空间用户
 */
export async function getSpaceUser(spaceId, userId) {
    return prisma.ow_comment_service_users.findUnique({
        where: { space_id_user_id: { space_id: spaceId, user_id: userId } },
    });
}

/**
 * 列出空间用户
 * @param {number} spaceId
 * @param {number} page
 * @param {number} pageSize
 * @param {object} filters - { type, keyword }
 */
export async function listSpaceUsers(spaceId, page = 1, pageSize = 20, filters = {}) {
    const { type, keyword } = filters;

    // 有搜索关键词时使用 pg_trgm
    if (keyword && keyword.trim()) {
        return _searchSpaceUsers(spaceId, keyword.trim(), { page, pageSize, type });
    }

    const where = { space_id: spaceId };
    if (type) where.type = type;

    const skip = (page - 1) * pageSize;
    const [users, count] = await Promise.all([
        prisma.ow_comment_service_users.findMany({
            where,
            include: { user: { select: { id: true, username: true, display_name: true, avatar: true } } },
            skip,
            take: pageSize,
            orderBy: { created_at: 'desc' },
        }),
        prisma.ow_comment_service_users.count({ where }),
    ]);

    return { users, count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
}

/**
 * pg_trgm 搜索空间用户 (内部方法)
 */
async function _searchSpaceUsers(spaceId, keyword, { page, pageSize, type }) {
    const params = [keyword, spaceId];
    const conditions = ['su.space_id = $2'];

    if (type) {
        params.push(type);
        conditions.push(`su.type = $${params.length}`);
    }

    const whereSql = conditions.join(' AND ');
    const scoreExpr = `GREATEST(
        similarity(COALESCE(su.display_name, ''), $1),
        similarity(COALESCE(u.display_name, ''), $1),
        similarity(COALESCE(u.username, ''), $1)
    )`;
    const matchExpr = `(
        su.display_name ILIKE '%' || $1 || '%'
        OR u.display_name ILIKE '%' || $1 || '%'
        OR u.username ILIKE '%' || $1 || '%'
        OR ${scoreExpr} > 0.1
    )`;

    const dataSql = `
        SELECT su.user_id, ${scoreExpr} AS score
        FROM ow_comment_service_users su
        LEFT JOIN ow_users u ON u.id = su.user_id
        WHERE ${whereSql} AND ${matchExpr}
        ORDER BY score DESC, su.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `
        SELECT COUNT(*)::int AS total
        FROM ow_comment_service_users su
        LEFT JOIN ow_users u ON u.id = su.user_id
        WHERE ${whereSql} AND ${matchExpr}
    `;

    const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe(dataSql, ...params, pageSize, (page - 1) * pageSize),
        prisma.$queryRawUnsafe(countSql, ...params),
    ]);

    const count = countRows[0]?.total || 0;
    const userIds = rows.map(r => r.user_id);

    if (userIds.length === 0) {
        return { users: [], count: 0, page, pageSize, totalPages: 0 };
    }

    // 用 Prisma 查出完整记录
    const users = await prisma.ow_comment_service_users.findMany({
        where: { space_id: spaceId, user_id: { in: userIds } },
        include: { user: { select: { id: true, username: true, display_name: true, avatar: true } } },
    });

    // 保持 score 排序
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const sorted = userIds.map(id => userMap.get(id)).filter(Boolean);

    return { users: sorted, count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
}

/**
 * 更新空间用户
 */
export async function updateSpaceUser(spaceId, userId, data) {
    const updateData = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.display_name !== undefined) updateData.display_name = data.display_name;
    if (data.label !== undefined) updateData.label = data.label;

    return prisma.ow_comment_service_users.update({
        where: { space_id_user_id: { space_id: spaceId, user_id: userId } },
        data: updateData,
    });
}

/**
 * 获取空间统计
 */
export async function getSpaceStats(spaceId) {
    const [commentCount, userCount, waitingCount, spamCount] = await Promise.all([
        prisma.ow_comment_service.count({ where: { space_id: spaceId } }),
        prisma.ow_comment_service_users.count({ where: { space_id: spaceId } }),
        prisma.ow_comment_service.count({ where: { space_id: spaceId, status: 'waiting' } }),
        prisma.ow_comment_service.count({ where: { space_id: spaceId, status: 'spam' } }),
    ]);

    return { commentCount, userCount, waitingCount, spamCount };
}

export default {
    createSpace,
    getSpaceByGuid,
    listSpaces,
    updateSpace,
    deleteSpace,
    getSpaceConfig,
    updateSpaceConfig,
    getOrCreateSpaceUser,
    getSpaceUser,
    listSpaceUsers,
    updateSpaceUser,
    getSpaceStats,
};
