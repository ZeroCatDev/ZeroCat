import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import gitSyncService from '../../gitSync/syncService.js';

let worker = null;

async function processGitSync(job) {
    const type = String(job?.data?.type || '');
    switch (type) {
        case 'sync-project':
            return gitSyncService.syncProjectCommit(job);
        default:
            throw new Error(`未知 git-sync 任务类型: ${type}`);
    }
}

async function createGitSyncWorker() {
    const enabled = await zcconfig.get('git.sync.enabled', false);
    if (!enabled) {
        logger.info('[git-sync] 功能未启用，worker 不启动');
        return null;
    }

    const concurrency = Number(await zcconfig.get('git.sync.queue.concurrency', 1)) || 1;
    const limiterMax = Number(await zcconfig.get('git.sync.queue.limiter.max', 6)) || 6;
    const limiterDuration = Number(await zcconfig.get('git.sync.queue.limiter.duration_ms', 60000)) || 60000;
    const connection = await createConnection('worker-git-sync');

    worker = new Worker(QUEUE_NAMES.GIT_SYNC, processGitSync, {
        connection,
        concurrency: Math.max(1, concurrency),
        limiter: limiterMax > 0 ? { max: limiterMax, duration: limiterDuration } : undefined,
    });

    worker.on('completed', (job, result) => {
        logger.info(`[git-sync] Job ${job.id} (${job.name}) completed: ${JSON.stringify(result)}`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[git-sync] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    worker.on('error', (err) => {
        logger.error('[git-sync] Worker error:', err.message);
    });

    logger.info(`[git-sync] Worker started concurrency=${Math.max(1, concurrency)}`);
    return worker;
}

function getGitSyncWorker() {
    return worker;
}

export { createGitSyncWorker, getGitSyncWorker };
