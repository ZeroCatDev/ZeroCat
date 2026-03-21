/**
 * Embedding 向量管理路由
 * 提供全量生成、状态查看等管理接口
 */
import { Router } from "express";
import logger from "../../services/logger.js";
import embeddingService from "../../services/embedding.js";
import queueManager from "../../services/queue/queueManager.js";
import { prisma } from "../../services/prisma.js";
import zcconfig from "../../services/config/zcconfig.js";
import { getEmbeddingQueue } from "../../services/queue/queues.js";

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

/**
 * @api {post} /admin/embedding/generate/projects/missing-daily-check
 * 按“每日补齐规则”手动触发项目向量生成
 * @apiName GenerateMissingProjectEmbeddingsByDailyRule
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.post("/generate/projects/missing-daily-check", async (req, res) => {
    try {
        const embeddingEnabled = await zcconfig.get('embedding.enabled', false);
        if (!embeddingEnabled) {
            return res.status(400).json({
                status: 'error',
                message: 'Embedding 未启用，请先设置 embedding.enabled=true',
            });
        }

        const minViewCount = Math.max(0, Number(await zcconfig.get('embedding.periodic.project_check.min_view_count', 100)) || 100);
        const minStarCount = Math.max(0, Number(await zcconfig.get('embedding.periodic.project_check.min_star_count', 10)) || 10);
        const scanLimit = Math.max(1, Number(await zcconfig.get('embedding.periodic.project_check.scan_limit', 2000)) || 2000);

                const candidates = await prisma.$queryRawUnsafe(
                        `
                        SELECT p.id
                        FROM ow_projects p
                        LEFT JOIN ow_embeddings e
                            ON e.entity_type = 'project'
                         AND e.entity_id = p.id
                        LEFT JOIN (
                                SELECT
                                target_id AS project_id,
                                        COUNT(*)::int AS local_view_count
                                FROM ow_analytics_event
                                WHERE target_type = 'project'
                                GROUP BY target_id
                        ) av
                            ON av.project_id = p.id
                        LEFT JOIN LATERAL (
                                SELECT
                                        CASE
                                                WHEN tc.value ~ '^[0-9]+$' THEN tc.value::int
                                                ELSE 0
                                        END AS remote_view_count
                                FROM project_config tc
                                WHERE tc.target_type = 'project'
                                    AND tc.target_id = p.id::text
                                    AND tc.key IN ('mirror.remote_view_count', 'mirror40.remote_view_count')
                                ORDER BY tc.updated_at DESC
                                LIMIT 1
                        ) rv ON true
                        LEFT JOIN (
                                SELECT
                                        projectid AS project_id,
                                        COUNT(*)::int AS star_count
                                FROM ow_projects_stars
                                WHERE projectid IS NOT NULL
                                GROUP BY projectid
                        ) ps
                            ON ps.project_id = p.id
                        WHERE e.id IS NULL
                            AND COALESCE(p.type, '') = 'scratch'
                            AND COALESCE(p.state, '') <> 'deleted'
                            AND (
                                (COALESCE(av.local_view_count, 0) + COALESCE(rv.remote_view_count, 0)) > $1
                                OR COALESCE(ps.star_count, 0) > $2
                            )
                        ORDER BY
                            (COALESCE(av.local_view_count, 0) + COALESCE(rv.remote_view_count, 0)) DESC,
                            COALESCE(ps.star_count, 0) DESC,
                            p.id DESC
                        LIMIT $3
                        `,
                        Number(minViewCount),
                        Number(minStarCount),
                        Number(scanLimit)
                );

        const projectIds = (Array.isArray(candidates) ? candidates : [])
            .map((item) => Number(item?.id))
            .filter((id) => Number.isFinite(id) && id > 0);

        const embeddingQueue = getEmbeddingQueue();
        if (!embeddingQueue || !queueManager.isInitialized()) {
            return res.status(503).json({
                status: 'error',
                message: 'Embedding 队列不可用或未初始化',
            });
        }

        let enqueued = 0;
        let duplicated = 0;
        let failed = 0;

        for (const projectId of projectIds) {
            const jobId = `emb-project-${projectId}`;
            try {
                await embeddingQueue.add('embedding', {
                    type: 'project_embedding',
                    projectId,
                    force: false,
                    triggerType: 'admin-daily-project-check',
                }, {
                    jobId,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 15000 },
                    removeOnComplete: { age: 86400 },
                    removeOnFail: { age: 604800 },
                    deduplication: { id: jobId },
                });
                enqueued += 1;
            } catch (error) {
                if (String(error?.message || '').includes('Job is already waiting')) {
                    duplicated += 1;
                } else {
                    failed += 1;
                    logger.warn(`[admin/embedding] missing-daily-check enqueue failed project=${projectId} error=${error.message}`);
                }
            }
        }

        return res.json({
            status: 'success',
            message: '已按每日补齐规则触发项目 Embedding 入队',
            data: {
                rules: {
                    type: 'scratch',
                    minViewCount,
                    minStarCount,
                    scanLimit,
                    relation: '(analyticsViews + mirrorRemoteViews) > minViewCount OR starsCount > minStarCount',
                },
                candidates: projectIds.length,
                enqueued,
                duplicated,
                failed,
            },
        });
    } catch (error) {
        logger.error('[admin/embedding] missing-daily-check failed:', error);
        return res.status(500).json({
            status: 'error',
            message: `按每日规则触发项目 Embedding 失败: ${error.message}`,
        });
    }
});

/**
 * @api {get} /admin/embedding/generate/projects/missing-daily-check/preview
 * 预览“每日补齐规则”命中的项目（不入队）
 * @apiName PreviewMissingProjectEmbeddingsByDailyRule
 * @apiGroup AdminEmbedding
 * @apiPermission admin
 */
