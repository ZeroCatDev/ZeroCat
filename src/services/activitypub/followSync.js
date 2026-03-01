/**
 * 关注同步服务
 * 将本地用户对远程代理账户的关注/取消关注操作同步到远端 ActivityPub 实例
 */

import { prisma } from '../prisma.js';
import logger from '../logger.js';
import { getInstanceDomain, isFederationEnabled } from './config.js';
import { getActorUrl } from './actor.js';
import { buildFollowActivity, buildUndoActivity } from './objects.js';
import { deliverToActor } from './delivery.js';
import { isRemoteProxyUser, getProxyUserActorUrl, getRemoteUserInfo } from './remoteUser.js';
import { isActorAllowed } from './federationConfig.js';
import { upsertTargetConfig, getTargetConfig, deleteTargetConfig } from './store.js';
import { fetchRemoteUserPosts } from './remotePosts.js';
import { isAutoFetchPostsEnabled } from './federationConfig.js';

// 存储本地→远程关注状态的 target_type
const OUTBOUND_FOLLOW_TYPE = 'ap_outbound_follow';

/**
 * 处理本地用户关注行为
 * 如果被关注者是远程代理用户，将 Follow 活动发送到远端
 * @param {number} followerId - 本地关注者用户 ID
 * @param {number} followedId - 被关注者用户 ID（可能是代理用户）
 */
export async function syncFollowToRemote(followerId, followedId) {
    const enabled = await isFederationEnabled();
    if (!enabled) return;

    // 检查被关注者是否为远程代理用户
    const isRemote = await isRemoteProxyUser(followedId);
    if (!isRemote) return;

    // 获取远程 Actor URL
    const remoteActorUrl = await getProxyUserActorUrl(followedId);
    if (!remoteActorUrl) {
        logger.warn(`[ap-follow-sync] 远程代理用户 #${followedId} 没有 Actor URL`);
        return;
    }

    // 检查实例是否允许
    const allowed = await isActorAllowed(remoteActorUrl);
    if (!allowed) {
        logger.warn(`[ap-follow-sync] 远程实例不被允许: ${remoteActorUrl}`);
        return;
    }

    // 获取本地关注者信息
    const follower = await prisma.ow_users.findUnique({
        where: { id: followerId },
        select: { id: true, username: true },
    });
    if (!follower) return;

    try {
        // 构建 Follow 活动
        const actorUrl = await getActorUrl(follower.username);
        const followActivity = await buildFollowActivity(actorUrl, remoteActorUrl);

        // 发送到远程
        const success = await deliverToActor(followerId, remoteActorUrl, followActivity);

        if (success) {
            // 记录出站关注状态
            await upsertTargetConfig(
                OUTBOUND_FOLLOW_TYPE,
                String(followerId),
                `follow:${followedId}`,
                JSON.stringify({
                    remoteActorUrl,
                    followActivityId: followActivity.id,
                    followedAt: new Date().toISOString(),
                    status: 'pending', // 等待远端 Accept
                })
            );

            logger.info(`[ap-follow-sync] 已发送 Follow 到远端: ${follower.username} -> ${remoteActorUrl}`);

            // 自动拉取该用户的帖子
            const autoFetch = await isAutoFetchPostsEnabled();
            if (autoFetch) {
                // 异步拉取，不阻塞
                fetchRemoteUserPosts(remoteActorUrl, 50).catch(err => {
                    logger.error(`[ap-follow-sync] 自动拉取帖子失败:`, err.message);
                });
            }
        } else {
            logger.warn(`[ap-follow-sync] 发送 Follow 失败: ${follower.username} -> ${remoteActorUrl}`);
        }
    } catch (err) {
        logger.error(`[ap-follow-sync] 同步关注失败:`, err.message);
    }
}

/**
 * 处理本地用户取消关注行为
 * 如果被取消关注者是远程代理用户，发送 Undo(Follow) 到远端
 * @param {number} followerId
 * @param {number} unfollowedId
 */
