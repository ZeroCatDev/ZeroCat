import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES, getMirror40CodeQueue } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import mirror40CodeSyncService from '../../mirror40code/syncService.js';
import { enqueueProjectSyncJobs, enqueueUserSyncJobs, syncProjectAndAssets } from './mirror40codeWorkerTools.js';

let worker = null;

async function processDailySync(job) {
    await job.log('开始每日镜像同步：边扫描边分批入队');
    const forceProjectSync = Boolean(job.data?.forceProjectSync);
    if (forceProjectSync) {
        await job.log('项目同步模式=强制全量（忽略已同步状态）');
    }

    const queue = getMirror40CodeQueue();
    if (!queue) {
        throw new Error('mirror-40code queue 不可用，无法为每日同步入队');
    }

    const cfg = await mirror40CodeSyncService.getConfig();
    mirror40CodeSyncService.ensureEnabled(cfg);

    const maxUserPages = Math.max(1, Number(await zcconfig.get('mirror40code.daily.user_scan.max_pages', cfg.maxPages || 50)) || (cfg.maxPages || 50));
    const maxProjectPages = Math.max(1, Number(await zcconfig.get('mirror40code.daily.project_scan.max_pages', cfg.maxPages || 50)) || (cfg.maxPages || 50));

    const seenUserIds = new Set();
    const seenProjectIds = new Set();

    let discoveredUsers = 0;
    let discoveredSyncedUsers = 0;
    let discoveredProjects = 0;
    let enqueuedUsers = 0;
    let enqueuedProjects = 0;
    let firstSyncedRemoteUserId = null;

    let stopUserScan = false;
    for (let page = 1; page <= maxUserPages; page++) {
        if (stopUserScan) break;
        const result = await mirror40CodeSyncService.fetchSearchUsersPage(cfg, page);
        const list = Array.isArray(result?.list) ? result.list : [];
        await job.log(`用户扫描 page=${page} count=${list.length}`);

        if (list.length === 0) {
            break;
        }

        const userBatch = [];
        for (const item of list) {
            const remoteUserId = Number(item?.id || item?.uid || item?.userid);
            if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) continue;
            if (seenUserIds.has(remoteUserId)) continue;

            const mappedLocalUserId = await mirror40CodeSyncService.getMappedLocalUserId(remoteUserId);
            if (Number.isFinite(mappedLocalUserId) && mappedLocalUserId > 0) {
                stopUserScan = true;
                firstSyncedRemoteUserId = remoteUserId;
                await job.log(`用户扫描提前停止 page=${page} remoteUser=${remoteUserId} reason=already-synced localUser=${mappedLocalUserId}`);
                break;
            }

            seenUserIds.add(remoteUserId);
            userBatch.push(remoteUserId);
        }

        discoveredUsers += userBatch.length;
        if (userBatch.length > 0) {
            const queued = await enqueueUserSyncJobs(queue, userBatch, 'daily-sync-users');
            enqueuedUsers += queued;
            await job.log(`用户入队 page=${page} discovered=${userBatch.length} enqueued=${queued}`);
        }
    }

    if (firstSyncedRemoteUserId !== null) {
        const syncedRemoteUserIds = await mirror40CodeSyncService.listMappedRemoteUserIds({ includeSyncDisabled: false });
        discoveredSyncedUsers = syncedRemoteUserIds.length;
        const queued = await enqueueUserSyncJobs(queue, syncedRemoteUserIds, 'daily-sync-users-synced');
        enqueuedUsers += queued;
        await job.log(`已命中已同步用户 remoteUser=${firstSyncedRemoteUserId}，批量入队所有已同步用户 total=${syncedRemoteUserIds.length} enqueued=${queued}`);
    }

    let stopProjectScan = false;
    for (let page = 1; page <= maxProjectPages; page++) {
        if (stopProjectScan) break;
        const result = await mirror40CodeSyncService.fetchSearchProjectsPage(cfg, page);
        const list = Array.isArray(result?.list) ? result.list : [];
        await job.log(`项目扫描 page=${page} count=${list.length}`);

        if (list.length === 0) {
            break;
        }

        const projectBatch = [];
        for (const item of list) {
            const remoteProjectId = Number(item?.id);
            if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) continue;
            if (seenProjectIds.has(remoteProjectId)) continue;
            seenProjectIds.add(remoteProjectId);

            const remoteUpdateTime = Number(item?.update_time || item?.time || item?.publish_time || 0);
            const needSync = forceProjectSync
                ? true
                : await mirror40CodeSyncService.shouldEnqueueProjectByTimestamp(remoteProjectId, remoteUpdateTime);
            if (!needSync) {
                stopProjectScan = true;
                await job.log(`项目扫描提前停止 page=${page} remoteProject=${remoteProjectId} reason=already-synced`);
                break;
            }

            const remoteUserId = Number(item?.author);
            projectBatch.push({
                remoteProjectId,
                remoteUserId: Number.isFinite(remoteUserId) && remoteUserId > 0 ? remoteUserId : null,
                remoteUpdateTime: Number.isFinite(remoteUpdateTime) && remoteUpdateTime > 0 ? remoteUpdateTime : null,
                forceSync: forceProjectSync,
            });
        }

        discoveredProjects += projectBatch.length;
        if (projectBatch.length > 0) {
            const queued = await enqueueProjectSyncJobs(queue, projectBatch, 'daily-sync-projects');
            enqueuedProjects += queued;
            await job.log(`项目入队 page=${page} discovered=${projectBatch.length} enqueued=${queued}`);
        }
    }

    await job.log(`每日同步入队完成 users=${enqueuedUsers}/${discoveredUsers + discoveredSyncedUsers} projects=${enqueuedProjects}/${discoveredProjects}`);
    return {
        mode: 'daily-sync',
        forceProjectSync,
        discoveredUsers: discoveredUsers + discoveredSyncedUsers,
        discoveredProjects,
        enqueuedUsers,
        enqueuedProjects,
    };
}

