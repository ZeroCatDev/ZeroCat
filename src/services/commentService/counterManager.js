import { prisma } from '../prisma.js';

/**
 * 获取页面计数器
 * @param {number} spaceId
 * @param {string|string[]} urls
 * @returns {Promise<number|number[]>}
 */
export async function getArticleCounter(spaceId, urls) {
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
        counterMap[c.url] = c.time;
    }

    const results = urlList.map(url => counterMap[url] || 0);
    return isArray ? results : results[0];
}

/**
 * 更新页面计数器 (访问计数+1)
 * @param {number} spaceId
 * @param {string} url
 * @returns {Promise<number>} 新计数值
 */
export async function updateArticleCounter(spaceId, url) {
    const counter = await prisma.ow_comment_service_counter.upsert({
        where: {
            space_id_url: { space_id: spaceId, url },
        },
        update: {
            time: { increment: 1 },
        },
        create: {
            space_id: spaceId,
            url,
            time: 1,
        },
    });

    return counter.time;
}

export default { getArticleCounter, updateArticleCounter };
