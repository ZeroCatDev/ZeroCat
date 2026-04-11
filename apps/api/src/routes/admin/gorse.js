/**
 * Gorse 推荐系统管理路由
 * 提供全量同步、状态查看等管理接口
 */
import { Router } from "express";
import logger from "../../services/logger.js";
import gorseService from "../../services/gorse.js";

const router = Router();

/**
 * @api {get} /admin/gorse/status 获取 Gorse 服务状态
 * @apiName GetGorseStatus
 * @apiGroup AdminGorse
 * @apiPermission admin
 */
router.get("/status", async (req, res) => {
    try {
        const status = await gorseService.getGorseStatus();
        res.json({ status: "success", data: status });
    } catch (error) {
        logger.error("[admin/gorse] 获取状态失败:", error);
        res.status(500).json({ status: "error", message: "获取 Gorse 状态失败" });
    }
});

/**
 * @api {post} /admin/gorse/sync/all 全量同步所有数据到 Gorse
 * @apiName SyncAllToGorse
 * @apiGroup AdminGorse
 * @apiPermission admin
 * @apiDescription 同步所有用户、帖子、项目和反馈数据到 Gorse 推荐系统。此操作可能耗时较长。
 */
router.post("/sync/all", async (req, res) => {
    try {
        logger.info("[admin/gorse] 管理员触发全量同步");
        const result = await gorseService.syncAll();
        res.json({
            status: "success",
            message: "全量同步完成",
            data: result,
        });
    } catch (error) {
        logger.error("[admin/gorse] 全量同步失败:", error);
        res.status(500).json({
            status: "error",
            message: `全量同步失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/gorse/sync/projects 全量同步项目到 Gorse
 * @apiName SyncProjectsToGorse
 * @apiGroup AdminGorse
 * @apiPermission admin
 */
router.post("/sync/projects", async (req, res) => {
    try {
        logger.info("[admin/gorse] 管理员触发项目全量同步");
        const result = await gorseService.syncAllProjects();
        res.json({
            status: "success",
            message: "项目同步完成",
            data: result,
        });
    } catch (error) {
        logger.error("[admin/gorse] 项目同步失败:", error);
        res.status(500).json({
            status: "error",
            message: `项目同步失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/gorse/sync/users 全量同步用户到 Gorse
 * @apiName SyncUsersToGorse
 * @apiGroup AdminGorse
 * @apiPermission admin
 */
router.post("/sync/users", async (req, res) => {
    try {
        logger.info("[admin/gorse] 管理员触发用户全量同步");
        const result = await gorseService.syncAllUsers();
        res.json({
            status: "success",
            message: "用户同步完成",
            data: result,
        });
    } catch (error) {
        logger.error("[admin/gorse] 用户同步失败:", error);
        res.status(500).json({
            status: "error",
            message: `用户同步失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/gorse/sync/posts 全量同步帖子到 Gorse
 * @apiName SyncPostsToGorse
 * @apiGroup AdminGorse
 * @apiPermission admin
 */
router.post("/sync/posts", async (req, res) => {
    try {
        logger.info("[admin/gorse] 管理员触发帖子全量同步");
        const result = await gorseService.syncAllPosts();
        res.json({
            status: "success",
            message: "帖子同步完成",
            data: result,
        });
    } catch (error) {
        logger.error("[admin/gorse] 帖子同步失败:", error);
        res.status(500).json({
            status: "error",
            message: `帖子同步失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/gorse/sync/feedbacks 全量同步反馈到 Gorse
 * @apiName SyncFeedbacksToGorse
 * @apiGroup AdminGorse
 * @apiPermission admin
 * @apiDescription 同步所有点赞、收藏、关注等反馈数据到 Gorse
 */
router.post("/sync/feedbacks", async (req, res) => {
    try {
        logger.info("[admin/gorse] 管理员触发反馈全量同步");
        const result = await gorseService.syncAllFeedbacks();
        res.json({
            status: "success",
            message: "反馈同步完成",
            data: result,
        });
    } catch (error) {
        logger.error("[admin/gorse] 反馈同步失败:", error);
        res.status(500).json({
            status: "error",
            message: `反馈同步失败: ${error.message}`,
        });
    }
});

export default router;
