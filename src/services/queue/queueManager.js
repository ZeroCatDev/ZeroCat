import { createTransport } from 'nodemailer';
import { createQueues, getEmailQueue, getScheduledTasksQueue, getCommentNotificationQueue, getDataTaskQueue, getSocialSyncQueue, getApFederationQueue, getEmbeddingQueue, getMirror40CodeQueue } from './queues.js';
import { createEmailWorker, getEmailWorker } from './workers/emailWorker.js';
import { createScheduledTasksWorker, getScheduledTasksWorker } from './workers/scheduledTasksWorker.js';
import { createCommentNotificationWorker, getCommentNotificationWorker } from './workers/commentNotificationWorker.js';
import { createDataTaskWorker, getDataTaskWorker } from './workers/dataTaskWorker.js';
import { createSocialSyncWorker, getSocialSyncWorker } from './workers/socialSyncWorker.js';
import { createApFederationWorker, getApFederationWorker } from './workers/apFederationWorker.js';
import { createEmbeddingWorker, getEmbeddingWorker } from './workers/embeddingWorker.js';
import { createMirror40CodeWorker, getMirror40CodeWorker } from './workers/mirror40codeWorker.js';
import { closeAll as closeAllConnections } from './redisConnectionFactory.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

let initialized = false;

/** Sanitize a value for use in BullMQ jobId (no colons or special chars) */
const sanitize = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '_');

