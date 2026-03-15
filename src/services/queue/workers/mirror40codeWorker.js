import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES, getMirror40CodeQueue } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import mirror40CodeSyncService from '../../mirror40code/syncService.js';
import { enqueueProjectSyncJobs, enqueueUserSyncJobs, syncProjectAndAssets } from './mirror40codeWorkerTools.js';

let worker = null;

async function processFullSync(job) {
    await job.log('开始全量镜像：拉取40code用户列表');

    const userIds = await mirror40CodeSyncService.collectTopUserIds();
    await job.log(`已获取用户 ${userIds.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        throw new Error('mirror-40code queue 不可用，无法为用户入队');
    }

    const enqueuedUsers = await enqueueUserSyncJobs(queue, userIds, 'full-sync');

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

    if (result?.skipped) {
        await job.log(`用户 ${remoteUserId} 跳过: ${result.reason}`);
        return {
            mode: 'sync-user',
            remoteUserId,
            localUserId: result.localUserId || null,
            skipped: true,
            reason: result.reason,
            projects: 0,
            enqueuedProjects: 0,
        };
    }

    await job.log(`用户 ${remoteUserId} 同步完成，待同步项目 ${result.projectIds.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        await job.log('mirror-40code queue 不可用，跳过项目入队');
        return {
            mode: 'sync-user',
            remoteUserId,
            localUserId: result.localUserId,
            projects: result.projectIds.length,
            enqueuedProjects: 0,
        };
    }

    const projectItems = result.projectIds.map((projectId) => ({
        remoteProjectId: Number(projectId),
        remoteUserId,
    }));
    const enqueuedProjects = await enqueueProjectSyncJobs(queue, projectItems, 'user-sync');

    return {
        mode: 'sync-user',
        remoteUserId,
        localUserId: result.localUserId,
        projects: result.projectIds.length,
        enqueuedProjects,
    };
}

async function processIncrementalUsers(job) {
    await job.log('开始增量扫描40code新用户');
    const userIds = await mirror40CodeSyncService.collectIncrementalNewUserIds();
    await job.log(`增量发现用户 ${userIds.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        throw new Error('mirror-40code queue 不可用，无法为增量用户入队');
    }

    const enqueuedUsers = await enqueueUserSyncJobs(queue, userIds, 'incremental-users');

    await job.log(`增量用户入队完成: ${enqueuedUsers}/${userIds.length}`);
    return {
        mode: 'incremental-users',
        discoveredUsers: userIds.length,
        enqueuedUsers,
    };
}

async function processIncrementalProjects(job) {
    await job.log('开始增量同步项目：先触发新用户同步');

    const discoveredUsers = await mirror40CodeSyncService.collectIncrementalNewUserIds();
    await job.log(`增量项目前置：发现新用户 ${discoveredUsers.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        throw new Error('mirror-40code queue 不可用，无法为增量项目入队');
    }

    const enqueuedUsers = await enqueueUserSyncJobs(queue, discoveredUsers, 'incremental-projects-before-projects');
    await job.log(`增量项目前置：用户入队完成 ${enqueuedUsers}/${discoveredUsers.length}`);

    const projectItems = await mirror40CodeSyncService.collectIncrementalNewProjectItems();
    await job.log(`增量项目扫描完成，发现 ${projectItems.length} 个新项目`);

    const enqueuedProjects = await enqueueProjectSyncJobs(queue, projectItems, 'incremental-projects');
    await job.log(`增量项目入队完成: ${enqueuedProjects}/${projectItems.length}`);

    return {
        mode: 'incremental-projects',
        discoveredUsers: discoveredUsers.length,
        enqueuedUsers,
        discoveredProjects: projectItems.length,
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
    return syncProjectAndAssets(job, remoteProjectId, Number.isFinite(remoteUserId) ? remoteUserId : null);
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
    case 'incremental-users':
        return processIncrementalUsers(job);
    case 'incremental-projects':
        return processIncrementalProjects(job);
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

    logger.info(`[mirror-40code] Worker started concurrency=${Math.max(1, concurrency)}`);
    return worker;
}

function getMirror40CodeWorker() {
    return worker;
}

export { createMirror40CodeWorker, getMirror40CodeWorker };
