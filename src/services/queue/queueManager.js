import { createTransport } from 'nodemailer';
import { createQueues, getEmailQueue, getScheduledTasksQueue, getCommentNotificationQueue, getDataTaskQueue, getSocialSyncQueue } from './queues.js';
import { createEmailWorker, getEmailWorker } from './workers/emailWorker.js';
import { createScheduledTasksWorker, getScheduledTasksWorker } from './workers/scheduledTasksWorker.js';
import { createCommentNotificationWorker, getCommentNotificationWorker } from './workers/commentNotificationWorker.js';
import { createDataTaskWorker, getDataTaskWorker } from './workers/dataTaskWorker.js';
import { createSocialSyncWorker, getSocialSyncWorker } from './workers/socialSyncWorker.js';
import { closeAll as closeAllConnections } from './redisConnectionFactory.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

let initialized = false;

const queueManager = {
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
            const jobId = `ss-${eventType}-${postId}-${userId}-${Date.now()}`;

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

            if (emailWorker) await emailWorker.close();
            if (scheduledWorker) await scheduledWorker.close();
            if (commentNotificationWorker) await commentNotificationWorker.close();
            if (dataTaskWorker) await dataTaskWorker.close();
            if (socialSyncWorker) await socialSyncWorker.close();

            // Close queues
            const emailQueue = getEmailQueue();
            const scheduledQueue = getScheduledTasksQueue();
            const commentNotificationQueue = getCommentNotificationQueue();
            const dataTaskQueue = getDataTaskQueue();
            const socialSyncQueue = getSocialSyncQueue();

            if (emailQueue) await emailQueue.close();
            if (scheduledQueue) await scheduledQueue.close();
            if (commentNotificationQueue) await commentNotificationQueue.close();
            if (dataTaskQueue) await dataTaskQueue.close();
            if (socialSyncQueue) await socialSyncQueue.close();

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
};

export default queueManager;
