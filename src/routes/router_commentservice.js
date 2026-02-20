import { Router } from 'express';
import crypto from 'crypto';
import logger from '../services/logger.js';
import zcconfig from '../services/config/zcconfig.js';
import { parseToken, needLogin } from '../middleware/auth.js';
import queueManager from '../services/queue/queueManager.js';
import { prisma } from '../services/prisma.js';
import { createWalineToken } from '../services/commentService/walineAuth.js';
import {
    createSpace,
    getSpaceByGuid,
    listSpaces,
    updateSpace,
    deleteSpace,
    getSpaceConfig,
    updateSpaceConfig,
    getOrCreateSpaceUser,
    listSpaceUsers,
    updateSpaceUser,
    getSpaceStats,
} from '../services/commentService/spaceManager.js';
import {
    getCommentList,
    searchMyComments,
    updateComment,
    deleteComment,
} from '../services/commentService/commentManager.js';
import { toWalineType } from '../services/commentService/walineFormatter.js';

const router = Router();

/** 剥离敏感字段 */
function sanitizeSpace(space) {
    if (!space) return space;
    const { jwt_secret, ...safe } = space;
    return safe;
}

// 所有路由需要 ZeroCat 认证
router.use(parseToken);

// ============================================================
// 空间管理
// ============================================================

/**
 * POST /commentservice/spaces
 * 创建空间
 */
