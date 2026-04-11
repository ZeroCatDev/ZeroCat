import { prisma } from '../prisma.js';

const VALID_COUNTER_FIELDS = [
    'time',
    'reaction0', 'reaction1', 'reaction2', 'reaction3', 'reaction4',
    'reaction5', 'reaction6', 'reaction7', 'reaction8',
];
const DEFAULT_COUNTER_FIELD = 'time';

function normalizeTypeList(type) {
    if (type === undefined || type === null) return [DEFAULT_COUNTER_FIELD];

    const rawList = Array.isArray(type) ? type : [type];
    const list = [];

    for (const raw of rawList) {
        const items = String(raw).split(',');
        for (const item of items) {
            const field = item.trim();
            if (!VALID_COUNTER_FIELDS.includes(field)) continue;
            if (list.includes(field)) continue;
            list.push(field);
        }
    }

    return list.length > 0 ? list : [DEFAULT_COUNTER_FIELD];
}

function normalizeCounterField(type) {
    return VALID_COUNTER_FIELDS.includes(type) ? type : DEFAULT_COUNTER_FIELD;
}

/**
 * 获取页面计数器
 * @param {number} spaceId
 * @param {string|string[]} urls
 * @param {string|null} type - 逗号分隔的字段名，如 "reaction0,reaction1"；为空时返回 time
 * @returns {Promise<object[]>}
 */
export async function getArticleCounter(spaceId, urls, type) {
    const urlList = Array.isArray(urls) ? urls.map(url => String(url ?? '')) : [String(urls ?? '')];
    const typeList = normalizeTypeList(type);
    const uniqueUrls = [...new Set(urlList)];

    const counters = uniqueUrls.length > 0
        ? await prisma.ow_comment_service_counter.findMany({
            where: {
                space_id: spaceId,
                url: { in: uniqueUrls },
            },
        })
        : [];

    const counterMap = new Map(counters.map(counter => [counter.url, counter]));

    return urlList.map(url => {
        const result = {};
        const counter = counterMap.get(url);
        for (const field of typeList) {
            result[field] = Number(counter?.[field] ?? 0);
        }
        return result;
    });
}

/**
 * 更新页面计数器 (指定字段+1)
 * @param {number} spaceId
 * @param {string} url
 * @param {string} [type='time'] - 要递增的字段名
 * @param {string} [action='inc'] - inc 递增 / desc 递减
 * @returns {Promise<{ field: string, value: number }>}
 */
export async function updateArticleCounter(spaceId, url, type, action = 'inc') {
    const field = normalizeCounterField(type);
    const normalizedUrl = String(url || '');
    const normalizedAction = action === 'desc' ? 'desc' : 'inc';

    if (!normalizedUrl) {
        return { field, value: 0 };
    }

    if (normalizedAction === 'desc') {
        const existing = await prisma.ow_comment_service_counter.findUnique({
            where: {
                space_id_url: { space_id: spaceId, url: normalizedUrl },
            },
        });

        if (!existing) {
            return { field, value: 0 };
        }

        const nextValue = Math.max(Number(existing[field] ?? 0) - 1, 0);
        await prisma.ow_comment_service_counter.update({
            where: { id: existing.id },
            data: { [field]: nextValue },
        });

        return { field, value: nextValue };
    }

    const counter = await prisma.ow_comment_service_counter.upsert({
        where: {
            space_id_url: { space_id: spaceId, url: normalizedUrl },
        },
        update: {
            [field]: { increment: 1 },
        },
        create: {
            space_id: spaceId,
            url: normalizedUrl,
            [field]: 1,
        },
    });

    return { field, value: Number(counter[field] ?? 0) };
}

export default { getArticleCounter, updateArticleCounter };
