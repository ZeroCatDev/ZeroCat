import { prisma } from '../prisma.js';

const VALID_COUNTER_FIELDS = [
    'time',
    'reaction0', 'reaction1', 'reaction2', 'reaction3', 'reaction4',
    'reaction5', 'reaction6', 'reaction7', 'reaction8',
];

/**
 * 获取页面计数器
 * @param {number} spaceId
 * @param {string|string[]} urls
 * @param {string|null} type - 逗号分隔的字段名，如 "reaction0,reaction1"；为空时返回 time
 * @returns {Promise<number|number[]|object[]>}
 */
export async function getArticleCounter(spaceId, urls, type) {
    const isArray = Array.isArray(urls);
    const urlList = isArray ? urls : [urls];

    const counters = await prisma.ow_comment_service_counter.findMany({
        where: {
            space_id: spaceId,
            url: { in: urlList },
        },
    });

    const counterMap = {};
    for (const c of counters) {
        counterMap[c.url] = c;
    }

    // 解析请求的字段列表
    const typeList = type
        ? String(type).split(',').filter(t => VALID_COUNTER_FIELDS.includes(t))
        : null;

    if (typeList && typeList.length > 0) {
        // 返回包含指定字段的对象数组
        return urlList.map(url => {
            const counter = counterMap[url];
            const obj = {};
            for (const t of typeList) {
                obj[t] = counter ? (counter[t] ?? 0) : 0;
            }
            return obj;
        });
    }

    // 默认：只返回 time
    const results = urlList.map(url => counterMap[url]?.time || 0);
    return isArray ? results : results[0];
}

/**
 * 更新页面计数器 (指定字段+1)
 * @param {number} spaceId
 * @param {string} url
 * @param {string} [type='time'] - 要递增的字段名
 * @returns {Promise<number>} 新计数值
 */
export async function updateArticleCounter(spaceId, url, type) {
    const field = type && VALID_COUNTER_FIELDS.includes(type) ? type : 'time';

    const counter = await prisma.ow_comment_service_counter.upsert({
        where: {
            space_id_url: { space_id: spaceId, url },
        },
        update: {
            [field]: { increment: 1 },
        },
        create: {
            space_id: spaceId,
            url,
            [field]: 1,
        },
    });

    return counter[field];
}

export default { getArticleCounter, updateArticleCounter };