router.post('/spaces', needLogin, async (req, res, next) => {
    try {
        const { name, domain } = req.body;
        if (!name) {
            return res.status(400).json({ status: 'error', message: '空间名称不能为空' });
        }

        const space = await createSpace(res.locals.userid, name, domain || null);
        return res.json({ status: 'success', data: sanitizeSpace(space) });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /commentservice/spaces
 * 列出我的空间
 */
router.get('/spaces', needLogin, async (req, res, next) => {
    try {
        const spaces = await listSpaces(res.locals.userid);
        return res.json({ status: 'success', data: spaces.map(sanitizeSpace) });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /commentservice/spaces/:cuid
 * 空间详情
 * - 所有者: 返回完整信息
 * - 其他用户: 返回公开信息 (名称、所有者、审核员、域名、创建时间)
 */
router.get('/spaces/:cuid', async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.status !== 'active') {
            return res.status(404).json({ status: 'error', message: '空间不存在' });
        }

        const isOwner = res.locals.userid && space.owner_id === res.locals.userid;

        // 获取所有者和管理团队信息 (所有人都能看到)
        const [owner, staff] = await Promise.all([
            prisma.ow_users.findUnique({
                where: { id: space.owner_id },
                select: { id: true, username: true, display_name: true, avatar: true },
            }),
            prisma.ow_comment_service_users.findMany({
                where: {
                    space_id: space.id,
                    type: { in: ['administrator', 'moderator'] },
                },
                include: {
                    user: {
                        select: { id: true, username: true, display_name: true, avatar: true },
                    },
                },
            }),
        ]);

        const moderators = staff.map(s => ({
            id: s.user_id,
            username: s.user?.username || '',
            display_name: s.user?.display_name || '',
            avatar: s.user?.avatar || '',
            role: s.type,
        }));

        const ownerInfo = owner ? {
            id: owner.id,
            username: owner.username,
            display_name: owner.display_name,
            avatar: owner.avatar,
        } : null;

        if (isOwner) {
            return res.json({
                status: 'success',
                data: { ...sanitizeSpace(space), owner: ownerInfo, moderators },
            });
        }

        // 非所有者: 返回公开信息
        return res.json({
            status: 'success',
            data: {
                cuid: space.cuid,
                name: space.name,
                domain: space.domain,
                created_at: space.created_at,
                owner: ownerInfo,
                moderators,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /commentservice/spaces/:cuid
 * 更新空间
 */
router.put('/spaces/:cuid', needLogin, async (req, res, next) => {
    try {
        const updated = await updateSpace(req.params.cuid, res.locals.userid, req.body);
        if (!updated) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }
        return res.json({ status: 'success', data: sanitizeSpace(updated) });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /commentservice/spaces/:cuid
 * 删除空间
 */
router.delete('/spaces/:cuid', needLogin, async (req, res, next) => {
    try {
        const deleted = await deleteSpace(req.params.cuid, res.locals.userid);
        if (!deleted) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }
        return res.json({ status: 'success', message: '空间已删除' });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// 空间配置
// ============================================================

/**
 * GET /commentservice/spaces/:cuid/config
 * 获取空间配置
 */
router.get('/spaces/:cuid/config', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const config = await getSpaceConfig(req.params.cuid);
        return res.json({ status: 'success', data: config });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /commentservice/spaces/:cuid/config
 * 更新空间配置
 */
router.put('/spaces/:cuid/config', needLogin, async (req, res, next) => {
    try {
        const updated = await updateSpaceConfig(req.params.cuid, res.locals.userid, req.body);
        if (!updated) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        // 部分字段校验未通过时，返回已保存的合法部分 + 错误列表
        if (updated.errors) {
            return res.json({ status: 'partial', data: updated.config, errors: updated.errors });
        }
        return res.json({ status: 'success', data: updated });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// 评论管理
// ============================================================

/**
 * GET /commentservice/spaces/:cuid/comments
 * 评论管理列表
 */
router.get('/spaces/:cuid/comments', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const data = await getCommentList(space.id, req.query);
        return res.json({ status: 'success', data });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /commentservice/spaces/:cuid/comments/:id
 * 审核评论 (更新状态)
 */
router.put('/spaces/:cuid/comments/:id', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const updated = await updateComment(
            space.id,
            req.params.id,
            req.body,
            res.locals.userid,
            true, // isAdmin
        );

        if (!updated) {
            return res.status(404).json({ status: 'error', message: '评论不存在' });
        }

        // 审核通过时，为有 pid 的评论触发回复通知
        if (req.body.status === 'approved' && updated.pid) {
            try {
                queueManager.enqueueCommentNotification('reply_notification', updated.id, space.id, space.cuid);
            } catch (e) {
                logger.warn('[commentservice] Failed to enqueue approve notification:', e.message);
            }
        }

        return res.json({ status: 'success', data: updated });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /commentservice/spaces/:cuid/comments/:id
 * 删除评论
 */
router.delete('/spaces/:cuid/comments/:id', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const deleted = await deleteComment(
            space.id,
            req.params.id,
            res.locals.userid,
            true, // isAdmin
        );

        if (!deleted) {
            return res.status(404).json({ status: 'error', message: '评论不存在' });
        }

        return res.json({ status: 'success', message: '评论已删除' });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// 空间用户管理
// ============================================================

/**
 * GET /commentservice/spaces/:cuid/users
 * 空间用户列表
 */
router.get('/spaces/:cuid/users', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const data = await listSpaceUsers(
            space.id,
            parseInt(req.query.page) || 1,
            parseInt(req.query.pageSize) || 20,
            { type: req.query.type || null, keyword: req.query.keyword || null },
        );
        return res.json({ status: 'success', data });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /commentservice/spaces/:cuid/users/:userId
 * 更新用户角色 (只能设为 moderator/guest/banned, 不能设为 administrator)
 */
router.put('/spaces/:cuid/users/:userId', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const targetUserId = parseInt(req.params.userId);

        // 不能修改 owner 自己的角色
        if (targetUserId === space.owner_id) {
            return res.status(400).json({ status: 'error', message: '不能修改空间所有者的角色' });
        }

        // 只允许设置 moderator/guest/banned
        if (req.body.type && !['moderator', 'guest', 'banned'].includes(req.body.type)) {
            return res.status(400).json({ status: 'error', message: '只能设置为 moderator、guest 或 banned' });
        }

        const updated = await updateSpaceUser(
            space.id,
            targetUserId,
            req.body,
        );

        return res.json({ status: 'success', data: updated });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// 空间统计
// ============================================================

/**
 * GET /commentservice/spaces/:cuid/stats
 * 空间统计
 */
router.get('/spaces/:cuid/stats', needLogin, async (req, res, next) => {
    try {
        const space = await getSpaceByGuid(req.params.cuid);
        if (!space || space.owner_id !== res.locals.userid) {
            return res.status(404).json({ status: 'error', message: '空间不存在或无权限' });
        }

        const stats = await getSpaceStats(space.id);
        return res.json({ status: 'success', data: stats });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// UI Login (ZeroCat token -> Waline JWT)
// ============================================================

/**
 * POST /commentservice/ui/login
 * ZeroCat token 换取 Waline JWT
 * 前端在用户登录后调用此接口
 */
router.post('/ui/login', needLogin, async (req, res, next) => {
    try {
        const { spaceCuid } = req.body;
        if (!spaceCuid) {
            return res.status(400).json({ errno: 1, errmsg: 'Missing spaceCuid' });
        }

        const space = await getSpaceByGuid(spaceCuid);
        if (!space || space.status !== 'active') {
            return res.status(404).json({ errno: 1, errmsg: 'Space not found' });
        }

        const userId = res.locals.userid;

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: { id: userId },
            select: {
                id: true, username: true, display_name: true,
                avatar: true, email: true, type: true,
                url: true, motto: true, bio: true, label: true,
            },
        });

        if (!user) {
            return res.status(404).json({ errno: 1, errmsg: 'User not found' });
        }

        // 确保空间用户映射存在
        const spaceUser = await getOrCreateSpaceUser(space.id, userId, {
            display_name: user.display_name || user.username,
            email: user.email,
            avatar: user.avatar,
        });

        // 生成 Waline JWT
        const token = createWalineToken(userId, space.jwt_secret);

        // 计算 mailMd5 (Gravatar)
        const mail = spaceUser.email || user.email || '';
        const mailMd5 = mail
            ? crypto.createHash('md5').update(mail.trim().toLowerCase()).digest('hex')
            : '';

        // 拼接 avatar 完整 URL
        const staticUrl = await zcconfig.get('s3.staticurl');
        const rawAvatar = spaceUser.avatar || user.avatar || '';
        const avatarUrl = rawAvatar ? `${staticUrl}/assets/${rawAvatar.substring(0, 2)}/${rawAvatar.substring(2, 4)}/${rawAvatar}.webp` : '';

        return res.json({
            errno: 0,
            data: {
                token,
                nick: spaceUser.display_name || user.display_name || user.username,
                mail,
                avatar: avatarUrl,
                link: spaceUser.url || user.url || '',
                type: toWalineType(spaceUser.type),
                label: spaceUser.label || user.label || '',
                objectId: String(userId),
                mailMd5,
                // ZeroCat 用户扩展信息
                username: user.username,
                display_name: user.display_name,
                motto: user.motto || '',
                bio: user.bio || '',
            },
        });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// 我的评论
// ============================================================

/**
 * GET /commentservice/my/comments
 * 我在所有空间的评论
 */
router.get('/my/comments', needLogin, async (req, res, next) => {
    try {
        const userId = res.locals.userid;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
        const keyword = req.query.keyword;

        // 有搜索关键词时使用 pg_trgm 搜索
        if (keyword && keyword.trim()) {
            const result = await searchMyComments(userId, keyword.trim(), page, pageSize);
            return res.json({ status: 'success', data: result });
        }

        const where = { user_id: String(userId) };
        const [comments, count] = await Promise.all([
            prisma.ow_comment_service.findMany({
                where,
                orderBy: { insertedAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    space: { select: { cuid: true, name: true } },
                },
            }),
            prisma.ow_comment_service.count({ where }),
        ]);

        const data = comments.map(c => ({
            objectId: String(c.id),
            comment: c.comment,
            url: c.url,
            status: c.status,
            insertedAt: c.insertedAt.toISOString(),
            space: c.space ? { cuid: c.space.cuid, name: c.space.name } : null,
        }));

        return res.json({
            status: 'success',
            data: {
                page,
                totalPages: Math.ceil(count / pageSize),
                pageSize,
                count,
                data,
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