router.get("/generate/projects/missing-daily-check/preview", async (req, res) => {
    try {
        const minViewCount = Math.max(0, Number(await zcconfig.get('embedding.periodic.project_check.min_view_count', 100)) || 100);
        const minStarCount = Math.max(0, Number(await zcconfig.get('embedding.periodic.project_check.min_star_count', 10)) || 10);
        const scanLimit = Math.max(1, Number(await zcconfig.get('embedding.periodic.project_check.scan_limit', 2000)) || 2000);

                const candidates = await prisma.$queryRawUnsafe(
                        `
                        SELECT p.id
                        FROM ow_projects p
                        LEFT JOIN ow_embeddings e
                            ON e.entity_type = 'project'
                         AND e.entity_id = p.id
                        LEFT JOIN (
                                SELECT
                                target_id AS project_id,
                                        COUNT(*)::int AS local_view_count
                                FROM ow_analytics_event
                                WHERE target_type = 'project'
                                GROUP BY target_id
                        ) av
                            ON av.project_id = p.id
                        LEFT JOIN LATERAL (
                                SELECT
                                        CASE
                                                WHEN tc.value ~ '^[0-9]+$' THEN tc.value::int
                                                ELSE 0
                                        END AS remote_view_count
                                FROM project_config tc
                                WHERE tc.target_type = 'project'
                                    AND tc.target_id = p.id::text
                                    AND tc.key IN ('mirror.remote_view_count', 'mirror40.remote_view_count')
                                ORDER BY tc.updated_at DESC
                                LIMIT 1
                        ) rv ON true
                        LEFT JOIN (
                                SELECT
                                        projectid AS project_id,
                                        COUNT(*)::int AS star_count
                                FROM ow_projects_stars
                                WHERE projectid IS NOT NULL
                                GROUP BY projectid
                        ) ps
                            ON ps.project_id = p.id
                        WHERE e.id IS NULL
                            AND COALESCE(p.type, '') = 'scratch'
                            AND COALESCE(p.state, '') <> 'deleted'
                            AND (
                                (COALESCE(av.local_view_count, 0) + COALESCE(rv.remote_view_count, 0)) > $1
                                OR COALESCE(ps.star_count, 0) > $2
                            )
                        ORDER BY
                            (COALESCE(av.local_view_count, 0) + COALESCE(rv.remote_view_count, 0)) DESC,
                            COALESCE(ps.star_count, 0) DESC,
                            p.id DESC
                        LIMIT $3
                        `,
                        Number(minViewCount),
                        Number(minStarCount),
                        Number(scanLimit)
                );

        const projectIds = (Array.isArray(candidates) ? candidates : [])
            .map((item) => Number(item?.id))
            .filter((id) => Number.isFinite(id) && id > 0);

        return res.json({
            status: 'success',
            message: '每日补齐规则预览完成（未入队）',
            data: {
                rules: {
                    type: 'scratch',
                    minViewCount,
                    minStarCount,
                    scanLimit,
                    relation: '(analyticsViews + mirrorRemoteViews) > minViewCount OR starsCount > minStarCount',
                },
                candidates: projectIds.length,
                previewProjectIds: projectIds.slice(0, 200),
            },
        });
    } catch (error) {
        logger.error('[admin/embedding] missing-daily-check preview failed:', error);
        return res.status(500).json({
            status: 'error',
            message: `预览每日规则命中项目失败: ${error.message}`,
        });
    }
});

export default router;
