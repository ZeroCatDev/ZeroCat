/**
 * Gorse 推荐系统服务模块
 *
 * 提供与 Gorse 推荐引擎的集成：
 * - 用户/物品插入与更新
 * - 用户反馈(feedback)上报
 * - 个性化推荐获取
 * - 全量同步管理
 */
import { Gorse } from 'gorsejs';
import zcconfig from './config/zcconfig.js';
import logger from './logger.js';
import { prisma } from './prisma.js';

// Gorse 反馈类型常量
export const FEEDBACK_TYPES = {
    LIKE: 'like',
    BOOKMARK: 'bookmark',
    REPLY: 'reply',
    RETWEET: 'retweet',
    QUOTE: 'quote',
    STAR: 'star',           // 项目收藏
    FOLLOW: 'follow',       // 关注用户
    READ: 'read',           // 阅读/浏览
};

// 物品前缀（区分帖子和项目）
const ITEM_PREFIX = {
    POST: 'post_',
    PROJECT: 'project_',
};

let gorseClient = null;
let gorseEnabled = false;

/**
 * 初始化 Gorse 客户端
 */
async function initGorseClient() {
    try {
        const endpoint = await zcconfig.get('gorse.endpoint');
        const secret = await zcconfig.get('gorse.secret');

        if (!endpoint) {
            logger.info('[gorse] Gorse 未配置 endpoint，推荐服务未启用');
            gorseEnabled = false;
            return null;
        }

        gorseClient = new Gorse({
            endpoint,
            secret: secret || '',
        });

        gorseEnabled = true;
        logger.info(`[gorse] Gorse 推荐服务已连接: ${endpoint}`);
        return gorseClient;
    } catch (error) {
        logger.error('[gorse] 初始化 Gorse 客户端失败:', error);
        gorseEnabled = false;
        return null;
    }
}

/**
 * 获取 Gorse 客户端（懒初始化）
 */
async function getClient() {
    if (!gorseClient) {
        await initGorseClient();
    }
    return gorseClient;
}

/**
 * 检查 Gorse 是否可用
 */
function isEnabled() {
    return gorseEnabled && gorseClient !== null;
}

// ======================== 用户操作 ========================

/**
 * 将用户插入/更新到 Gorse
 */
export async function upsertUser(userId, { username, labels } = {}) {
    try {
        const client = await getClient();
        if (!client) return;

        await client.insertUser({
            UserId: String(userId),
            Comment: username || '',
            Labels: labels || [],
        });
        logger.debug(`[gorse] 用户已同步: ${userId}`);
    } catch (error) {
        logger.warn(`[gorse] 同步用户 ${userId} 失败:`, error.message);
    }
}

/**
 * 批量插入用户到 Gorse
 */
export async function insertUsers(users) {
    try {
        const client = await getClient();
        if (!client) return;

        const gorseUsers = users.map(u => ({
            UserId: String(u.id),
            Comment: u.username || u.display_name || '',
            Labels: u.labels || [],
        }));

        await client.insertUsers(gorseUsers);
        logger.debug(`[gorse] 批量同步 ${gorseUsers.length} 个用户`);
    } catch (error) {
        logger.warn(`[gorse] 批量同步用户失败:`, error.message);
    }
}

// ======================== 物品操作 ========================

/**
 * 将帖子作为物品插入/更新到 Gorse
 */
export async function upsertPost(post) {
    try {
        const client = await getClient();
        if (!client) return;

        const categories = buildPostCategories(post);
        const labels = buildPostLabels(post);

        await client.upsertItem({
            ItemId: `${ITEM_PREFIX.POST}${post.id}`,
            Comment: (post.content || '').substring(0, 200),
            IsHidden: post.is_deleted || false,
            Timestamp: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
            Categories: categories,
            Labels: labels,
        });
        logger.debug(`[gorse] 帖子已同步: ${post.id}`);
    } catch (error) {
        logger.warn(`[gorse] 同步帖子 ${post.id} 失败:`, error.message);
    }
}

/**
 * 批量插入帖子到 Gorse
 */
