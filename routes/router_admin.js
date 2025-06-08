import { Router } from "express";
import { needAdmin } from "../middleware/auth.js";
import logger from "../services/logger.js";
import configRouter from "./admin/config.js";

const router = Router();

/**
 * Admin Router
 * 管理后台路由模块，包含：
 * 1. 配置管理
 * 2. 用户管理（待实现）
 * 3. 内容管理（待实现）
 * 4. 系统监控（待实现）
 * 5. 日志查看（待实现）
 */

// 使用统一的配置管理路由
router.use("/config", configRouter);

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
router.get("/system/info", needAdmin, async (req, res) => {
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

export default router;