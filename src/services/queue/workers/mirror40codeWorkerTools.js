import logger from '../../logger.js';
import mirror40CodeSyncService from '../../mirror40code/syncService.js';

function isAlreadyQueuedError(error) {
    return String(error?.message || '').includes('Job is already waiting');
}

export async function enqueueUserSyncJobs(queue, userIds, triggeredBy) {
    let enqueuedUsers = 0;

    for (const userId of userIds) {
        const normalizedId = Number(userId);
        if (!Number.isFinite(normalizedId) || normalizedId <= 0) continue;

        const jobId = `m40-user-${normalizedId}`;
        try {
            await queue.add('sync-user', {
                type: 'sync-user',
                remoteUserId: normalizedId,
                triggeredBy,
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
            if (!isAlreadyQueuedError(error)) {
                logger.warn(`[mirror-40code] 用户 ${normalizedId} 入队失败: ${error.message}`);
            }
        }
    }

    return enqueuedUsers;
}

export async function enqueueProjectSyncJobs(queue, projectItems, triggeredBy) {
    let enqueuedProjects = 0;

    for (const item of projectItems) {
        const projectId = Number(item?.remoteProjectId ?? item?.projectId ?? item);
        const remoteUserId = Number(item?.remoteUserId ?? item?.authorId);
        if (!Number.isFinite(projectId) || projectId <= 0) continue;

        const jobId = `m40-project-${projectId}`;
        try {
            await queue.add('sync-project', {
                type: 'sync-project',
                remoteProjectId: projectId,
                remoteUserId: Number.isFinite(remoteUserId) && remoteUserId > 0 ? remoteUserId : null,
                triggeredBy,
            }, {
                jobId,
                deduplication: { id: jobId },
                attempts: 5,
                backoff: { type: 'exponential', delay: 15000 },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 604800 },
            });
            enqueuedProjects += 1;
        } catch (error) {
            if (!isAlreadyQueuedError(error)) {
                logger.warn(`[mirror-40code] 项目 ${projectId} 入队失败: ${error.message}`);
            }
        }
    }

    return enqueuedProjects;
}

export async function syncProjectAndAssets(job, remoteProjectId, remoteUserId = null) {
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

    let assetsResult = null;
    try {
        assetsResult = await mirror40CodeSyncService.syncProjectAssets(remoteProjectId);
        if (assetsResult?.skipped) {
            await job.log(`项目 ${remoteProjectId} 素材同步跳过: ${assetsResult.reason}`);
        } else {
            await job.log(`项目 ${remoteProjectId} 素材同步完成 total=${assetsResult.assetsTotal} uploaded=${assetsResult.uploaded} failed=${assetsResult.failed} skipped=${assetsResult.skipped}`);
        }
    } catch (error) {
        await job.log(`项目 ${remoteProjectId} 素材同步失败: ${error.message}`);
        logger.warn(`[mirror-40code] 项目 ${remoteProjectId} 素材同步失败: ${error.message}`);
    }

    await job.log(`项目 ${remoteProjectId} 同步完成，本地项目 ${result.localProjectId}，updated=${result.updated}`);
    return {
        mode: 'sync-project',
        assets: assetsResult,
        ...result,
    };
}
