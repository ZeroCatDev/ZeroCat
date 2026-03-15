import { Router } from 'express';
import queueManager from '../../services/queue/queueManager.js';
import mirror40CodeSyncService from '../../services/mirror40code/syncService.js';
import logger from '../../services/logger.js';

const router = Router();

router.get('/status', async (req, res) => {
    try {
        const queueStatus = await queueManager.getMirror40CodeQueueStatus();
        const remote = await mirror40CodeSyncService.pingRemote().catch((error) => ({
            ok: false,
            error: error.message,
        }));

        res.json({
            status: 'success',
            data: {
                queue: queueStatus,
                remote,
            },
        });
    } catch (error) {
        logger.error('[admin/mirror40code] 获取状态失败:', error);
        res.status(500).json({ status: 'error', message: '获取40code镜像状态失败', error: error.message });
    }
});

router.post('/full-sync', async (req, res) => {
    try {
        const result = await queueManager.enqueueMirror40CodeFullSync();
        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }
        res.json({ status: 'success', message: '全量镜像任务已入队', data: result });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 full-sync 失败:', error);
        res.status(500).json({ status: 'error', message: '全量镜像任务入队失败', error: error.message });
    }
});

router.post('/users/:id/sync', async (req, res) => {
    try {
        const remoteUserId = Number(req.params.id);
        if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) {
            return res.status(400).json({ status: 'error', message: '无效用户ID' });
        }

        const result = await queueManager.enqueueMirror40CodeUserSync(remoteUserId);
        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }

        res.json({ status: 'success', message: '用户同步任务已入队', data: result });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 user-sync 失败:', error);
        res.status(500).json({ status: 'error', message: '用户同步任务入队失败', error: error.message });
    }
});

router.post('/projects/:id/sync', async (req, res) => {
    try {
        const remoteProjectId = Number(req.params.id);
        const remoteUserId = Number(req.body?.remoteUserId);

        if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) {
            return res.status(400).json({ status: 'error', message: '无效项目ID' });
        }

        const result = await queueManager.enqueueMirror40CodeProjectSync(
            remoteProjectId,
            Number.isFinite(remoteUserId) ? remoteUserId : null
        );

        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }

        res.json({ status: 'success', message: '项目同步任务已入队', data: result });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 project-sync 失败:', error);
        res.status(500).json({ status: 'error', message: '项目同步任务入队失败', error: error.message });
    }
});

export default router;
