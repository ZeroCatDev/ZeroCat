/**
 * Embedding 向量管理路由
 * 提供全量生成、状态查看等管理接口
 */
import { Router } from "express";
import logger from "../../services/logger.js";
import embeddingService from "../../services/embedding.js";
import queueManager from "../../services/queue/queueManager.js";
import { prisma } from "../../services/prisma.js";

const router = Router();

/**
 * @api {get} /admin/embedding/status 获取 Embedding 服务状态
 * @apiName GetEmbeddingStatus
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.get("/status", async (req, res) => {
    try {
        const status = await embeddingService.getEmbeddingStatus();
        res.json({ status: "success", data: status });
    } catch (error) {
        logger.error("[admin/embedding] 获取状态失败:", error);
        res.status(500).json({ status: "error", message: "获取 Embedding 状态失败" });
    }
});

/**
 * @api {post} /admin/embedding/init 初始化 pgvector（创建表和索引）
 * @apiName InitPgvector
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.post("/init", async (req, res) => {
    try {
        await embeddingService.ensurePgvector();
        res.json({ status: "success", message: "pgvector 扩展和表已就绪" });
    } catch (error) {
        logger.error("[admin/embedding] 初始化失败:", error);
        res.status(500).json({
            status: "error",
            message: `pgvector 初始化失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/posts 全量生成帖子向量
 * @apiName GeneratePostEmbeddings
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 * @apiParam {Boolean} [force=false] 强制重新生成（忽略 change detection）
 */