const queueManager = {
    async syncMirror40CodeSchedulers() {
        const mirrorQueue = getMirror40CodeQueue();
        if (!mirrorQueue) return;

        const mirrorEnabled = await zcconfig.get('mirror40code.enabled', false);
        const periodicEnabled = await zcconfig.get('mirror40code.periodic.enabled', true);
        const schedulerIds = [
            'mirror40code-periodic-daily-sync',
        ];

        if (!mirrorEnabled || !periodicEnabled) {
            if (typeof mirrorQueue.removeJobScheduler === 'function') {
                for (const schedulerId of schedulerIds) {
                    await mirrorQueue.removeJobScheduler(schedulerId).catch(() => {});
                }
            }
            logger.info('[queue-manager] Mirror40Code periodic scheduler disabled');
            return;
        }

        if (typeof mirrorQueue.upsertJobScheduler !== 'function') {
            logger.warn('[queue-manager] Mirror40Code queue does not support upsertJobScheduler, skip periodic scheduler');
            return;
        }

        const upsertOrRemove = async ({
            schedulerId,
            enabled,
            every,
            type,
        }) => {
            if (!enabled) {
                if (typeof mirrorQueue.removeJobScheduler === 'function') {
                    await mirrorQueue.removeJobScheduler(schedulerId).catch(() => {});
                }
                return;
            }

            await mirrorQueue.upsertJobScheduler(
                schedulerId,
                { every },
                {
                    name: type,
                    data: {
                        type,
                        triggeredBy: 'periodic-scheduler',
                    },
                    opts: {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 30000 },
                        removeOnComplete: { age: 86400 },
                        removeOnFail: { age: 604800 },
                    },
                }
            );
        };

        const dailySyncEnabled = await zcconfig.get('mirror40code.periodic.daily_sync.enabled', true);
        const dailySyncInterval = Math.max(60000, Number(await zcconfig.get('mirror40code.periodic.daily_sync.interval_ms', 604800000)) || 604800000);
        await upsertOrRemove({
            schedulerId: 'mirror40code-periodic-daily-sync',
            enabled: dailySyncEnabled,
            every: dailySyncInterval,
            type: 'daily-sync',
        });

        logger.info('[queue-manager] Mirror40Code periodic schedulers synced');
    },

    async initialize() {
        const enabled = await zcconfig.get('bullmq.enabled');
        if (enabled === false) {
            logger.info('[queue-manager] BullMQ is disabled by configuration');
            return;
        }

        try {
            // Create queues
            await createQueues();

            // Create workers
            await createEmailWorker();
            await createScheduledTasksWorker();
            await createCommentNotificationWorker();
            await createDataTaskWorker();
            await createSocialSyncWorker();
            await createApFederationWorker();

            // Embedding worker（仅在 embedding.enabled 开启时创建）
            const embeddingEnabled = await zcconfig.get('embedding.enabled');
            if (embeddingEnabled) {
                await createEmbeddingWorker();
                logger.info('[queue-manager] Embedding worker created');
            }

            // Mirror40Code worker
            const mirror40CodeEnabled = await zcconfig.get('mirror40code.enabled', false);
            if (mirror40CodeEnabled) {
                await createMirror40CodeWorker();
                logger.info('[queue-manager] Mirror40Code worker created');
            }

            await this.syncMirror40CodeSchedulers();

            // Register repeatable jobs
            await this.registerRepeatableJobs();

            initialized = true;
            logger.info('[queue-manager] BullMQ initialized successfully');
        } catch (error) {
            logger.error('[queue-manager] BullMQ initialization failed:', error);
            throw error;
        }
    },

    async registerRepeatableJobs() {
        const scheduledQueue = getScheduledTasksQueue();
        if (!scheduledQueue) return;

        const removeSchedulerIfSupported = async (id) => {
            if (typeof scheduledQueue.removeJobScheduler === 'function') {
                await scheduledQueue.removeJobScheduler(id);
                logger.info(`[queue-manager] Job scheduler "${id}" removed`);
                return true;
            }
            logger.warn(`[queue-manager] removeJobScheduler not supported, cannot remove "${id}"`);
            return false;
        };

        const upsertOrRemove = async (id, enabled, schedule, job) => {
            if (!enabled) {
                await removeSchedulerIfSupported(id);
                return;
            }
            await scheduledQueue.upsertJobScheduler(id, schedule, job);
        };

        // hourly-cleanup: every hour
        await upsertOrRemove(
            'hourly-cleanup',
            true,
            { every: 3600000 },
            { name: 'hourly-cleanup', data: {} }
        );

        // daily-stats: every 24 hours
        await upsertOrRemove(
            'daily-stats',
            true,
            { every: 86400000 },
            { name: 'daily-stats', data: {} }
        );

        // memory-cache-cleanup: every hour
        await upsertOrRemove(
            'memory-cache-cleanup',
            true,
            { every: 3600000 },
            { name: 'memory-cache-cleanup', data: {} }
        );

        const sitemapEnabled = await zcconfig.get('sitemap.enabled');
        const sitemapAutoUpdate = await zcconfig.get('sitemap.auto_update');
        const sitemapCron = await zcconfig.get('sitemap.update_cron');
        const sitemapSchedule = sitemapCron
            ? { pattern: sitemapCron }
            : { every: 86400000 };

        await upsertOrRemove(
            'sitemap-auto-update',
            sitemapEnabled !== false && sitemapAutoUpdate !== false,
            sitemapSchedule,
            { name: 'sitemap-auto-update', data: {} }
        );

        // extension-sync: every 5 minutes
        await upsertOrRemove(
            'extension-sync',
            true,
            { every: 300000 },
            { name: 'extension-sync', data: {} }
        );

        // embedding-daily-project-check: every day
        const embeddingEnabled = await zcconfig.get('embedding.enabled', false);
        const embeddingDailyProjectCheckEnabled = await zcconfig.get('embedding.periodic.project_check.enabled', true);
        const embeddingDailyProjectCheckInterval = Math.max(
            60000,
            Number(await zcconfig.get('embedding.periodic.project_check.interval_ms', 86400000)) || 86400000
        );

        await upsertOrRemove(
            'embedding-daily-project-check',
            embeddingEnabled && embeddingDailyProjectCheckEnabled,
            { every: embeddingDailyProjectCheckInterval },
            { name: 'embedding-daily-project-check', data: {} }
        );

        logger.info('[queue-manager] Repeatable jobs synchronized');
    },

    async enqueueCommentNotification(type, commentId, spaceId, spaceCuid) {
        const queue = getCommentNotificationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Comment notification queue not available, skipping');
            return null;
        }

        // 用 type+commentId 做 jobId 去重，避免重复通知
        const jobId = `cn-${type}-${commentId}`;

        try {
            const job = await queue.add('comment-notification', {
                type,
                commentId,
                spaceId,
                spaceCuid,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 30000 },
                delay: 5000, // 5秒延迟，留出即时编辑窗口
            });

            logger.info(`[queue-manager] Comment notification job ${job.id} enqueued (${type})`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue comment notification:', error.message);
            return null;
        }
    },

    async enqueueDataTask(taskId, type, spaceId, spaceCuid, spaceName, userId, importData = null) {
        const queue = getDataTaskQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Data task queue not available');
            return null;
        }

        try {
            const job = await queue.add('data-task', {
                taskId,
                type,
                spaceId,
                spaceCuid,
                spaceName,
                userId,
                importData,
            }, {
                jobId: `dt-${taskId}`,
                attempts: 1,
                removeOnComplete: { age: 3600 },
                removeOnFail: { age: 86400 },
            });

            logger.info(`[queue-manager] Data task job ${job.id} enqueued (${type})`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue data task:', error.message);
            return null;
        }
    },

    async enqueueSocialPostSync(userId, postId, trigger = 'auto') {
        const queue = getSocialSyncQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Social sync queue not available');
            return null;
        }

        try {
            const eventType = typeof trigger === 'string' ? trigger : String(trigger?.eventType || 'auto');
            const eventPayload = typeof trigger === 'object' && trigger
                ? trigger
                : { eventType };
            const jobId = `ss-${sanitize(eventType)}-${postId}-${userId}-${Date.now()}`;

            const job = await queue.add(
                'sync-post',
                {
                    actorUserId: Number(userId),
                    postId: Number(postId),
                    eventType,
                    ...eventPayload,
                },
                {
                    jobId,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 10000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                }
            );

            logger.info(`[queue-manager] Social sync job ${job.id} enqueued for post=${postId}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue social sync job:', error.message);
            return null;
        }
    },

    // ─── ActivityPub 联邦任务入队方法 ──────────────────────────

    /**
     * 将收件箱活动处理加入队列
     * @param {object} activity - AP 活动对象
     * @param {object} remoteActor - 远程 Actor 对象
     * @param {string|null} targetUsername - 目标用户名（用户收件箱）或 null（共享收件箱）
     */
    async enqueueApInbox(activity, remoteActor, targetUsername = null) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available, processing inline');
            // 降级：直接处理
            const { processInboxActivity } = await import('../activitypub/inbox.js');
            return processInboxActivity(activity, remoteActor, targetUsername);
        }

        try {
            const activityId = sanitize(activity?.id || `${activity?.type}-${Date.now()}`);
            const jobId = `ap-inbox-${activityId}-${Date.now()}`;

            const job = await queue.add('ap_inbox', {
                eventType: 'ap_inbox',
                activity,
                remoteActor,
                targetUsername,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            logger.info(`[queue-manager] AP inbox job ${job.id} enqueued (${activity?.type} from ${remoteActor?.id})`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP inbox job:'+ error);
            // 降级：直接处理
            const { processInboxActivity } = await import('../activitypub/inbox.js');
            return processInboxActivity(activity, remoteActor, targetUsername);
        }
    },

    /**
     * 将活动投递加入队列（单个 inbox）
     */
    async enqueueApDeliver(inbox, activity, userId, username) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for deliver');
            return null;
        }

        try {
            const jobId = `ap-deliver-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            const job = await queue.add('ap_deliver', {
                eventType: 'ap_deliver',
                inbox,
                activity,
                userId,
                username,
            }, {
                jobId,
                attempts: 5,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: { age: 43200 },
                removeOnFail: { age: 604800 },
            });

            logger.debug(`[queue-manager] AP deliver job ${job.id} enqueued -> ${inbox}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP deliver job:', error.message);
            return null;
        }
    },

    /**
     * 将向所有远程关注者投递活动加入队列
     */
    async enqueueApDeliverFollowers(userId, activity, skipDedup = false) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for deliver_followers');
            return null;
        }

        try {
            const jobId = `ap-deliver-followers-${userId}-${Date.now()}`;

            const job = await queue.add('ap_deliver_followers', {
                eventType: 'ap_deliver_followers',
                userId,
                activity,
                skipDedup,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            logger.info(`[queue-manager] AP deliver_followers job ${job.id} enqueued for user=${userId}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP deliver_followers job:', error.message);
            return null;
        }
    },

    /**
     * 将关注同步加入队列
     */
    async enqueueApFollowSync(followerId, followedId) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for follow_sync');
            return null;
        }

        try {
            const jobId = `ap-follow-${sanitize(followerId)}-${sanitize(followedId)}-${Date.now()}`;

            const job = await queue.add('ap_follow_sync', {
                eventType: 'ap_follow_sync',
                followerId,
                followedId,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            logger.info(`[queue-manager] AP follow_sync job ${job.id} enqueued (${followerId} -> ${followedId})`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP follow_sync job:', error.message);
            return null;
        }
    },

    /**
     * 将取消关注同步加入队列
     */
    async enqueueApUnfollowSync(followerId, unfollowedId) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for unfollow_sync');
            return null;
        }

        try {
            const jobId = `ap-unfollow-${sanitize(followerId)}-${sanitize(unfollowedId)}-${Date.now()}`;

            const job = await queue.add('ap_unfollow_sync', {
                eventType: 'ap_unfollow_sync',
                followerId,
                unfollowedId,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            logger.info(`[queue-manager] AP unfollow_sync job ${job.id} enqueued (${followerId} -> ${unfollowedId})`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP unfollow_sync job:', error.message);
            return null;
        }
    },

    /**
     * 将远程帖子拉取加入队列
     */
    async enqueueApFetchPosts(remoteActorUrl, maxPosts = 50) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for fetch_posts');
            return null;
        }

        try {
            const jobId = `ap-fetch-posts-${sanitize(remoteActorUrl)}-${Date.now()}`;

            const job = await queue.add('ap_fetch_posts', {
                eventType: 'ap_fetch_posts',
                remoteActorUrl,
                maxPosts,
            }, {
                jobId,
                attempts: 2,
                backoff: { type: 'exponential', delay: 30000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            logger.info(`[queue-manager] AP fetch_posts job ${job.id} enqueued for ${remoteActorUrl}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP fetch_posts job:', error.message);
            return null;
        }
    },

    /**
     * 将历史帖子回填加入队列
     */
    async enqueueApBackfill(userId, followerActorUrl) {
        const queue = getApFederationQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] AP federation queue not available for backfill');
            return null;
        }

        try {
            const jobId = `ap-backfill-${userId}-${Date.now()}`;

            const job = await queue.add('ap_backfill', {
                eventType: 'ap_backfill',
                userId,
                followerActorUrl,
            }, {
                jobId,
                attempts: 2,
                backoff: { type: 'exponential', delay: 30000 },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 100 },
            });

            logger.info(`[queue-manager] AP backfill job ${job.id} enqueued for user=${userId} -> ${followerActorUrl}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue AP backfill job:', error.message);
            return null;
        }
    },

    async enqueueEmail(to, subject, html, options = {}) {
        const emailQueue = getEmailQueue();
        if (!emailQueue || !initialized) {
            logger.warn('[queue-manager] Queue not initialized, sending email directly');
            return this._sendEmailDirect(to, subject, html);
        }

        try {
            const maxRetries = await zcconfig.get('bullmq.email.maxRetries') || 3;
            const retryDelay = await zcconfig.get('bullmq.email.retryDelay') || 60000;

            const job = await emailQueue.add('send-email', { to, subject, html }, {
                attempts: maxRetries,
                backoff: {
                    type: 'exponential',
                    delay: retryDelay,
                },
                ...options,
            });

            logger.info(`[queue-manager] Email job ${job.id} enqueued for ${to}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue email, sending directly:', error.message);
            return this._sendEmailDirect(to, subject, html);
        }
    },

    async _sendEmailDirect(to, subject, html) {
        const host = await zcconfig.get('mail.host');
        const port = await zcconfig.get('mail.port');
        const secure = await zcconfig.get('mail.secure');
        const user = await zcconfig.get('mail.auth.user');
        const pass = await zcconfig.get('mail.auth.pass');
        const fromName = await zcconfig.get('mail.from_name');
        const fromAddress = await zcconfig.get('mail.from_address');

        if (!host || !port || !user || !pass) {
            throw new Error('Email service is not available or not properly configured');
        }

        const transporter = createTransport({ host, port, secure, auth: { user, pass } });
        const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

        await transporter.sendMail({ from, to, subject, html });
        return { queued: false, sentDirectly: true };
    },

    async shutdown() {
        if (!initialized) return;

        logger.info('[queue-manager] Shutting down BullMQ...');

        try {
            // Close workers first
            const emailWorker = getEmailWorker();
            const scheduledWorker = getScheduledTasksWorker();
            const commentNotificationWorker = getCommentNotificationWorker();
            const dataTaskWorker = getDataTaskWorker();
            const socialSyncWorker = getSocialSyncWorker();
            const apFederationWorker = getApFederationWorker();
            const mirror40CodeWorker = getMirror40CodeWorker();

            if (emailWorker) await emailWorker.close();
            if (scheduledWorker) await scheduledWorker.close();
            if (commentNotificationWorker) await commentNotificationWorker.close();
            if (dataTaskWorker) await dataTaskWorker.close();
            if (socialSyncWorker) await socialSyncWorker.close();
            if (apFederationWorker) await apFederationWorker.close();
            if (mirror40CodeWorker) await mirror40CodeWorker.close();

            const embeddingWorker = getEmbeddingWorker();
            if (embeddingWorker) await embeddingWorker.close();

            // Close queues
            const emailQueue = getEmailQueue();
            const scheduledQueue = getScheduledTasksQueue();
            const commentNotificationQueue = getCommentNotificationQueue();
            const dataTaskQueue = getDataTaskQueue();
            const socialSyncQueue = getSocialSyncQueue();
            const apFederationQueue = getApFederationQueue();
            const mirror40CodeQueue = getMirror40CodeQueue();

            if (emailQueue) await emailQueue.close();
            if (scheduledQueue) await scheduledQueue.close();
            if (commentNotificationQueue) await commentNotificationQueue.close();
            if (dataTaskQueue) await dataTaskQueue.close();
            if (socialSyncQueue) await socialSyncQueue.close();
            if (apFederationQueue) await apFederationQueue.close();
            if (mirror40CodeQueue) await mirror40CodeQueue.close();

            const embeddingQueue = getEmbeddingQueue();
            if (embeddingQueue) await embeddingQueue.close();

            // Close redis connections
            await closeAllConnections();

            initialized = false;
            logger.info('[queue-manager] BullMQ shut down successfully');
        } catch (error) {
            logger.error('[queue-manager] Error during shutdown:', error);
        }
    },

    isInitialized() {
        return initialized;
    },

    // ─── Embedding 向量生成入队方法 ──────────────────────────

    /**
     * 为单个帖子入队向量生成任务
     * @param {number} postId
     * @param {boolean} force - 强制重新生成（忽略 change detection）
     */
    async enqueuePostEmbedding(postId, force = false) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) {
            logger.debug('[queue-manager] Embedding queue not available, skipping post embedding');
            return null;
        }

        try {
            const jobId = `emb-post-${postId}`;
            const job = await queue.add('embedding', {
                type: 'post_embedding',
                postId: Number(postId),
                force,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
                // 去重: 相同 postId 的最新任务覆盖旧任务
                deduplication: { id: jobId },
            });

            logger.debug(`[queue-manager] Post embedding job ${job.id} enqueued for post=${postId}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue post embedding:', error.message);
            return null;
        }
    },

    /**
     * 为单个用户入队向量生成任务
     * @param {number} userId
     * @param {boolean} force
     */
    async enqueueUserEmbedding(userId, force = false, triggerType = 'scheduled') {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) {
            logger.debug('[queue-manager] Embedding queue not available, skipping user embedding');
            return null;
        }

        if (!force) {
            logger.debug(`[queue-manager] Auto user embedding disabled, skip user=${userId}, trigger=${triggerType}`);
            return { queued: false, skipped: true, reason: 'auto_user_embedding_disabled' };
        }

        try {
            const jobId = `emb-user-${userId}`;
            const job = await queue.add('embedding', {
                type: 'user_embedding',
                userId: Number(userId),
                force,
                triggerType,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
                deduplication: { id: jobId },
            });

            logger.debug(`[queue-manager] User embedding job ${job.id} enqueued for user=${userId}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue user embedding:', error.message);
            return null;
        }
    },

    /**
     * 批量入队帖子向量生成
     * @param {number[]} postIds
     * @param {boolean} force
     */
    async enqueueBatchPostEmbedding(postIds, force = false) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) return null;

        try {
            // 分批入队，每批 100
            const batchSize = 100;
            const jobs = [];
            for (let i = 0; i < postIds.length; i += batchSize) {
                const batch = postIds.slice(i, i + batchSize);
                const job = await queue.add('embedding', {
                    type: 'batch_post_embedding',
                    postIds: batch,
                    force,
                }, {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 20000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                });
                jobs.push(job.id);
            }

            logger.info(`[queue-manager] Batch post embedding: ${jobs.length} jobs enqueued for ${postIds.length} posts`);
            return { jobIds: jobs, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue batch post embedding:', error.message);
            return null;
        }
    },

    /**
     * 批量入队用户向量生成
     * @param {number[]} userIds
     * @param {boolean} force
     */
    async enqueueBatchUserEmbedding(userIds, force = false) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) return null;

        if (!force) {
            logger.debug('[queue-manager] Auto batch user embedding disabled');
            return { queued: false, skipped: true, reason: 'auto_user_embedding_disabled' };
        }

        try {
            const batchSize = 50;
            const jobs = [];
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const job = await queue.add('embedding', {
                    type: 'batch_user_embedding',
                    userIds: batch,
                    force,
                }, {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 20000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                });
                jobs.push(job.id);
            }

            logger.info(`[queue-manager] Batch user embedding: ${jobs.length} jobs enqueued for ${userIds.length} users`);
            return { jobIds: jobs, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue batch user embedding:', error.message);
            return null;
        }
    },

    /**
     * 为单个项目入队向量生成任务
     * @param {number} projectId
     * @param {boolean} force
     */
    async enqueueProjectEmbedding(projectId, force = false) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) {
            logger.debug('[queue-manager] Embedding queue not available, skipping project embedding');
            return null;
        }

        if (!force) {
            logger.debug(`[queue-manager] Auto project embedding disabled, skip project=${projectId}`);
            return { queued: false, skipped: true, reason: 'auto_project_embedding_disabled' };
        }

        try {
            const jobId = `emb-project-${projectId}`;
            const job = await queue.add('embedding', {
                type: 'project_embedding',
                projectId: Number(projectId),
                force,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
                deduplication: { id: jobId },
            });

            logger.debug(`[queue-manager] Project embedding job ${job.id} enqueued for project=${projectId}`);

            await this.enqueueProjectGorseSync(projectId, {
                reason: force ? 'project_embedding_force' : 'project_embedding',
                delayMs: 45000,
            });

            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue project embedding:', error.message);
            return null;
        }
    },

    /**
     * 批量入队项目向量生成
     * @param {number[]} projectIds
     * @param {boolean} force
     */
    async enqueueBatchProjectEmbedding(projectIds, force = false) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) return null;

        if (!force) {
            logger.debug('[queue-manager] Auto batch project embedding disabled');
            return { queued: false, skipped: true, reason: 'auto_project_embedding_disabled' };
        }

        try {
            const batchSize = 50;
            const jobs = [];
            for (let i = 0; i < projectIds.length; i += batchSize) {
                const batch = projectIds.slice(i, i + batchSize);
                const job = await queue.add('embedding', {
                    type: 'batch_project_embedding',
                    projectIds: batch,
                    force,
                }, {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 20000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                });
                jobs.push(job.id);
            }

            logger.info(`[queue-manager] Batch project embedding: ${jobs.length} jobs enqueued for ${projectIds.length} projects`);

            if (Array.isArray(projectIds) && projectIds.length > 0) {
                await this.enqueueBatchProjectGorseSync(projectIds, {
                    reason: force ? 'batch_project_embedding_force' : 'batch_project_embedding',
                    delayMs: 60000,
                });
            }

            return { jobIds: jobs, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue batch project embedding:', error.message);
            return null;
        }
    },

    /**
     * 为单个项目入队 Gorse 同步任务（独立于 project_embedding）
     * @param {number} projectId
     * @param {{reason?: string, delayMs?: number}} options
     */
    async enqueueProjectGorseSync(projectId, options = {}) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) {
            logger.debug('[queue-manager] Embedding queue not available, skipping project gorse sync');
            return null;
        }

        const reason = String(options?.reason || 'manual');
        const delayMs = Math.max(0, Number(options?.delayMs) || 0);

        try {
            const jobId = `gorse-project-${projectId}`;
            const job = await queue.add('embedding', {
                type: 'project_gorse_sync',
                projectId: Number(projectId),
                reason,
            }, {
                jobId,
                delay: delayMs,
                attempts: 5,
                backoff: { type: 'exponential', delay: 20000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
                deduplication: { id: jobId },
            });

            logger.debug(`[queue-manager] Project gorse sync job ${job.id} enqueued for project=${projectId}, reason=${reason}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue project gorse sync:', error.message);
            return null;
        }
    },

    /**
     * 批量入队项目 Gorse 同步任务
     * @param {number[]} projectIds
     * @param {{reason?: string, delayMs?: number}} options
     */
    async enqueueBatchProjectGorseSync(projectIds, options = {}) {
        const queue = getEmbeddingQueue();
        if (!queue || !initialized) return null;

        const reason = String(options?.reason || 'batch_manual');
        const delayMs = Math.max(0, Number(options?.delayMs) || 0);

        try {
            const results = [];
            for (const rawId of projectIds || []) {
                const projectId = Number(rawId);
                if (!Number.isInteger(projectId) || projectId <= 0) continue;

                const jobId = `gorse-project-${projectId}`;
                const job = await queue.add('embedding', {
                    type: 'project_gorse_sync',
                    projectId,
                    reason,
                }, {
                    jobId,
                    delay: delayMs,
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 20000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                    deduplication: { id: jobId },
                });

                results.push(job.id);
            }

            logger.info(`[queue-manager] Batch project gorse sync: ${results.length} jobs enqueued`);
            return { jobIds: results, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue batch project gorse sync:', error.message);
            return null;
        }
    },

    async enqueueMirror40CodeFullSync(options = {}) {
        const queue = getMirror40CodeQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Mirror40Code queue not available');
            return null;
        }

        const forceProjectSync = Boolean(options?.forceProjectSync);
        const jobId = 'm40-daily-sync';
        try {
            const job = await queue.add('daily-sync', {
                type: 'daily-sync',
                forceProjectSync,
                requestedAt: new Date().toISOString(),
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 3,
                backoff: { type: 'exponential', delay: 30000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            return { jobId: job.id, queued: true, forceProjectSync };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue Mirror40Code daily-sync:', error.message);
            return null;
        }
    },

    async enqueueMirror40CodeForceProjectSync() {
        const queue = getMirror40CodeQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Mirror40Code queue not available');
            return null;
        }

        const jobId = 'm40-force-sync-projects';
        try {
            const job = await queue.add('force-sync-projects', {
                type: 'force-sync-projects',
                forceProjectSync: true,
                requestedAt: new Date().toISOString(),
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 3,
                backoff: { type: 'exponential', delay: 30000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            return { jobId: job.id, queued: true, forceProjectSync: true, type: 'force-sync-projects' };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue Mirror40Code force-sync-projects:', error.message);
            return null;
        }
    },

    async enqueueMirror40CodeUserSync(remoteUserId, options = {}) {
        const queue = getMirror40CodeQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Mirror40Code queue not available');
            return null;
        }

        const parsedRemoteUserId = Number(remoteUserId);
        if (!Number.isFinite(parsedRemoteUserId) || parsedRemoteUserId <= 0) {
            throw new Error(`无效 remoteUserId: ${remoteUserId}`);
        }

        const forceSync = Boolean(options?.forceSync);
        const jobId = `m40-user-${parsedRemoteUserId}`;

        try {
            const job = await queue.add('sync-user', {
                type: 'sync-user',
                remoteUserId: parsedRemoteUserId,
                forceSync,
                requestedAt: new Date().toISOString(),
                triggeredBy: 'admin-api',
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });

            return {
                jobId: job.id,
                queued: true,
                remoteUserId: parsedRemoteUserId,
                forceSync,
            };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue Mirror40Code sync-user:', error.message);
            return null;
        }
    },

    async enqueueMirror40CodeProjectSync(remoteProjectId, options = {}) {
        const queue = getMirror40CodeQueue();
        if (!queue || !initialized) {
            logger.warn('[queue-manager] Mirror40Code queue not available');
            return null;
        }

        const parsedRemoteProjectId = Number(remoteProjectId);
        if (!Number.isFinite(parsedRemoteProjectId) || parsedRemoteProjectId <= 0) {
            throw new Error(`无效 remoteProjectId: ${remoteProjectId}`);
        }

        const remoteUserIdValue = Number(options?.remoteUserId);
        const remoteUserId = Number.isFinite(remoteUserIdValue) && remoteUserIdValue > 0
            ? remoteUserIdValue
            : null;

        const remoteUpdateTimeValue = Number(options?.remoteUpdateTime);
        const remoteUpdateTime = Number.isFinite(remoteUpdateTimeValue) && remoteUpdateTimeValue > 0
            ? remoteUpdateTimeValue
            : null;

        const jobId = `m40-project-${parsedRemoteProjectId}`;

        try {
            const job = await queue.add('sync-project', {
                type: 'sync-project',
                remoteProjectId: parsedRemoteProjectId,
                remoteUserId,
                remoteUpdateTime,
                requestedAt: new Date().toISOString(),
                triggeredBy: 'admin-api',
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: true,
                removeOnFail: { age: 604800 },
            });

            return {
                jobId: job.id,
                queued: true,
                remoteProjectId: parsedRemoteProjectId,
                remoteUserId,
                remoteUpdateTime,
            };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue Mirror40Code sync-project:', error.message);
            return null;
        }
    },

    async getMirror40CodeQueueStatus() {
        const queue = getMirror40CodeQueue();
        if (!queue || !initialized) {
            return {
                available: false,
                initialized,
            };
        }

        const [counts, jobs] = await Promise.all([
            queue.getJobCounts('active', 'completed', 'delayed', 'failed', 'paused', 'prioritized', 'waiting', 'waiting-children'),
            queue.getJobs(['active', 'waiting', 'delayed', 'failed', 'completed'], 0, 20, true),
        ]);

        return {
            available: true,
            initialized,
            counts,
            recentJobs: jobs.map((job) => ({
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress,
                attemptsMade: job.attemptsMade,
                failedReason: job.failedReason,
                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
            })),
        };
    },
};

export default queueManager;
