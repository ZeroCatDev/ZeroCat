import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES, getMirror40CodeQueue } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import mirror40CodeSyncService from '../../mirror40code/syncService.js';

let worker = null;

async function enqueueProjectJobs(projectIds, remoteUserId, job) {
    const queue = getMirror40CodeQueue();
    if (!queue) {
        await job.log('mirror-40code queue 不可用，跳过项目入队');
        return 0;
    }

    let enqueued = 0;
    for (const projectId of projectIds) {
        const normalizedId = Number(projectId);
        if (!Number.isFinite(normalizedId) || normalizedId <= 0) continue;

        const jobId = `m40-project-${normalizedId}`;
        try {
            await queue.add('sync-project', {
                type: 'sync-project',
                remoteProjectId: normalizedId,
                remoteUserId: Number(remoteUserId),
                triggeredBy: 'user-sync',
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });
            enqueued += 1;
        } catch (error) {
            if (!String(error?.message || '').includes('Job is already waiting')) {
                logger.warn(`[mirror-40code] 项目 ${normalizedId} 入队失败: ${error.message}`);
            }
        }
    }

    return enqueued;
}

async function processFullSync(job) {
    await job.log('开始全量镜像：拉取40code用户列表');

    const userIds = await mirror40CodeSyncService.collectTopUserIds();
    await job.log(`已获取用户 ${userIds.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        throw new Error('mirror-40code queue 不可用，无法为用户入队');
    }

    let enqueuedUsers = 0;
    for (const userId of userIds) {
        const jobId = `m40-user-${userId}`;
        try {
            await queue.add('sync-user', {
                type: 'sync-user',
                remoteUserId: userId,
                triggeredBy: 'full-sync',
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });
            enqueuedUsers += 1;
        } catch (error) {
            if (!String(error?.message || '').includes('Job is already waiting')) {
                logger.warn(`[mirror-40code] 用户 ${userId} 入队失败: ${error.message}`);
            }
        }
    }

    await job.log(`全量用户入队完成: ${enqueuedUsers}/${userIds.length}`);
    return {
        mode: 'full-sync',
        fetchedUsers: userIds.length,
        enqueuedUsers,
    };
}

async function processUserSync(job) {
    const remoteUserId = Number(job.data?.remoteUserId);
    if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) {
        throw new Error(`无效 remoteUserId: ${job.data?.remoteUserId}`);
    }

    await job.log(`开始同步用户 ${remoteUserId}`);
    const result = await mirror40CodeSyncService.syncUser(remoteUserId);
    await job.log(`用户 ${remoteUserId} 同步完成，待同步项目 ${result.projectIds.length} 个`);

    const enqueuedProjects = await enqueueProjectJobs(result.projectIds, remoteUserId, job);

    return {
        mode: 'sync-user',
        remoteUserId,
        localUserId: result.localUserId,
        projects: result.projectIds.length,
        enqueuedProjects,
    };
}

async function processProjectSync(job) {
    const remoteProjectId = Number(job.data?.remoteProjectId);
    const remoteUserId = Number(job.data?.remoteUserId);

    if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) {
        throw new Error(`无效 remoteProjectId: ${job.data?.remoteProjectId}`);
    }

    await job.log(`开始同步项目 ${remoteProjectId}`);
    const result = await mirror40CodeSyncService.syncProject(
        remoteProjectId,
        Number.isFinite(remoteUserId) ? remoteUserId : null
    );

    if (result?.skipped) {
        await job.log(`项目 ${remoteProjectId} 跳过: ${result.reason}`);
        return {
            mode: 'sync-project',
            remoteProjectId,
            skipped: true,
            reason: result.reason,
        };
    }

    await job.log(`项目 ${remoteProjectId} 同步完成，本地项目 ${result.localProjectId}，updated=${result.updated}`);
    return {
        mode: 'sync-project',
        ...result,
    };
}

async function processMirror40Code(job) {
    const type = String(job.data?.type || '');

    switch (type) {
    case 'full-sync':
        return processFullSync(job);
    case 'sync-user':
        return processUserSync(job);
    case 'sync-project':
        return processProjectSync(job);
    default:
        throw new Error(`未知 mirror40code 任务类型: ${type}`);
    }
}

async function createMirror40CodeWorker() {
    const enabled = await zcconfig.get('mirror40code.enabled', false);
    if (!enabled) {
        logger.info('[mirror-40code] 功能未启用，worker 不启动');
        return null;
    }

    const concurrency = Number(await zcconfig.get('mirror40code.queue.concurrency', 2)) || 2;
    const connection = await createConnection('worker-mirror-40code');

    worker = new Worker(
        QUEUE_NAMES.MIRROR_40CODE,
        processMirror40Code,
        {
            connection,
            concurrency: Math.max(1, concurrency),
            limiter: { max: 20, duration: 60000 },
        }
    );

    worker.on('completed', (job, result) => {
        logger.info(`[mirror-40code] Job ${job.id} (${job.name}) completed: ${JSON.stringify(result)}`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[mirror-40code] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    worker.on('error', (err) => {
        logger.error('[mirror-40code] Worker error:', err.message);
    });

    logger.info('[mirror-40code] Worker started');
    return worker;
}

function getMirror40CodeWorker() {
    return worker;
}

export { createMirror40CodeWorker, getMirror40CodeWorker };