export async function syncUnfollowToRemote(followerId, unfollowedId) {
    const enabled = await isFederationEnabled();
    if (!enabled) return;

    const isRemote = await isRemoteProxyUser(unfollowedId);
    if (!isRemote) return;

    const remoteActorUrl = await getProxyUserActorUrl(unfollowedId);
    if (!remoteActorUrl) return;

    const follower = await prisma.ow_users.findUnique({
        where: { id: followerId },
        select: { id: true, username: true },
    });
    if (!follower) return;

    try {
        const actorUrl = await getActorUrl(follower.username);

        // 获取之前的 follow activity ID
        const followRecordRaw = await getTargetConfig(
            OUTBOUND_FOLLOW_TYPE,
            String(followerId),
            `follow:${unfollowedId}`
        );

        let followActivityId = null;
        if (followRecordRaw) {
            try {
                const record = JSON.parse(followRecordRaw);
                followActivityId = record.followActivityId;
            } catch { /* ignore */ }
        }

        // 构建 Undo(Follow) 活动
        const followActivity = await buildFollowActivity(actorUrl, remoteActorUrl);
        if (followActivityId) {
            followActivity.id = followActivityId;
        }
        const undoActivity = await buildUndoActivity(actorUrl, followActivity);

        await deliverToActor(followerId, remoteActorUrl, undoActivity);

        // 删除出站关注记录
        await deleteTargetConfig(OUTBOUND_FOLLOW_TYPE, String(followerId), `follow:${unfollowedId}`);

        logger.info(`[ap-follow-sync] 已发送 Undo(Follow) 到远端: ${follower.username} -> ${remoteActorUrl}`);
    } catch (err) {
        logger.error(`[ap-follow-sync] 同步取消关注失败:`, err.message);
    }
}

/**
 * 处理远端返回的 Accept(Follow)
 * @param {object} activity - Accept 活动
 * @param {object} remoteActor - 远程 Actor
 */
export async function handleFollowAccepted(activity, remoteActor) {
    const inner = typeof activity.object === 'string' ? { id: activity.object } : activity.object;
    if (!inner || inner.type !== 'Follow') return;

    // 找到对应的本地发起者
    const actorUrl = typeof inner.actor === 'string' ? inner.actor : inner.actor?.id;
    if (!actorUrl) return;

    const instanceDomain = await getInstanceDomain();
    const usernameMatch = actorUrl.match(/\/ap\/users\/([^/]+)$/);
    if (!usernameMatch) return;

    const localUser = await prisma.ow_users.findFirst({
        where: { username: usernameMatch[1], status: 'active' },
        select: { id: true },
    });
    if (!localUser) return;

    // 更新出站关注状态为 accepted
    // 需要找到对应的代理用户
    const { findProxyUserByActorUrl } = await import('./remoteUser.js');
    const proxyUser = await findProxyUserByActorUrl(remoteActor.id);
    if (!proxyUser) return;

    const key = `follow:${proxyUser.id}`;
    const existing = await getTargetConfig(OUTBOUND_FOLLOW_TYPE, String(localUser.id), key);
    if (existing) {
        try {
            const record = JSON.parse(existing);
            record.status = 'accepted';
            record.acceptedAt = new Date().toISOString();
            await upsertTargetConfig(OUTBOUND_FOLLOW_TYPE, String(localUser.id), key, JSON.stringify(record));
            logger.info(`[ap-follow-sync] 远端已接受关注: user #${localUser.id} -> ${remoteActor.id}`);
        } catch { /* ignore */ }
    }
}

/**
 * 处理远端返回的 Reject(Follow)
 * @param {object} activity
 * @param {object} remoteActor
 */
export async function handleFollowRejected(activity, remoteActor) {
    const inner = typeof activity.object === 'string' ? { id: activity.object } : activity.object;
    if (!inner || inner.type !== 'Follow') return;

    const actorUrl = typeof inner.actor === 'string' ? inner.actor : inner.actor?.id;
    if (!actorUrl) return;

    const usernameMatch = actorUrl.match(/\/ap\/users\/([^/]+)$/);
    if (!usernameMatch) return;

    const localUser = await prisma.ow_users.findFirst({
        where: { username: usernameMatch[1], status: 'active' },
        select: { id: true },
    });
    if (!localUser) return;

    const { findProxyUserByActorUrl } = await import('./remoteUser.js');
    const proxyUser = await findProxyUserByActorUrl(remoteActor.id);
    if (!proxyUser) return;

    // 删除本地关注关系
    await prisma.ow_user_relationships.deleteMany({
        where: {
            source_user_id: localUser.id,
            target_user_id: proxyUser.id,
            relationship_type: 'follow',
        },
    });

    // 删除出站关注记录
    await deleteTargetConfig(OUTBOUND_FOLLOW_TYPE, String(localUser.id), `follow:${proxyUser.id}`);

    logger.info(`[ap-follow-sync] 远端拒绝关注: user #${localUser.id} -> ${remoteActor.id}`);
}

/**
 * 获取用户的出站关注状态列表
 * @param {number} userId
 * @returns {Array}
 */
export async function getOutboundFollows(userId) {
    const { queryTargetConfigs } = await import('./store.js');
    const records = await queryTargetConfigs(OUTBOUND_FOLLOW_TYPE, String(userId), 'follow:', 200, 0);
    return records.map(r => {
        try {
            return { key: r.key, ...JSON.parse(r.value) };
        } catch {
            return null;
        }
    }).filter(Boolean);
}
