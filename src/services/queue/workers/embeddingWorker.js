/**
 * Embedding 向量生成 Worker
 *
 * 处理两类任务：
 * 1. post_embedding  — 为帖子生成向量 → 存入 pgvector → 同步到 Gorse
 * 2. user_embedding  — 为用户生成向量 → 存入 pgvector → 同步到 Gorse
 *
 * 用户向量采用帖子/点赞/收藏的时间加权合并策略：
 * - 以用户自己发布的帖子向量为主（权重 1.0）
 * - 以点赞帖子向量为辅（权重 0.5）
 * - 以收藏帖子向量为辅（权重 0.7）
 * - 用 30 天半衰期时间衰减
 * - 若用户无任何交互数据，则用昵称+简介生成基础向量
 */
import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import { prisma } from '../../prisma.js';
import embeddingService from '../../embedding.js';
import gorseService from '../../gorse.js';

let worker = null;

// ======================== 帖子向量生成 ========================

async function processPostEmbedding(job) {
    const { postId, force = false } = job.data;
    await job.log(`开始处理帖子 ${postId} 的向量生成 (force=${force})`);

    // 查询帖子
    const post = await prisma.ow_posts.findUnique({
        where: { id: postId },
        select: {
            id: true,
            author_id: true,
            post_type: true,
            content: true,
            embed: true,
            is_deleted: true,
            retweet_post_id: true,
            created_at: true,
        },
    });

    if (!post) {
        await job.log(`帖子 ${postId} 不存在，跳过`);
        return { skipped: true, reason: 'not_found' };
    }

    // 纯转推不生成向量
    if (post.post_type === 'retweet') {
        await job.log(`帖子 ${postId} 是纯转推，跳过`);
        return { skipped: true, reason: 'retweet' };
    }

    if (post.is_deleted) {
        await job.log(`帖子 ${postId} 已删除，跳过`);
        return { skipped: true, reason: 'deleted' };
    }

    // 构建文本
    const text = embeddingService.buildPostText(post);
    if (!text || text.trim().length === 0) {
        await job.log(`帖子 ${postId} 无有效文本，跳过`);
        return { skipped: true, reason: 'empty_text' };
    }

    // 检查文本是否已变化（change detection）
    const newHash = embeddingService.hashText(text);
    if (!force) {
        const oldHash = await embeddingService.getTextHash('post', postId);
        if (oldHash === newHash) {
            await job.log(`帖子 ${postId} 文本未变化 (hash=${newHash})，跳过`);
            return { skipped: true, reason: 'unchanged' };
        }
    }

    // 生成向量
    const config = await getModelInfo();
    const vector = await embeddingService.generateEmbedding(text);
    if (!vector) {
        throw new Error(`帖子 ${postId} 向量生成返回空`);
    }

    await job.log(`帖子 ${postId} 向量已生成 (dim=${vector.length})`);

    // 存入 pgvector
    await embeddingService.saveEmbedding('post', postId, vector, newHash, config.model);
    await job.log(`帖子 ${postId} 向量已存入 PostgreSQL`);

    // 更新帖子的 embedding_at 时间戳
    await prisma.ow_posts.update({
        where: { id: postId },
        data: { embedding_at: new Date() },
    });

    // 同步到 Gorse
    await syncPostToGorse(post, vector);
    await job.log(`帖子 ${postId} 向量已同步到 Gorse`);

    return { postId, dimensions: vector.length, hash: newHash };
}

// ======================== 用户向量生成 ========================

