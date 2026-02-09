import {Router} from "express";
import logger from "../services/logger.js";
import configRouter from "./admin/config.js";
import usersRouter from "./admin/users.js";
import projectsRouter from "./admin/projects.js";
import coderunRouter from "./admin/coderun.js";
import extensionsRouter from "./admin/extensions.js";
import notificationsRouter from "./admin/notifications.js";
import {needAdmin} from '../middleware/auth.js';

import sitemapService from '../services/sitemap.js';
import zcconfig from '../services/config/zcconfig.js';

const router = Router();

// 在 needAdmin 之前：接收 query token 写入 cookie 后跳转面板
router.get('/queues/auth', (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ status: 'error', message: 'Missing token parameter' });
    }
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect('/admin/queues');
});

router.use(needAdmin);
/**
 * Admin Router
 * 管理后台路由模块，包含：
 * 1. 配置管理
 * 2. 用户管理
 * 3. 内容管理（待实现）
 * 4. 系统监控（待实现）
 * 5. 日志查看（待实现）
 * 6. 通知管理
 */

// 使用统一的配置管理路由
router.use("/config", configRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/coderun", coderunRouter);
router.use("/extensions", extensionsRouter);
router.use("/notifications", notificationsRouter);

// BullMQ Dashboard
router.use("/queues", async (req, res, next) => {
    try {
        const dashboardEnabled = await zcconfig.get('bullmq.dashboard.enabled');
        if (!dashboardEnabled) {
            return res.status(404).json({ status: 'error', message: 'Dashboard is disabled' });
        }
        const { getDashboardRouter } = await import('../services/queue/dashboard.js');
        const dashboardRouter = getDashboardRouter();
        if (!dashboardRouter) {
            return res.status(503).json({ status: 'error', message: 'Queue dashboard not available' });
        }
        dashboardRouter(req, res, next);
    } catch (error) {
        logger.error('[admin] Error loading queue dashboard:', error);
        res.status(500).json({ status: 'error', message: 'Failed to load dashboard' });
    }
});

// ==================== 通知管理页面 ====================

/**
 * @api {get} /admin/notifications 通知管理页面
 * @apiName AdminNotificationsPage
 * @apiGroup AdminNotifications
 * @apiPermission admin
 * @apiDescription 展示管理员通知管理界面
 */
router.get("/notifications", async (req, res) => {
    try {
        res.render("admin_notifications", {
            global: {
                config: global.config || {}
            }
        });
    } catch (error) {
        logger.error("渲染通知管理页面失败:", error);
        res.status(500).json({
            status: "error",
            message: "页面加载失败",
            error: error.message
        });
    }
});
// ==================== 系统信息路由 ====================

/**
 * @api {get} /admin/system/info 获取系统信息
 * @apiName GetSystemInfo
 * @apiGroup AdminSystem
 * @apiPermission admin
 *
 * @apiSuccess {String} status 请求状态
 * @apiSuccess {Object} data 系统信息
 */
router.get("/system/info", async (req, res) => {
    try {
        const systemInfo = {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            cpu_usage: process.cpuUsage(),
        };

        res.json({
            status: "success",
            data: systemInfo
        });
    } catch (error) {
        logger.error("获取系统信息失败:", error);
        res.status(500).json({
            status: "error",
            message: "获取系统信息失败",
            error: error.message
        });
    }
});

// Sitemap management routes
router.get('/sitemap/status', async (req, res) => {
    try {
        const status = await sitemapService.getSitemapStatus();
        res.json({
            status: 'success',
            data: status
        });
    } catch (error) {
        logger.error('[admin] Error getting sitemap status:', error);
        res.status(500).json({
            status: 'error',
            message: '获取站点地图状态失败'
        });
    }
});

router.post('/sitemap/settings', async (req, res) => {
    try {
        const {enabled, autoUpdate} = req.body;

        // 验证并更新设置
        if (typeof enabled === 'boolean') {
            await zcconfig.set('sitemap.enabled', enabled);
        }

        if (typeof autoUpdate === 'boolean') {
            await zcconfig.set('sitemap.auto_update', autoUpdate);
        }

        // 重新初始化服务
        await sitemapService.initialize();

        res.json({
            status: 'success',
            message: '设置已更新'
        });
    } catch (error) {
        logger.error('[admin] Error updating sitemap settings:', error);
        res.status(500).json({
            status: 'error',
            message: '更新站点地图设置失败'
        });
    }
});

router.post('/sitemap/generate', async (req, res) => {
    try {
        const {type = 'full'} = req.body;

        if (type !== 'full' && type !== 'incremental') {
            return res.status(400).json({
                status: 'error',
                message: '无效的生成类型'
            });
        }

        const hash = type === 'full'
            ? await sitemapService.generateFullSitemap()
            : await sitemapService.generateIncrementalSitemap();

        res.json({
            status: 'success',
            message: '站点地图生成成功',
            data: {hash}
        });
    } catch (error) {
        logger.error('[admin] Error generating sitemap:', error);
        res.status(500).json({
            status: 'error',
            message: '生成站点地图失败'
        });
    }
});

export default router;