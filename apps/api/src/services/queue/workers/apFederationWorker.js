/**
 * ActivityPub 联邦任务 Worker
 * 处理所有 AP 协议相关的异步任务：
 *   - ap_inbox          收件箱活动处理（远程 → 本地）
 *   - ap_deliver        单次活动投递（本地 → 远程 inbox）
 *   - ap_deliver_followers  向所有远程关注者投递活动
 *   - ap_follow_sync    发送 Follow 到远程
 *   - ap_unfollow_sync  发送 Undo(Follow) 到远程
 *   - ap_fetch_posts    拉取远程用户帖子
 *   - ap_backfill       向新关注者回填历史帖子
 */

import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import logger from '../../logger.js';

let worker = null;

/**
 * AP 联邦任务路由
 */
async function processApFederation(job) {
    const { eventType } = job.data;

    switch (eventType) {
        case 'ap_inbox':
            return await handleInboxJob(job);
        case 'ap_deliver':
            return await handleDeliverJob(job);
        case 'ap_deliver_followers':
            return await handleDeliverFollowersJob(job);
        case 'ap_follow_sync':
            return await handleFollowSyncJob(job);
        case 'ap_unfollow_sync':
            return await handleUnfollowSyncJob(job);
        case 'ap_fetch_posts':
            return await handleFetchPostsJob(job);
        case 'ap_backfill':
            return await handleBackfillJob(job);
        default:
            logger.warn(`[ap-federation-worker] 未知任务类型: ${eventType}`);
            return { handled: false, eventType };
    }
}

// ─── ap_inbox: 处理收件箱活动 ─────────────────────────────────

async function handleInboxJob(job) {
    const { activity, remoteActor, targetUsername } = job.data;

    await job.log(`inbox start type=${activity?.type} from=${remoteActor?.id} target=${targetUsername || 'shared'}`);

    const { processInboxActivity } = await import('../../activitypub/inbox.js');
    const result = await processInboxActivity(activity, remoteActor, targetUsername);

    await job.log(`inbox done type=${activity?.type} handled=${result?.handled}`);
    return result;
}

// ─── ap_deliver: 签名 POST 到单个远程 inbox ──────────────────

async function handleDeliverJob(job) {
    const { inbox, activity, userId, username } = job.data;

    await job.log(`deliver start inbox=${inbox} userId=${userId}`);

    const { deliverActivity } = await import('../../activitypub/delivery.js');
    const success = await deliverActivity({
        inbox,
        activity,
        userId,
        username,
        skipDedup: false,
    });

    if (!success) {
        // 投递失败让 BullMQ 重试
        throw new Error(`投递到 ${inbox} 失败`);
    }

    await job.log(`deliver done inbox=${inbox} success=${success}`);
    return { delivered: true, inbox };
}

// ─── ap_deliver_followers: 向所有远程关注者投递 ─────────────────

async function handleDeliverFollowersJob(job) {
    const { userId, activity, skipDedup } = job.data;

    await job.log(`deliver_followers start userId=${userId}`);

    const { deliverToFollowers } = await import('../../activitypub/delivery.js');
    await deliverToFollowers(userId, activity, { skipDedup: skipDedup || false });

    await job.log(`deliver_followers done userId=${userId}`);
    return { delivered: true, userId };
}

// ─── ap_follow_sync: 同步关注到远程 ─────────────────────────

async function handleFollowSyncJob(job) {
    const { followerId, followedId } = job.data;

    await job.log(`follow_sync start follower=${followerId} followed=${followedId}`);

    const { syncFollowToRemote } = await import('../../activitypub/followSync.js');
    await syncFollowToRemote(followerId, followedId);

    await job.log(`follow_sync done follower=${followerId}`);
    return { synced: true, followerId, followedId };
}

// ─── ap_unfollow_sync: 同步取消关注到远程 ───────────────────

async function handleUnfollowSyncJob(job) {
    const { followerId, unfollowedId } = job.data;

    await job.log(`unfollow_sync start follower=${followerId} unfollowed=${unfollowedId}`);

    const { syncUnfollowToRemote } = await import('../../activitypub/followSync.js');
    await syncUnfollowToRemote(followerId, unfollowedId);

    await job.log(`unfollow_sync done follower=${followerId}`);
    return { synced: true, followerId, unfollowedId };
}

// ─── ap_fetch_posts: 拉取远程用户帖子 ──────────────────────

async function handleFetchPostsJob(job) {
    const { remoteActorUrl, maxPosts } = job.data;

    await job.log(`fetch_posts start actor=${remoteActorUrl} max=${maxPosts}`);

    const { fetchRemoteUserPosts } = await import('../../activitypub/remotePosts.js');
    await fetchRemoteUserPosts(remoteActorUrl, maxPosts || 50);

    await job.log(`fetch_posts done actor=${remoteActorUrl}`);
    return { fetched: true, remoteActorUrl };
}

// ─── ap_backfill: 向新关注者回填历史帖子 ──────────────────────

async function handleBackfillJob(job) {
    const { userId, followerActorUrl } = job.data;

    await job.log(`backfill start user=${userId} follower=${followerActorUrl}`);

    const { backfillPostsToFollower } = await import('../../activitypub/outbox.js');
    await backfillPostsToFollower({ userId, followerActorUrl });

    await job.log(`backfill done user=${userId}`);
    return { backfilled: true, userId, followerActorUrl };
}

// ─── Worker 生命周期 ─────────────────────────────────────────

async function createApFederationWorker() {
    const connection = await createConnection('worker-ap-federation');

    worker = new Worker(
        QUEUE_NAMES.AP_FEDERATION,
        processApFederation,
        {
            connection,
            concurrency: 5,
            limiter: { max: 60, duration: 60000 },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[ap-federation] Job ${job.id} (${job.data?.eventType}) completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[ap-federation] Job ${job?.id} (${job?.data?.eventType}) failed: ${err.message}`);
    });

    worker.on('error', (err) => {
        logger.error(`[ap-federation] Worker error: ${err.message}`);
    });

    logger.info('[ap-federation] AP federation worker started');
    return worker;
}

function getApFederationWorker() {
    return worker;
}

export { createApFederationWorker, getApFederationWorker };
