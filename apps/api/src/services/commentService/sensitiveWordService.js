import zcconfig from '../config/zcconfig.js';
import redisClient from '../redis.js';
import { prisma } from '../prisma.js';
import logger from '../logger.js';

/**
 * 检查文本是否包含敏感词
 * @param {string} text - 待检测文本
 * @returns {Promise<{ hit: boolean, word: string|null }>}
 */
export async function checkSensitiveWords(text) {
    if (!text) return { hit: false, word: null };

    let words = await zcconfig.get('commentservice.sensitive_words');
    if (!words) return { hit: false, word: null };

    // 兼容字符串和数组
    if (typeof words === 'string') {
        try {
            words = JSON.parse(words);
        } catch {
            return { hit: false, word: null };
        }
    }

    if (!Array.isArray(words) || words.length === 0) return { hit: false, word: null };

    const lower = text.toLowerCase();
    for (const word of words) {
        if (word && lower.includes(String(word).toLowerCase())) {
            return { hit: true, word: String(word) };
        }
    }

    return { hit: false, word: null };
}

/**
 * 检查 IP 是否因敏感词被封禁
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function isSensitiveBanned(ip) {
    if (!ip) return false;
    const key = `cs:senban:${ip}`;
    return redisClient.exists(key);
}

/**
 * 封禁 IP（因敏感词违规）
 * @param {string} ip
 * @returns {Promise<void>}
 */
export async function banIpForSensitiveWord(ip) {
    if (!ip) return;
    const duration = await zcconfig.get('commentservice.sensitive_ban_duration');
    const ttl = (typeof duration === 'number' && duration > 0) ? duration : 3600;
    const key = `cs:senban:${ip}`;
    await redisClient.set(key, '1', ttl);
}

/**
 * 记录敏感词违规日志
 * @param {number} spaceId
 * @param {string} ip
 * @param {string} nick
 * @param {string} word - 命中的敏感词
 * @param {string} comment - 评论内容（将截取摘要）
 * @returns {Promise<void>}
 */
export async function logSensitiveViolation(spaceId, ip, nick, word, comment) {
    try {
        const timestamp = Date.now();
        const key = `cs:violation:${spaceId}:${timestamp}`;
        const value = JSON.stringify({
            ip,
            nick: nick || '',
            word,
            comment: comment ? comment.substring(0, 200) : '',
            time: new Date().toISOString(),
            spaceId,
        });

        // ow_cache_kv 有外键约束到 ow_users，使用 user_id=0 记录
        await prisma.$executeRawUnsafe(
            `INSERT INTO ow_cache_kv ("user_id", "key", "value") VALUES (0, $1, $2)`,
            key,
            value,
        );
    } catch (err) {
        logger.warn('[sensitiveWord] Failed to log violation:', err.message);
    }
}

export default {
    checkSensitiveWords,
    isSensitiveBanned,
    banIpForSensitiveWord,
    logSensitiveViolation,
};