export async function insertPosts(posts) {
    try {
        const client = await getClient();
        if (!client) return;

        const items = posts.map(post => ({
            ItemId: `${ITEM_PREFIX.POST}${post.id}`,
            Comment: (post.content || '').substring(0, 200),
            IsHidden: post.is_deleted || false,
            Timestamp: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
            Categories: buildPostCategories(post),
            Labels: buildPostLabels(post),
        }));

        await client.upsertItems(items);
        logger.debug(`[gorse] 批量同步 ${items.length} 个帖子`);
    } catch (error) {
        logger.warn(`[gorse] 批量同步帖子失败:`, error.message);
    }
}

/**
 * 将帖子标记为隐藏（删除时）
 */
export async function hidePost(postId) {
    try {
        const client = await getClient();
        if (!client) return;

        await client.updateItem(`${ITEM_PREFIX.POST}${postId}`, {
            IsHidden: true,
        });
        logger.debug(`[gorse] 帖子已隐藏: ${postId}`);
    } catch (error) {
        logger.warn(`[gorse] 隐藏帖子 ${postId} 失败:`, error.message);
    }
}

/**
 * 构建帖子类别标签
 */
function buildPostCategories(post) {
    const categories = ['post'];
    if (post.post_type) {
        categories.push(`type:${post.post_type}`);
    }
    if (post.embed && typeof post.embed === 'object' && post.embed.type) {
        categories.push(`embed:${post.embed.type}`);
    }
    return categories;
}

/**
 * 构建帖子标签（用于推荐算法特征）
 */
function buildPostLabels(post) {
    const labels = [];
    if (post.author_id) {
        labels.push(`author:${post.author_id}`);
    }
    if (post.post_type) {
        labels.push(`type:${post.post_type}`);
    }
    if (post.embed && typeof post.embed === 'object') {
        if (post.embed.type) labels.push(`embed:${post.embed.type}`);
        if (post.embed.type === 'project' && post.embed.id) {
            labels.push(`project:${post.embed.id}`);
        }
    }
    return labels;
}

// ======================== 反馈操作 ========================

/**
 * 插入单条反馈（幂等，重复写入不报错）
 * Gorse Feedback 接口要求 Value 字段，正向反馈传 1
 */
export async function insertFeedback(feedbackType, userId, itemId, { timestamp, value = 1 } = {}) {
    try {
        const client = await getClient();
        if (!client) return;

        await client.upsertFeedbacks([{
            FeedbackType: feedbackType,
            UserId: String(userId),
            ItemId: String(itemId),
            Value: value,
            Timestamp: timestamp || new Date().toISOString(),
        }]);
        logger.debug(`[gorse] 反馈已记录: ${feedbackType} user=${userId} item=${itemId}`);
    } catch (error) {
        logger.warn(`[gorse] 记录反馈失败 (${feedbackType}):`, error.message);
    }
}

/**
 * 批量插入反馈（幂等）
 */
export async function insertFeedbacks(feedbacks) {
    try {
        const client = await getClient();
        if (!client) return;

        const gorseFeedbacks = feedbacks.map(fb => ({
            FeedbackType: fb.feedbackType,
            UserId: String(fb.userId),
            ItemId: String(fb.itemId),
            Value: typeof fb.value === 'number' ? fb.value : 1,
            Timestamp: fb.timestamp || new Date().toISOString(),
        }));

        await client.upsertFeedbacks(gorseFeedbacks);
        logger.debug(`[gorse] 批量记录 ${gorseFeedbacks.length} 条反馈`);
    } catch (error) {
        logger.warn(`[gorse] 批量记录反馈失败:`, error.message);
    }
}

/**
 * 删除反馈（用于取消点赞/取消收藏等）
 */
export async function deleteFeedback(feedbackType, userId, itemId) {
    try {
        const client = await getClient();
        if (!client) return;

        await client.deleteFeedback({
            type: feedbackType,
            userId: String(userId),
            itemId: String(itemId),
        });
        logger.debug(`[gorse] 反馈已删除: ${feedbackType} user=${userId} item=${itemId}`);
    } catch (error) {
        logger.warn(`[gorse] 删除反馈失败 (${feedbackType}):`, error.message);
    }
}

// ======================== 推荐获取 ========================

/**
 * 获取个性化推荐帖子 ID 列表
 * @param {number} userId - 用户ID
 * @param {object} options - 推荐选项
 * @param {number} options.limit - 返回数量，默认20
 * @param {number} options.offset - 偏移量，默认0
 * @param {string} options.category - 类别过滤
 * @returns {Promise<string[]>} 推荐的物品ID列表
 */
