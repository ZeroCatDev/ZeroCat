import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import { syncPostToEnabledPlatforms } from '../../social/socialSync.js';
import logger from '../../logger.js';

let worker = null;

async function processSocialSync(job) {
    const { userId, postId } = job.data;
    await job.log(`sync start user=${userId} post=${postId}`);
    const result = await syncPostToEnabledPlatforms({ userId, postId });
    await job.log(`sync done post=${postId}`);
    return result;
}

async function createSocialSyncWorker() {
    const connection = await createConnection('worker-social-sync');

    worker = new Worker(
        QUEUE_NAMES.SOCIAL_SYNC,
        processSocialSync,
        {
            connection,
            concurrency: 2,
            limiter: { max: 30, duration: 60000 },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[social-sync] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[social-sync] Job ${job?.id} failed:`+ err.message);
    });

    worker.on('error', (err) => {
        logger.error('[social-sync] Worker error:'+ err.message);
    });

    logger.info('[social-sync] Social sync worker started');
    return worker;
}

function getSocialSyncWorker() {
    return worker;
}

export { createSocialSyncWorker, getSocialSyncWorker };
