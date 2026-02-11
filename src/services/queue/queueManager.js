import { createQueues, getEmailQueue, getScheduledTasksQueue } from './queues.js';
import { createEmailWorker, getEmailWorker } from './workers/emailWorker.js';
import { createScheduledTasksWorker, getScheduledTasksWorker } from './workers/scheduledTasksWorker.js';
import { closeAll as closeAllConnections } from './redisConnectionFactory.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import { encodeMailOptionsForJob } from './mailJobCodec.js';

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

    async enqueueEmail(to, subject, html, options = {}) {
        return this.enqueueMail({ to, subject, html }, options);
    },

    async enqueueMail(mailOptions = {}, options = {}) {
        const emailQueue = getEmailQueue();
        if (!emailQueue || !initialized) {
            throw new Error('BullMQ email queue is not initialized');
        }

        try {
            const maxRetries = await zcconfig.get('bullmq.email.maxRetries') || 3;
            const retryDelay = await zcconfig.get('bullmq.email.retryDelay') || 60000;
            const encodedMailOptions = encodeMailOptionsForJob(mailOptions);
            const recipient = encodedMailOptions?.to || '(unknown recipient)';

            const job = await emailQueue.add('send-email', { mailOptions: encodedMailOptions }, {
                attempts: maxRetries,
                backoff: {
                    type: 'exponential',
                    delay: retryDelay,
                },
                ...options,
            });

            logger.info(`[queue-manager] Email job ${job.id} enqueued for ${recipient}`);
            return { jobId: job.id, queued: true };
        } catch (error) {
            logger.error('[queue-manager] Failed to enqueue email job:', error.message);
            throw error;
        }
    },

    async shutdown() {
        if (!initialized) return;

        logger.info('[queue-manager] Shutting down BullMQ...');

        try {
            // Close workers first
            const emailWorker = getEmailWorker();
            const scheduledWorker = getScheduledTasksWorker();

            if (emailWorker) await emailWorker.close();
            if (scheduledWorker) await scheduledWorker.close();

            // Close queues
            const emailQueue = getEmailQueue();
            const scheduledQueue = getScheduledTasksQueue();

            if (emailQueue) await emailQueue.close();
            if (scheduledQueue) await scheduledQueue.close();

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