export async function getRecommendedPostIds(userId, { limit = 20, offset = 0, category } = {}) {
    try {
        const client = await getClient();
        if (!client) return [];

        const ids = await client.getRecommend({
            userId: String(userId),
            category: category || 'post',
            // 将推荐曝光自动回写为 'read' 反馈，用于去重
            writeBackType: 'read',
            writeBackDelay: '0s',
            cursorOptions: { n: limit, offset },
        });

        // 返回去掉前缀后的帖子ID
        return (ids || []).map(id => {
            if (id.startsWith(ITEM_PREFIX.POST)) {
                return parseInt(id.slice(ITEM_PREFIX.POST.length), 10);
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        logger.warn(`[gorse] 获取推荐失败 (user=${userId}):`, error.message);
        return [];
    }
}

/**
 * 获取最新热门帖子（未登录用户使用）
 * @param {object} options
 * @param {number} options.limit - 返回数量，默认20
 * @param {number} options.offset - 偏移量，默认0
 * @param {string} options.category - 类别过滤
 * @returns {Promise<string[]>} 物品ID列表
 */
export async function getLatestPostIds({ limit = 20, offset = 0, category } = {}) {
    try {
        const client = await getClient();
        if (!client) return [];

        const scores = await client.getLatest({
            category: category || 'post',
            cursorOptions: { n: limit, offset },
        });

        return (scores || []).map(s => {
            if (s.Id && s.Id.startsWith(ITEM_PREFIX.POST)) {
                return parseInt(s.Id.slice(ITEM_PREFIX.POST.length), 10);
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        logger.warn(`[gorse] 获取最新帖子失败:`, error.message);
        return [];
    }
}

// ======================== 帖子反馈便捷方法 ========================

/** 帖子点赞反馈 */
export function feedbackPostLike(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.LIKE, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 取消帖子点赞反馈 */
export function feedbackPostUnlike(userId, postId) {
    return deleteFeedback(FEEDBACK_TYPES.LIKE, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 帖子收藏反馈 */
export function feedbackPostBookmark(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.BOOKMARK, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 取消帖子收藏反馈 */
export function feedbackPostUnbookmark(userId, postId) {
    return deleteFeedback(FEEDBACK_TYPES.BOOKMARK, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 帖子回复反馈 */
export function feedbackPostReply(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.REPLY, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 帖子转推反馈 */
export function feedbackPostRetweet(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.RETWEET, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 帖子引用反馈 */
export function feedbackPostQuote(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.QUOTE, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 帖子阅读反馈 */
export function feedbackPostRead(userId, postId) {
    return insertFeedback(FEEDBACK_TYPES.READ, userId, `${ITEM_PREFIX.POST}${postId}`);
}

/** 项目收藏反馈 */
export function feedbackProjectStar(userId, projectId) {
    return insertFeedback(FEEDBACK_TYPES.STAR, userId, `${ITEM_PREFIX.PROJECT}${projectId}`);
}

/** 取消项目收藏反馈 */
export function feedbackProjectUnstar(userId, projectId) {
    return deleteFeedback(FEEDBACK_TYPES.STAR, userId, `${ITEM_PREFIX.PROJECT}${projectId}`);
}

/** 用户关注反馈 */
export function feedbackUserFollow(userId, followedUserId) {
    return insertFeedback(FEEDBACK_TYPES.FOLLOW, userId, `user_${followedUserId}`);
}

/** 取消用户关注反馈 */
export function feedbackUserUnfollow(userId, followedUserId) {
    return deleteFeedback(FEEDBACK_TYPES.FOLLOW, userId, `user_${followedUserId}`);
}

// ======================== 全量同步 ========================

/**
 * 全量同步所有用户到 Gorse
 * @returns {Promise<{total: number, synced: number}>}
 */
export async function syncAllUsers() {
    const client = await getClient();
    if (!client) throw new Error('Gorse 服务未启用');

    let cursor = 0;
    const batchSize = 500;
    let totalSynced = 0;

    while (true) {
        const users = await prisma.ow_users.findMany({
            skip: cursor,
            take: batchSize,
            select: { id: true, username: true, display_name: true, bio: true },
            orderBy: { id: 'asc' },
        });

        if (users.length === 0) break;

        const gorseUsers = users.map(u => ({
            UserId: String(u.id),
            Comment: u.username || u.display_name || '',
            Labels: u.bio ? [u.bio.substring(0, 100)] : [],
        }));

        await client.insertUsers(gorseUsers);
        totalSynced += gorseUsers.length;
        cursor += batchSize;

        logger.info(`[gorse] 全量同步用户进度: ${totalSynced}`);
    }

    logger.info(`[gorse] 全量同步用户完成: ${totalSynced}`);
    return { total: totalSynced, synced: totalSynced };
}

/**
 * 全量同步所有帖子到 Gorse
 * @returns {Promise<{total: number, synced: number}>}
 */
export async function syncAllPosts() {
    const client = await getClient();
    if (!client) throw new Error('Gorse 服务未启用');

    let cursor = 0;
    const batchSize = 500;
    let totalSynced = 0;

    while (true) {
        const posts = await prisma.ow_posts.findMany({
            skip: cursor,
            take: batchSize,
            select: {
                id: true,
                author_id: true,
                post_type: true,
                content: true,
                is_deleted: true,
                embed: true,
                created_at: true,
                retweet_post_id: true,
            },
            orderBy: { id: 'asc' },
        });

        if (posts.length === 0) break;

        // 批量获取转推帖子对应的原帖内容（避免 N+1 查询）
        const retweetIds = posts
            .filter(p => p.post_type === 'retweet' && p.retweet_post_id)
            .map(p => p.retweet_post_id);

        let originalContentMap = {};
        if (retweetIds.length > 0) {
            const originals = await prisma.ow_posts.findMany({
                where: { id: { in: retweetIds } },
                select: { id: true, content: true, embed: true },
            });
            for (const orig of originals) {
                originalContentMap[orig.id] = orig;
            }
        }

        const items = posts.map(post => {
            // 转推帖子使用原帖文字填充 Comment
            const effectiveContent = (post.post_type === 'retweet' && post.retweet_post_id)
                ? (originalContentMap[post.retweet_post_id]?.content || '')
                : (post.content || '');
            const effectiveEmbed = (post.post_type === 'retweet' && post.retweet_post_id)
                ? (originalContentMap[post.retweet_post_id]?.embed || post.embed)
                : post.embed;

            return {
                ItemId: `${ITEM_PREFIX.POST}${post.id}`,
                Comment: effectiveContent.substring(0, 200),
                IsHidden: post.is_deleted || false,
                Timestamp: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
                Categories: buildPostCategories({ ...post, embed: effectiveEmbed }),
                Labels: buildPostLabels({ ...post, embed: effectiveEmbed }),
            };
        });

        await client.upsertItems(items);
        totalSynced += items.length;
        cursor += batchSize;

        logger.info(`[gorse] 全量同步帖子进度: ${totalSynced}`);
    }

    logger.info(`[gorse] 全量同步帖子完成: ${totalSynced}`);
    return { total: totalSynced, synced: totalSynced };
}

/**
 * 全量同步所有反馈到 Gorse
 * @returns {Promise<{likes: number, bookmarks: number, stars: number, follows: number}>}
 */
export async function syncAllFeedbacks() {
    const client = await getClient();
    if (!client) throw new Error('Gorse 服务未启用');

    const result = { likes: 0, bookmarks: 0, stars: 0, follows: 0 };
    const batchSize = 500;

    // 同步帖子点赞
    let cursor = 0;
    while (true) {
        const likes = await prisma.ow_posts_like.findMany({
            skip: cursor,
            take: batchSize,
            select: { user_id: true, post_id: true, created_at: true },
            orderBy: { id: 'asc' },
        });
        if (likes.length === 0) break;

        const feedbacks = likes.map(l => ({
            FeedbackType: FEEDBACK_TYPES.LIKE,
            UserId: String(l.user_id),
            ItemId: `${ITEM_PREFIX.POST}${l.post_id}`,
            Value: 1,
            Timestamp: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
        }));

        await client.upsertFeedbacks(feedbacks);
        result.likes += feedbacks.length;
        cursor += batchSize;
    }
    logger.info(`[gorse] 全量同步点赞反馈完成: ${result.likes}`);

    // 同步帖子收藏
    cursor = 0;
    while (true) {
        const bookmarks = await prisma.ow_posts_bookmark.findMany({
            skip: cursor,
            take: batchSize,
            select: { user_id: true, post_id: true, created_at: true },
            orderBy: { id: 'asc' },
        });
        if (bookmarks.length === 0) break;

        const feedbacks = bookmarks.map(b => ({
            FeedbackType: FEEDBACK_TYPES.BOOKMARK,
            UserId: String(b.user_id),
            ItemId: `${ITEM_PREFIX.POST}${b.post_id}`,
            Value: 1,
            Timestamp: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
        }));

        await client.upsertFeedbacks(feedbacks);
        result.bookmarks += feedbacks.length;
        cursor += batchSize;
    }
    logger.info(`[gorse] 全量同步收藏反馈完成: ${result.bookmarks}`);

    // 同步项目收藏
    cursor = 0;
    while (true) {
        const stars = await prisma.ow_projects_stars.findMany({
            skip: cursor,
            take: batchSize,
            select: { userid: true, projectid: true, createTime: true },
            orderBy: { id: 'asc' },
        });
        if (stars.length === 0) break;

        const feedbacks = stars.map(s => ({
            FeedbackType: FEEDBACK_TYPES.STAR,
            UserId: String(s.userid),
            ItemId: `${ITEM_PREFIX.PROJECT}${s.projectid}`,
            Value: 1,
            Timestamp: s.createTime ? new Date(s.createTime).toISOString() : new Date().toISOString(),
        }));

        await client.upsertFeedbacks(feedbacks);
        result.stars += feedbacks.length;
        cursor += batchSize;
    }
    logger.info(`[gorse] 全量同步项目收藏反馈完成: ${result.stars}`);

    // 同步用户关注
    cursor = 0;
    while (true) {
        const follows = await prisma.ow_user_relationships.findMany({
            skip: cursor,
            take: batchSize,
            where: { relationship_type: 'follow' },
            select: { source_user_id: true, target_user_id: true, created_at: true },
            orderBy: { id: 'asc' },
        });
        if (follows.length === 0) break;

        const feedbacks = follows.map(f => ({
            FeedbackType: FEEDBACK_TYPES.FOLLOW,
            UserId: String(f.source_user_id),
            ItemId: `user_${f.target_user_id}`,
            Value: 1,
            Timestamp: f.created_at ? new Date(f.created_at).toISOString() : new Date().toISOString(),
        }));

        await client.upsertFeedbacks(feedbacks);
        result.follows += feedbacks.length;
        cursor += batchSize;
    }
    logger.info(`[gorse] 全量同步关注反馈完成: ${result.follows}`);

    return result;
}

/**
 * 全量同步所有数据（用户 + 帖子 + 反馈）
 */
export async function syncAll() {
    const client = await getClient();
    if (!client) throw new Error('Gorse 服务未启用');

    logger.info('[gorse] 开始全量同步...');

    const usersResult = await syncAllUsers();
    const postsResult = await syncAllPosts();
    const feedbacksResult = await syncAllFeedbacks();

    const summary = {
        users: usersResult,
        posts: postsResult,
        feedbacks: feedbacksResult,
    };

    logger.info('[gorse] 全量同步完成:', JSON.stringify(summary));
    return summary;
}

/**
 * 获取 Gorse 服务状态
 */
export async function getGorseStatus() {
    try {
        const client = await getClient();
        if (!client) {
            return { enabled: false, message: 'Gorse 服务未配置' };
        }

        // 尝试获取用户列表来检查连接
        await client.getUsers({ n: 1 });

        return {
            enabled: true,
            endpoint: await zcconfig.get('gorse.endpoint'),
            message: 'Gorse 服务运行正常',
        };
    } catch (error) {
        return {
            enabled: gorseEnabled,
            message: `Gorse 服务异常: ${error.message}`,
        };
    }
}

export default {
    FEEDBACK_TYPES,
    upsertUser,
    insertUsers,
    upsertPost,
    insertPosts,
    hidePost,
    insertFeedback,
    insertFeedbacks,
    deleteFeedback,
    getRecommendedPostIds,
    getLatestPostIds,
    feedbackPostLike,
    feedbackPostUnlike,
    feedbackPostBookmark,
    feedbackPostUnbookmark,
    feedbackPostReply,
    feedbackPostRetweet,
    feedbackPostQuote,
    feedbackPostRead,
    feedbackProjectStar,
    feedbackProjectUnstar,
    feedbackUserFollow,
    feedbackUserUnfollow,
    syncAllUsers,
    syncAllPosts,
    syncAllFeedbacks,
    syncAll,
    getGorseStatus,
    isEnabled,
};
