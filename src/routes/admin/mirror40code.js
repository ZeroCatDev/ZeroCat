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

router.post('/daily-sync', async (req, res) => {
    try {
        const result = await queueManager.enqueueMirror40CodeFullSync();
        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }
        res.json({ status: 'success', message: '每日镜像同步任务已入队', data: result });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 daily-sync 失败:', error);
        res.status(500).json({ status: 'error', message: '每日镜像同步任务入队失败', error: error.message });
    }
});

router.post('/force-sync-projects', async (req, res) => {
    try {
        const result = await queueManager.enqueueMirror40CodeFullSync({ forceProjectSync: true });
        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }
        res.json({
            status: 'success',
            message: '40code 项目强制全量同步任务已入队',
            data: result,
        });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 force-sync-projects 失败:', error);
        res.status(500).json({ status: 'error', message: '40code 项目强制全量同步任务入队失败', error: error.message });
    }
});

router.post('/sync-user', async (req, res) => {
    try {
        const remoteUserId = Number(req.body?.remoteUserId);
        if (!Number.isFinite(remoteUserId) || remoteUserId <= 0) {
            return res.status(400).json({ status: 'error', message: '无效 remoteUserId' });
        }

        const forceSync = Boolean(req.body?.forceSync);
        const result = await queueManager.enqueueMirror40CodeUserSync(remoteUserId, { forceSync });
        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }

        res.json({
            status: 'success',
            message: '40code 用户同步任务已入队',
            data: result,
        });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 sync-user 失败:', error);
        res.status(500).json({ status: 'error', message: '40code 用户同步任务入队失败', error: error.message });
    }
});

router.post('/sync-project', async (req, res) => {
    try {
        const remoteProjectId = Number(req.body?.remoteProjectId);
        if (!Number.isFinite(remoteProjectId) || remoteProjectId <= 0) {
            return res.status(400).json({ status: 'error', message: '无效 remoteProjectId' });
        }

        const remoteUserIdRaw = req.body?.remoteUserId;
        const remoteUpdateTimeRaw = req.body?.remoteUpdateTime;

        const remoteUserIdParsed = Number(remoteUserIdRaw);
        const remoteUpdateTimeParsed = Number(remoteUpdateTimeRaw);

        const result = await queueManager.enqueueMirror40CodeProjectSync(remoteProjectId, {
            remoteUserId: Number.isFinite(remoteUserIdParsed) && remoteUserIdParsed > 0 ? remoteUserIdParsed : null,
            remoteUpdateTime: Number.isFinite(remoteUpdateTimeParsed) && remoteUpdateTimeParsed > 0 ? remoteUpdateTimeParsed : null,
        });

        if (!result) {
            return res.status(503).json({ status: 'error', message: '队列不可用或未初始化' });
        }

        res.json({
            status: 'success',
            message: '40code 项目同步任务已入队',
            data: result,
        });
    } catch (error) {
        logger.error('[admin/mirror40code] 入队 sync-project 失败:', error);
        res.status(500).json({ status: 'error', message: '40code 项目同步任务入队失败', error: error.message });
    }
});

export default router;