async function processUserEmbedding(job) {
    const { userId, force = false } = job.data;
    await job.log(`开始处理用户 ${userId} 的向量生成 (force=${force})`);

    // 查询用户
    const user = await prisma.ow_users.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            display_name: true,
            bio: true,
            motto: true,
        },
    });

    if (!user) {
        await job.log(`用户 ${userId} 不存在，跳过`);
        return { skipped: true, reason: 'not_found' };
    }

    // 收集用户交互的帖子向量
    const entries = [];

    // 1. 用户自己发的帖子（权重 1.0）
    const userPosts = await prisma.ow_posts.findMany({
        where: {
            author_id: userId,
            is_deleted: false,
            post_type: { not: 'retweet' }, // 排除纯转推
        },
        select: { id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 200, // 最近 200 条
    });

    if (userPosts.length > 0) {
        const postIds = userPosts.map(p => p.id);
        const postVectors = await embeddingService.getEmbeddings('post', postIds);
        for (const post of userPosts) {
            const vec = postVectors.get(post.id);
            if (vec) {
                entries.push({ vector: vec, weight: 1.0, timestamp: post.created_at });
            }
        }
        await job.log(`用户帖子向量: ${entries.length}/${userPosts.length} 有向量`);
    }

    // 2. 用户点赞的帖子（权重 0.5）
    const likedPosts = await prisma.ow_posts_like.findMany({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 100,
    });

    if (likedPosts.length > 0) {
        const likePostIds = likedPosts.map(l => l.post_id);
        const likeVectors = await embeddingService.getEmbeddings('post', likePostIds);
        let likeCount = 0;
        for (const like of likedPosts) {
            const vec = likeVectors.get(like.post_id);
            if (vec) {
                entries.push({ vector: vec, weight: 0.5, timestamp: like.created_at });
                likeCount++;
            }
        }
        await job.log(`用户点赞帖子向量: ${likeCount}/${likedPosts.length} 有向量`);
    }

    // 3. 用户收藏的帖子（权重 0.7）
    const bookmarkedPosts = await prisma.ow_posts_bookmark.findMany({
        where: { user_id: userId },
        select: { post_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 100,
    });

    if (bookmarkedPosts.length > 0) {
        const bmPostIds = bookmarkedPosts.map(b => b.post_id);
        const bmVectors = await embeddingService.getEmbeddings('post', bmPostIds);
        let bmCount = 0;
        for (const bm of bookmarkedPosts) {
            const vec = bmVectors.get(bm.post_id);
            if (vec) {
                entries.push({ vector: vec, weight: 0.7, timestamp: bm.created_at });
                bmCount++;
            }
        }
        await job.log(`用户收藏帖子向量: ${bmCount}/${bookmarkedPosts.length} 有向量`);
    }

    let finalVector;

    if (entries.length > 0) {
        // 有交互数据 → 时间加权合并
        finalVector = embeddingService.timeWeightedMerge(entries);
        await job.log(`用户 ${userId} 通过 ${entries.length} 条交互数据合并向量`);

        // 如果用户有简介，生成基础向量并叠加（权重 0.3）
        const profileText = embeddingService.buildUserProfileText(user);
        if (profileText && profileText.length > 2) {
            try {
                const profileVec = await embeddingService.generateEmbedding(profileText);
                if (profileVec) {
                    // 将简介向量以 0.3 的权重混入
                    const dim = finalVector.length;
                    for (let i = 0; i < dim; i++) {
                        finalVector[i] = finalVector[i] * 0.7 + profileVec[i] * 0.3;
                    }
                    finalVector = embeddingService.normalizeVector(finalVector);
                    await job.log(`用户 ${userId} 已混入简介向量`);
                }
            } catch (e) {
                await job.log(`用户 ${userId} 简介向量生成失败（忽略）: ${e.message}`);
            }
        }
    } else {
        // 无交互数据 → 用简介/昵称生成基础向量
        const profileText = embeddingService.buildUserProfileText(user);
        if (!profileText || profileText.length <= 1) {
            await job.log(`用户 ${userId} 无交互数据也无有效简介，跳过`);
            return { skipped: true, reason: 'no_data' };
        }

        finalVector = await embeddingService.generateEmbedding(profileText);
        if (!finalVector) {
            throw new Error(`用户 ${userId} 向量生成返回空`);
        }
        await job.log(`用户 ${userId} 使用简介文本生成基础向量`);
    }

    if (!finalVector) {
        return { skipped: true, reason: 'no_vector' };
    }

    // 存入 pgvector
    const config = await getModelInfo();
    const textHash = embeddingService.hashText(`user_${userId}_${entries.length}_${Date.now()}`);
    await embeddingService.saveEmbedding('user', userId, finalVector, textHash, config.model);
    await job.log(`用户 ${userId} 向量已存入 PostgreSQL`);

    // 更新用户的 embedding_at 时间戳
    await prisma.ow_users.update({
        where: { id: userId },
        data: { embedding_at: new Date() },
    });

    // 同步到 Gorse
    await syncUserToGorse(userId, user, finalVector);
    await job.log(`用户 ${userId} 向量已同步到 Gorse`);

    return { userId, dimensions: finalVector.length, interactionCount: entries.length };
}

// ======================== Gorse 同步 ========================

async function syncPostToGorse(post, vector) {
    try {
        if (!gorseService.isEnabled()) return;

        // 纯转推不推送给 Gorse
        if (post.post_type === 'retweet') return;

        const client = await getGorseClient();
        if (!client) return;

        const categories = buildPostCategoriesInternal(post);
        const labels = buildPostLabelsInternal(post);
        labels.embedding = vector;

        await client.upsertItem({
            ItemId: `post_${post.id}`,
            Comment: (post.content || '').substring(0, 200),
            IsHidden: post.is_deleted || false,
            Timestamp: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
            Categories: categories,
            Labels: labels,
        });
    } catch (error) {
        logger.warn(`[embedding-worker] 同步帖子 ${post.id} 向量到 Gorse 失败:`, error.message);
    }
}

async function syncUserToGorse(userId, user, vector) {
    try {
        if (!gorseService.isEnabled()) return;

        const client = await getGorseClient();
        if (!client) return;

        // insertUser 携带 embedding 向量
        await client.insertUser({
            UserId: String(userId),
            Comment: (user.username || user.display_name || '').substring(0, 200),
            Labels: { embedding: vector },
        });

        // upsertItem（ItemId: user_X）供 follow feedback 挂载
        await client.upsertItem({
            ItemId: `user_${userId}`,
            Comment: (user.username || user.display_name || '').substring(0, 200),
            IsHidden: false,
            Categories: ['user'],
            Labels: { embedding: vector },
        });
    } catch (error) {
        logger.warn(`[embedding-worker] 同步用户 ${userId} 向量到 Gorse 失败:`, error.message);
    }
}

// ======================== Gorse 辅助（避免循环依赖） ========================

let _gorseClient = null;

async function getGorseClient() {
    if (_gorseClient) return _gorseClient;
    try {
        const { Gorse } = await import('gorsejs');
        const endpoint = await zcconfig.get('gorse.endpoint');
        const secret = await zcconfig.get('gorse.secret');
        if (!endpoint) return null;
        _gorseClient = new Gorse({ endpoint, secret: secret || '' });
        return _gorseClient;
    } catch (e) {
        return null;
    }
}

function buildPostCategoriesInternal(post) {
    const categories = ['post'];
    if (post.post_type) categories.push(`type:${post.post_type}`);
    if (post.embed && typeof post.embed === 'object' && post.embed.type) {
        categories.push(`embed:${post.embed.type}`);
    }
    return categories;
}

function buildPostLabelsInternal(post) {
    const labels = {};
    if (post.author_id) labels.author = String(post.author_id);
    if (post.post_type) labels.type = post.post_type;
    if (post.embed && typeof post.embed === 'object') {
        if (post.embed.type) labels.embed_type = post.embed.type;
        if (post.embed.type === 'project' && post.embed.id) {
            labels.project = String(post.embed.id);
        }
    }
    return labels;
}

async function getModelInfo() {
    const model = await zcconfig.get('embedding.model');
    return { model: model || 'unknown' };
}

// ======================== Worker 创建 ========================

async function createEmbeddingWorker() {
    const concurrency = (await zcconfig.get('embedding.concurrency')) || 2;
    const connection = await createConnection('worker-embedding');

    worker = new Worker(
        QUEUE_NAMES.EMBEDDING,
        async (job) => {
            const { type } = job.data;

            switch (type) {
                case 'post_embedding':
                    return processPostEmbedding(job);
                case 'user_embedding':
                    return processUserEmbedding(job);
                case 'batch_post_embedding':
                    return processBatchPostEmbedding(job);
                case 'batch_user_embedding':
                    return processBatchUserEmbedding(job);
                default:
                    throw new Error(`未知的 embedding 任务类型: ${type}`);
            }
        },
        {
            connection,
            concurrency,
            limiter: {
                max: 10,
                duration: 60000, // 每分钟最多 10 个请求（避免 API 限流）
            },
        },
    );

    worker.on('completed', (job, result) => {
        if (result?.skipped) {
            logger.debug(`[embedding-worker] Job ${job.id} 跳过: ${result.reason}`);
        } else {
            logger.debug(`[embedding-worker] Job ${job.id} 完成`);
        }
    });

    worker.on('failed', (job, err) => {
        logger.error(`[embedding-worker] Job ${job?.id} 失败:`, err.message);
    });

    worker.on('error', (err) => {
        logger.error('[embedding-worker] Worker error:', err.message);
    });

    logger.info(`[embedding-worker] Worker 已创建 (concurrency=${concurrency})`);
    return worker;
}

function getEmbeddingWorker() {
    return worker;
}

// ======================== 批量处理 ========================

async function processBatchPostEmbedding(job) {
    const { postIds, force = false } = job.data;
    await job.log(`批量处理 ${postIds.length} 个帖子的向量`);

    const config = await getModelInfo();
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    // 批量查询帖子
    const posts = await prisma.ow_posts.findMany({
        where: { id: { in: postIds } },
        select: {
            id: true,
            author_id: true,
            post_type: true,
            content: true,
            embed: true,
            is_deleted: true,
            retweet_post_id: true,
            created_at: true,
        },
    });

    // 过滤掉转推和删除的
    const validPosts = posts.filter(p => p.post_type !== 'retweet' && !p.is_deleted);

    // 构建文本并校验变化
    const textsToEmbed = [];
    const postsToProcess = [];

    const existingHashes = force
        ? new Map()
        : await embeddingService.getTextHashes('post', validPosts.map(p => p.id));

    for (const post of validPosts) {
        const text = embeddingService.buildPostText(post);
        if (!text || text.trim().length === 0) {
            skipped++;
            continue;
        }
        const hash = embeddingService.hashText(text);
        if (!force && existingHashes.get(post.id) === hash) {
            skipped++;
            continue;
        }
        textsToEmbed.push(text);
        postsToProcess.push({ post, hash });
    }

    skipped += (posts.length - validPosts.length);

    // 批量生成向量
    const batchSize = (await zcconfig.get('embedding.batch_size')) || 20;
    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
        const batchTexts = textsToEmbed.slice(i, i + batchSize);
        const batchPosts = postsToProcess.slice(i, i + batchSize);

        try {
            const vectors = await embeddingService.generateEmbeddings(batchTexts);

            for (let j = 0; j < vectors.length; j++) {
                const { post, hash } = batchPosts[j];
                const vector = vectors[j];

                try {
                    await embeddingService.saveEmbedding('post', post.id, vector, hash, config.model);
                    await prisma.ow_posts.update({
                        where: { id: post.id },
                        data: { embedding_at: new Date() },
                    });
                    await syncPostToGorse(post, vector);
                    processed++;
                } catch (e) {
                    logger.warn(`[embedding-worker] 帖子 ${post.id} 存储失败:`+ e);
                    failed++;
                }
            }
        } catch (e) {
            logger.error(`[embedding-worker] 批量向量生成失败:`+ e);
            failed += batchTexts.length;
        }

        await job.updateProgress(Math.round(((i + batchTexts.length) / textsToEmbed.length) * 100));
    }

    return { processed, skipped, failed, total: postIds.length };
}

async function processBatchUserEmbedding(job) {
    const { userIds, force = false } = job.data;
    await job.log(`批量处理 ${userIds.length} 个用户的向量`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < userIds.length; i++) {
        try {
            const result = await processUserEmbedding({
                data: { userId: userIds[i], force },
                log: async (msg) => job.log(`[user_${userIds[i]}] ${msg}`),
                updateProgress: async () => {},
            });

            if (result?.skipped) {
                skipped++;
            } else {
                processed++;
            }
        } catch (e) {
            logger.warn(`[embedding-worker] 用户 ${userIds[i]} 向量生成失败:`+ e);
            failed++;
        }

        await job.updateProgress(Math.round(((i + 1) / userIds.length) * 100));
    }

    return { processed, skipped, failed, total: userIds.length };
}

export { createEmbeddingWorker, getEmbeddingWorker };
