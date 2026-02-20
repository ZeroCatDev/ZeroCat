import { prisma } from '../prisma.js';

/**
 * 解析等级阈值字符串
 * @param {string} str - 逗号分隔的阈值，如 '0,10,20,50,100,200'
 * @returns {number[]} 排序后的阈值数组
 */
export function parseLevels(str) {
    if (!str) return [];
    return str
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
}

/**
 * 根据评论数返回等级索引
 * @param {number} count - 用户评论数
 * @param {number[]} thresholds - 排序后的阈值数组
 * @returns {number} 等级索引 (0-based)
 */
export function getLevelIndex(count, thresholds) {
    let level = 0;
    for (let i = 0; i < thresholds.length; i++) {
        if (count >= thresholds[i]) {
            level = i;
        } else {
            break;
        }
    }
    return level;
}

/**
 * 批量获取用户等级
 * @param {number} spaceId
 * @param {number[]} userIds
 * @param {string} levelsConfig - 等级配置字符串
 * @returns {Promise<Map<number, number>>} userId -> level 映射
 */
export async function batchGetUserLevels(spaceId, userIds, levelsConfig) {
    const thresholds = parseLevels(levelsConfig);
    if (thresholds.length === 0 || userIds.length === 0) {
        return new Map();
    }

    const groups = await prisma.ow_comment_service.groupBy({
        by: ['user_id'],
        where: {
            space_id: spaceId,
            user_id: { in: userIds.map(String) },
            status: 'approved',
        },
        _count: { id: true },
    });

    const levelMap = new Map();
    for (const g of groups) {
        const userId = Number(g.user_id);
        levelMap.set(userId, getLevelIndex(g._count.id, thresholds));
    }

    return levelMap;
}

export default { parseLevels, getLevelIndex, batchGetUserLevels };
