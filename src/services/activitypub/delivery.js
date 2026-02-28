/**
 * ActivityPub 活动投递
 * 将活动签名后 POST 到远程服务器的收件箱
 */

import axios from 'axios';
import logger from '../logger.js';
import { AP_CONTENT_TYPE } from './config.js';
import { signRequest, digestBody } from './httpSignature.js';
import { getUserPrivateKey } from './keys.js';
import { getActorKeyId } from './actor.js';
import { getLocalUserById } from './actor.js';
import { getRemoteFollowers } from './store.js';
import { getSharedInboxUrl, fetchRemoteActor } from './federation.js';

/**
 * 发送已签名的 ActivityPub 请求
 * @param {object} opts
 * @param {string} opts.inbox - 目标收件箱 URL
 * @param {object} opts.activity - 活动对象
 * @param {number} opts.userId - 发送者用户 ID
 * @param {string} opts.username - 发送者用户名
 * @returns {boolean} 是否成功
 */
export async function deliverActivity({ inbox, activity, userId, username }) {
    try {
        const body = JSON.stringify(activity);
        const url = new URL(inbox);
        const privateKey = await getUserPrivateKey(userId);
        const keyId = await getActorKeyId(username);
        const digest = digestBody(body);

        const headers = {
            host: url.host,
            date: new Date().toUTCString(),
            digest,
            'content-type': AP_CONTENT_TYPE,
        };

        const { signatureHeader } = signRequest({
            keyId,
            privateKey,
            method: 'POST',
            path: url.pathname,
            headers,
        });

        const response = await axios.post(inbox, body, {
            headers: {
                ...headers,
                signature: signatureHeader,
                'User-Agent': 'ZeroCat-ActivityPub/1.0',
            },
            timeout: 30000,
            validateStatus: () => true,
        });

        if (response.status >= 200 && response.status < 300) {
            logger.info(`[ap-delivery] 已发送到 ${inbox}: ${response.status}`);
            return true;
        } else {
            logger.warn(`[ap-delivery] 发送到 ${inbox} 返回 ${response.status}: ${
                typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)
            }`);
            return false;
        }
    } catch (err) {
        logger.error(`[ap-delivery] 无法发送到 ${inbox}:`, err.message);
        return false;
    }
}

/**
 * 向用户的所有远程关注者投递活动
 * @param {number} userId - 用户 ID
 * @param {object} activity - 活动对象
 */
export async function deliverToFollowers(userId, activity) {
    const user = await getLocalUserById(userId);
    if (!user) {
        logger.warn(`[ap-delivery] 找不到用户 ${userId}, 跳过发送`);
        return;
    }

    const followers = await getRemoteFollowers(userId);
    if (followers.length === 0) {
        logger.debug(`[ap-delivery] 用户 ${userId} 没有远程关注者`);
        return;
    }

    // 按收件箱去重（共享收件箱优化）
    const inboxSet = new Map();
    for (const follower of followers) {
        // 尝试用共享收件箱
        let inbox = follower.inbox;
        try {
            const actor = await fetchRemoteActor(follower.actorUrl);
            if (actor) {
                inbox = getSharedInboxUrl(actor) || inbox;
            }
        } catch { /* 使用原始 inbox */ }

        if (inbox && !inboxSet.has(inbox)) {
            inboxSet.set(inbox, true);
        }
    }

    logger.info(`[ap-delivery] 为用户 ${userId} 发送了 ${inboxSet.size} 个不同收件箱的消息`);

    // 并发投递（限制并发数）
    const inboxes = [...inboxSet.keys()];
    const CONCURRENCY = 5;

    for (let i = 0; i < inboxes.length; i += CONCURRENCY) {
        const batch = inboxes.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
            batch.map(inbox =>
                deliverActivity({
                    inbox,
                    activity,
                    userId: user.id,
                    username: user.username,
                })
            )
        );
    }
}

/**
 * 向特定 Actor 投递活动
 * @param {number} userId - 发送者用户 ID
 * @param {string} targetActorUrl - 目标 Actor URL
 * @param {object} activity - 活动对象
 */
export async function deliverToActor(userId, targetActorUrl, activity) {
    const user = await getLocalUserById(userId);
    if (!user) return false;

    const actor = await fetchRemoteActor(targetActorUrl);
    if (!actor || !actor.inbox) {
        logger.warn(`[ap-delivery] 无法为 ${targetActorUrl} 解析收件箱`);
        return false;
    }

    return deliverActivity({
        inbox: actor.inbox,
        activity,
        userId: user.id,
        username: user.username,
    });
}