router.post("/generate/posts", async (req, res) => {
    try {
        const { force = false } = req.body || {};

        logger.info(`[admin/embedding] 管理员触发帖子全量向量生成 (force=${force})`);

        // 查询所有非转推、未删除的帖子 ID
        const posts = await prisma.ow_posts.findMany({
            where: {
                is_deleted: false,
                post_type: { not: 'retweet' },
            },
            select: { id: true },
            orderBy: { id: 'asc' },
        });

        const postIds = posts.map(p => p.id);

        if (postIds.length === 0) {
            return res.json({
                status: "success",
                message: "没有需要生成向量的帖子",
                data: { total: 0 },
            });
        }

        const result = await queueManager.enqueueBatchPostEmbedding(postIds, force);

        res.json({
            status: "success",
            message: `已入队 ${postIds.length} 个帖子的向量生成任务`,
            data: {
                total: postIds.length,
                ...result,
            },
        });
    } catch (error) {
        logger.error("[admin/embedding] 帖子向量生成失败:", error);
        res.status(500).json({
            status: "error",
            message: `帖子向量生成失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/users 全量生成用户向量
 * @apiName GenerateUserEmbeddings
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 * @apiParam {Boolean} [force=false] 强制重新生成
 */
router.post("/generate/users", async (req, res) => {
    try {
        const { force = false } = req.body || {};

        logger.info(`[admin/embedding] 管理员触发用户全量向量生成 (force=${force})`);

        const users = await prisma.ow_users.findMany({
            where: { status: 'active' },
            select: { id: true },
            orderBy: { id: 'asc' },
        });

        const userIds = users.map(u => u.id);

        if (userIds.length === 0) {
            return res.json({
                status: "success",
                message: "没有需要生成向量的用户",
                data: { total: 0 },
            });
        }

        const result = await queueManager.enqueueBatchUserEmbedding(userIds, force);

        res.json({
            status: "success",
            message: `已入队 ${userIds.length} 个用户的向量生成任务`,
            data: {
                total: userIds.length,
                ...result,
            },
        });
    } catch (error) {
        logger.error("[admin/embedding] 用户向量生成失败:", error);
        res.status(500).json({
            status: "error",
            message: `用户向量生成失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/projects 全量生成项目向量（Scratch）
 * @apiName GenerateProjectEmbeddings
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 * @apiParam {Boolean} [force=false] 强制重新生成
 */
router.post("/generate/projects", async (req, res) => {
    try {
        const { force = false } = req.body || {};

        logger.info(`[admin/embedding] 管理员触发项目全量向量生成 (force=${force})`);

        const projects = await prisma.ow_projects.findMany({
            where: {
                state: { not: 'deleted' },
                type: 'scratch',
            },
            select: { id: true },
            orderBy: { id: 'asc' },
        });

        const projectIds = projects.map((item) => item.id);
        if (projectIds.length === 0) {
            return res.json({
                status: "success",
                message: "没有需要生成向量的 Scratch 项目",
                data: { total: 0 },
            });
        }

        const result = await queueManager.enqueueBatchProjectEmbedding(projectIds, force);

        return res.json({
            status: "success",
            message: `已入队 ${projectIds.length} 个 Scratch 项目的向量生成任务`,
            data: {
                total: projectIds.length,
                ...result,
            },
        });
    } catch (error) {
        logger.error("[admin/embedding] 项目向量生成失败:", error);
        return res.status(500).json({
            status: "error",
            message: `项目向量生成失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/all 全量生成所有向量（帖子 + 用户 + Scratch项目）
 * @apiName GenerateAllEmbeddings
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 * @apiParam {Boolean} [force=false] 强制重新生成
 */
router.post("/generate/all", async (req, res) => {
    try {
        const { force = false } = req.body || {};

        logger.info(`[admin/embedding] 管理员触发全量向量生成 (force=${force})`);

        // 帖子
        const posts = await prisma.ow_posts.findMany({
            where: {
                is_deleted: false,
                post_type: { not: 'retweet' },
            },
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        const postIds = posts.map(p => p.id);

        // 用户
        const users = await prisma.ow_users.findMany({
            where: { status: 'active' },
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        const userIds = users.map(u => u.id);

        // 项目（Scratch）
        const projects = await prisma.ow_projects.findMany({
            where: {
                state: { not: 'deleted' },
                type: 'scratch',
            },
            select: { id: true },
            orderBy: { id: 'asc' },
        });
        const projectIds = projects.map((p) => p.id);

        const postResult = postIds.length > 0
            ? await queueManager.enqueueBatchPostEmbedding(postIds, force)
            : null;

        const userResult = userIds.length > 0
            ? await queueManager.enqueueBatchUserEmbedding(userIds, force)
            : null;

        const projectResult = projectIds.length > 0
            ? await queueManager.enqueueBatchProjectEmbedding(projectIds, force)
            : null;

        res.json({
            status: "success",
            message: "全量向量生成任务已入队",
            data: {
                posts: { total: postIds.length, ...postResult },
                users: { total: userIds.length, ...userResult },
                projects: { total: projectIds.length, ...projectResult },
            },
        });
    } catch (error) {
        logger.error("[admin/embedding] 全量向量生成失败:", error);
        res.status(500).json({
            status: "error",
            message: `全量向量生成失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/post/:id 为单个帖子生成向量
 * @apiName GenerateSinglePostEmbedding
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.post("/generate/post/:id", async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const result = await queueManager.enqueuePostEmbedding(postId, true);

        res.json({
            status: "success",
            message: `帖子 ${postId} 向量生成任务已入队`,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: `失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/user/:id 为单个用户生成向量
 * @apiName GenerateSingleUserEmbedding
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.post("/generate/user/:id", async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const result = await queueManager.enqueueUserEmbedding(userId, true);

        res.json({
            status: "success",
            message: `用户 ${userId} 向量生成任务已入队`,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: `失败: ${error.message}`,
        });
    }
});

/**
 * @api {post} /admin/embedding/generate/project/:id 为单个项目生成向量
 * @apiName GenerateSingleProjectEmbedding
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.post("/generate/project/:id", async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        const result = await queueManager.enqueueProjectEmbedding(projectId, true);

        res.json({
            status: "success",
            message: `项目 ${projectId} 向量生成任务已入队`,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: `失败: ${error.message}`,
        });
    }
});

export default router;
