import AkismetClient from 'akismet-api';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

/**
 * 获取可用的 Akismet 密钥
 * 优先使用空间级密钥，否则从全局密钥池随机选取
 */
async function getAkismetKey(spaceConfig) {
    if (spaceConfig.akismetKey) {
        return spaceConfig.akismetKey;
    }

    const keys = await zcconfig.get('commentservice.akismet.keys');
    if (Array.isArray(keys) && keys.length > 0) {
        return keys[Math.floor(Math.random() * keys.length)];
    }

    return null;
}

/**
 * 检查评论是否为垃圾信息
 * @param {object} params - { comment, nick, mail, url, ip, ua, siteUrl }
 * @param {object} spaceConfig - 空间配置
 * @returns {Promise<boolean>} true 表示垃圾评论
 */
export async function checkAkismetSpam(params, spaceConfig) {
    const key = await getAkismetKey(spaceConfig);
    if (!key) return false;

    try {
        const client = new AkismetClient.AkismetClient({
            key,
            blog: params.siteUrl,
        });

        const isSpam = await client.checkSpam({
            user_ip: params.ip,
            user_agent: params.ua,
            comment_type: 'comment',
            comment_author: params.nick,
            comment_author_email: params.mail,
            comment_author_url: params.url,
            comment_content: params.comment,
        });

        if (isSpam) {
            logger.info(`[akismet] Spam detected from ${params.ip}`);
        }

        return isSpam;
    } catch (err) {
        // fail-open: 出错时放行
        logger.warn('[akismet] Check failed, allowing comment:', err.message);
        return false;
    }
}

export default { checkAkismetSpam };