async function processUserSync(job) {
    const remoteUserId = Number(job.data?.remoteUserId);
    const forceSync = Boolean(job.data?.forceSync);
    if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) {
        throw new Error(`无效 remoteUserId: ${job.data?.remoteUserId}`);
    }

    logger.debug(`[mirror-40code] processUserSync start remoteUser=${remoteUserId} forceSync=${forceSync}`);
    await job.log(`开始同步用户 ${remoteUserId}`);
    const result = await mirror40CodeSyncService.syncUser(remoteUserId, { forceSync });

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

    const projectItems = Array.isArray(result?.projectItems)
        ? result.projectItems
        : [];

    await job.log(`用户 ${remoteUserId} 同步完成，待同步项目 ${projectItems.length} 个`);

    const queue = getMirror40CodeQueue();
    if (!queue) {
        await job.log('mirror-40code queue 不可用，跳过项目入队');
        return {
            mode: 'sync-user',
            remoteUserId,
            localUserId: result.localUserId,
            projects: projectItems.length,
            enqueuedProjects: 0,
        };
    }

    const enqueuedProjects = await enqueueProjectSyncJobs(queue, projectItems, 'user-sync');
    logger.debug(`[mirror-40code] processUserSync done remoteUser=${remoteUserId} projectCandidates=${projectItems.length} enqueuedProjects=${enqueuedProjects}`);

    return {
        mode: 'sync-user',
        remoteUserId,
        localUserId: result.localUserId,
        projects: projectItems.length,
        enqueuedProjects,
    };
}

async function processProjectSync(job) {
    const remoteProjectId = Number(job.data?.remoteProjectId);
    const remoteUserId = Number(job.data?.remoteUserId);
    const forceSync = Boolean(job.data?.forceSync);

    if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) {
        throw new Error(`无效 remoteProjectId: ${job.data?.remoteProjectId}`);
    }

    await job.log(`开始同步项目 ${remoteProjectId} forceSync=${forceSync}`);
    return syncProjectAndAssets(job, remoteProjectId, Number.isFinite(remoteUserId) ? remoteUserId : null);
}

async function processMirror40Code(job) {
    const type = String(job.data?.type || '');

    switch (type) {
    case 'daily-sync':
        return processDailySync(job);
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
