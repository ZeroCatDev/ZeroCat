import { Router } from 'express';
import crypto from 'crypto';
import logger from '../services/logger.js';
import zcconfig from '../services/config/zcconfig.js';
import { prisma } from '../services/prisma.js';
import { walineSpaceResolver, isSpaceAdmin } from '../middleware/walineSpaceResolver.js';
import { createWalineToken } from '../services/commentService/walineAuth.js';
import {
    getOrCreateSpaceUser,
    getSpaceUser,
    listSpaceUsers,
    updateSpaceUser,
} from '../services/commentService/spaceManager.js';
import {
    checkIpRate,
    checkDuplicate,
    createComment,
    getComments,
    getCommentCount,
    getRecentComments,
    getCommentList,
    updateComment,
    deleteComment,
} from '../services/commentService/commentManager.js';
import { getArticleCounter, updateArticleCounter } from '../services/commentService/counterManager.js';
import { formatComment, toWalineType } from '../services/commentService/walineFormatter.js';
import { verifyCaptcha } from '../services/commentService/captchaService.js';
import queueManager from '../services/queue/queueManager.js';

const router = Router();

// 所有 /:spaceCuid/* 路由使用空间解析中间件
router.use('/:spaceCuid', walineSpaceResolver);

// ============================================================
// 评论 API
// ============================================================

/**
 * GET /comment/:spaceCuid/api/comment
 * 评论列表 / 计数 / 最新 / 管理列表
 */
router.get('/:spaceCuid/api/comment', async (req, res, next) => {
    try {
        const space = req.commentSpace;
        const config = req.spaceConfig;
        const { type } = req.query;

        // type=count - 获取评论数量
        if (type === 'count') {
            let urls = req.query.url;
            if (!urls) return res.json({ errno: 0, data: 0 });
            if (typeof urls === 'string') {
                // 检查是否是逗号分隔
                if (urls.includes(',')) urls = urls.split(',');
            }
            const count = await getCommentCount(space.id, urls);
            return res.json({ errno: 0, data: count });
        }

        // type=recent - 获取最新评论
        if (type === 'recent') {
            const data = await getRecentComments(space.id, req.query.count, config);
            return res.json({ errno: 0, data });
        }

        // type=list - 管理列表 (需要管理员)
        if (type === 'list') {
            if (!isSpaceAdmin(req)) {
                return res.status(401).json({ errno: 1003, errmsg: 'Unauthorized' });
            }
            const data = await getCommentList(space.id, {
                ...req.query,
                userId: req.walineUser?.userId,
            }, config);
            return res.json({ errno: 0, data });
        }

        // 默认 - 评论列表
        const pageUrl = req.query.path || req.query.url;
        if (!pageUrl) {
            return res.json({ errno: 0, data: { page: 1, totalPages: 0, pageSize: 10, count: 0, data: [] } });
        }

        const admin = isSpaceAdmin(req);
        const data = await getComments(space.id, { url: pageUrl, ...req.query }, { isAdmin: admin, config });
        return res.json({ errno: 0, data });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /comment/:spaceCuid/api/comment
 * 发表评论
 */
router.post('/:spaceCuid/api/comment', async (req, res, next) => {
    try {
        const space = req.commentSpace;
        const config = req.spaceConfig;
        const ip = req.ipInfo?.clientIP || req.ip;

        // 检查 login=force
        if (config.login === 'force' && !req.walineUser) {
            return res.status(401).json({ errno: 1003, errmsg: 'Login required' });
        }

        const { comment, url } = req.body;
        if (!comment || !url) {
            return res.status(400).json({ errno: 1004, errmsg: 'Missing comment or url' });
        }

        // 验证码校验
        const turnstileToken = req.body.turnstileToken || req.body['cf-turnstile-response'] || null;
        const recaptchaToken = req.body.recaptchaToken || req.body['g-recaptcha-response'] || null;
        const captchaResult = await verifyCaptcha(config, turnstileToken, recaptchaToken, ip);
        if (!captchaResult.pass) {
            return res.status(403).json({ errno: 1010, errmsg: captchaResult.reason || 'Captcha verification failed' });
        }

        // IP 频率限制
        const ipqps = parseInt(config.ipqps) || 60;
        const allowed = await checkIpRate(space.id, ip, ipqps);
        if (!allowed) {
            return res.status(429).json({ errno: 1005, errmsg: 'Too many requests, please try again later' });
        }

        // 重复内容检测
        const isDuplicate = await checkDuplicate(space.id, ip, comment);
        if (isDuplicate) {
            return res.status(400).json({ errno: 1006, errmsg: 'Duplicate comment' });
        }

        const ua = req.headers['user-agent'] || '';

        const record = await createComment(
            space.id,
            {
                comment,
                url,
                pid: req.body.pid || null,
                rid: req.body.rid || null,
                nick: req.body.nick || null,
                mail: req.body.mail || null,
                link: req.body.link || null,
                ua,
                ip,
            },
            config,
            req.walineUser,
        );

        // 格式化返回
        const spaceUser = req.walineUser?.userId
            ? await getSpaceUser(space.id, req.walineUser.userId)
            : null;
        const formatted = await formatComment(record, {
            isAdmin: isSpaceAdmin(req),
            spaceUser,
            zcUser: req.walineUser?.zcUser || null,
            disableUserAgent: config.disableUserAgent === 'true',
            disableRegion: config.disableRegion === 'true',
        });

        // 异步入队通知（不阻塞响应）
        try {
            if (record.status === 'approved' || record.status === 'waiting') {
                queueManager.enqueueCommentNotification('admin_new_comment', record.id, space.id, space.cuid);
            }
            if (record.status === 'approved' && record.pid) {
                queueManager.enqueueCommentNotification('reply_notification', record.id, space.id, space.cuid);
            }
        } catch (notifyErr) {
            logger.warn('[comment] Failed to enqueue notification:', notifyErr.message);
        }

        return res.json({ errno: 0, errmsg: '', data: formatted });
    } catch (err) {
        if (err.errno === 1009) {
            return res.status(403).json({ errno: 1009, errmsg: err.message });
        }
        next(err);
    }
});

/**
 * PUT /comment/:spaceCuid/api/comment/:id
 * 更新评论
 */
router.put('/:spaceCuid/api/comment/:id', async (req, res, next) => {
    try {
        const space = req.commentSpace;

        // 点赞操作允许匿名用户，其他编辑操作需要登录
        const isLikeOnly = Object.keys(req.body).length === 1 && req.body.like !== undefined;
        if (!req.walineUser && !isLikeOnly) {
            return res.status(401).json({ errno: 1003, errmsg: 'Login required' });
        }

        const admin = isSpaceAdmin(req);
        const updated = await updateComment(
            space.id,
            req.params.id,
            req.body,
            req.walineUser?.userId,
            admin,
        );

        if (!updated) {
            return res.status(403).json({ errno: 1007, errmsg: 'Forbidden or not found' });
        }

        const spaceUser = req.walineUser?.userId
            ? await getSpaceUser(space.id, req.walineUser.userId)
            : null;
        const formatted = await formatComment(updated, {
            isAdmin: admin,
            spaceUser,
            zcUser: req.walineUser?.zcUser || null,
        });

        return res.json({ errno: 0, errmsg: '', data: formatted });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /comment/:spaceCuid/api/comment/:id
 * 删除评论
 */
router.delete('/:spaceCuid/api/comment/:id', async (req, res, next) => {
    try {
        const space = req.commentSpace;
        if (!req.walineUser) {
            return res.status(401).json({ errno: 1003, errmsg: 'Login required' });
        }

        const admin = isSpaceAdmin(req);
        const deleted = await deleteComment(
            space.id,
            req.params.id,
            req.walineUser.userId,
            admin,
        );

        if (!deleted) {
            return res.status(403).json({ errno: 1007, errmsg: 'Forbidden or not found' });
        }

        return res.json({ errno: 0, errmsg: '' });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Token API (用户认证)
// ============================================================

/**
 * GET /comment/:spaceCuid/api/token
 * 获取当前用户信息
 */
router.get('/:spaceCuid/api/token', async (req, res, next) => {
    try {
        if (!req.walineUser) {
            return res.json({ errno: 0, data: {} });
        }

        const space = req.commentSpace;
        const spaceUser = req.walineSpaceUser;
        const zcUser = req.walineUser.zcUser;

        const mail = spaceUser?.email || zcUser?.email || '';
        const mailMd5 = mail
            ? crypto.createHash('md5').update(mail.trim().toLowerCase()).digest('hex')
            : '';

        // 拼接 avatar 完整 URL
        const staticUrl = await zcconfig.get('s3.staticurl');
        const rawAvatar = spaceUser?.avatar || zcUser?.avatar || '';
        const avatarUrl = rawAvatar ? `${staticUrl}/assets/${rawAvatar.substring(0, 2)}/${rawAvatar.substring(2, 4)}/${rawAvatar}.webp` : '';

        return res.json({
            errno: 0,
            data: {
                nick: spaceUser?.display_name || zcUser?.display_name || '',
                mail,
                link: spaceUser?.url || zcUser?.url || '',
                avatar: avatarUrl,
                type: toWalineType(spaceUser?.type),
                label: spaceUser?.label || zcUser?.label || '',
                objectId: String(req.walineUser.userId),
                mailMd5,
                username: zcUser?.username || '',
                display_name: zcUser?.display_name || '',
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /comment/:spaceCuid/api/token
 * 引导至 ZeroCat 登录 (返回登录URL)
 */
router.post('/:spaceCuid/api/token', async (req, res, next) => {
    try {
        const frontendUrl = await zcconfig.get('urls.frontend');
        return res.json({
            errno: 0,
            data: {
                url: `${frontendUrl}/app/commentservice/login?space=${req.commentSpace.cuid}`,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /comment/:spaceCuid/api/token
 * 登出 (no-op, 客户端清除即可)
 */
router.delete('/:spaceCuid/api/token', (req, res) => {
    res.json({ errno: 0, errmsg: '' });
});

// ============================================================
// User API
// ============================================================

/**
 * GET /comment/:spaceCuid/api/user
 * 用户列表 (管理员)
 */
router.get('/:spaceCuid/api/user', async (req, res, next) => {
    try {
        if (!isSpaceAdmin(req)) {
            return res.status(401).json({ errno: 1003, errmsg: 'Unauthorized' });
        }

        const data = await listSpaceUsers(
            req.commentSpace.id,
            parseInt(req.query.page) || 1,
            parseInt(req.query.pageSize) || 20,
            { type: req.query.type || null, keyword: req.query.keyword || null },
        );

        const users = data.users.map(u => ({
            objectId: String(u.user_id),
            display_name: u.display_name || u.user?.display_name || '',
            email: u.email || '',
            url: u.url || '',
            avatar: u.avatar || u.user?.avatar || '',
            type: u.type,
            label: u.label || '',
        }));

        return res.json({
            errno: 0,
            data: {
                page: data.page,
                totalPages: data.totalPages,
                pageSize: data.pageSize,
                count: data.count,
                data: users,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /comment/:spaceCuid/api/user
 * 更新自己的资料
 */
router.put('/:spaceCuid/api/user', async (req, res, next) => {
    try {
        if (!req.walineUser) {
            return res.status(401).json({ errno: 1003, errmsg: 'Login required' });
        }

        const space = req.commentSpace;
        const spaceUser = await getOrCreateSpaceUser(space.id, req.walineUser.userId, {
            display_name: req.walineUser.nick,
        });

        const updateData = {};
        if (req.body.display_name !== undefined) updateData.display_name = req.body.display_name;
        if (req.body.url !== undefined) updateData.url = req.body.url;
        if (req.body.avatar !== undefined) updateData.avatar = req.body.avatar;

        const updated = await updateSpaceUser(space.id, req.walineUser.userId, updateData);
        return res.json({ errno: 0, data: updated });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /comment/:spaceCuid/api/user/:id
 * 管理员: 更新用户
 */
router.put('/:spaceCuid/api/user/:id', async (req, res, next) => {
    try {
        if (!isSpaceAdmin(req)) {
            return res.status(401).json({ errno: 1003, errmsg: 'Unauthorized' });
        }

        const updated = await updateSpaceUser(
            req.commentSpace.id,
            parseInt(req.params.id),
            req.body,
        );
        return res.json({ errno: 0, data: updated });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /comment/:spaceCuid/api/user/:id
 * 管理员: 封禁用户 (设置type=banned)
 */
router.delete('/:spaceCuid/api/user/:id', async (req, res, next) => {
    try {
        if (!isSpaceAdmin(req)) {
            return res.status(401).json({ errno: 1003, errmsg: 'Unauthorized' });
        }

        await updateSpaceUser(
            req.commentSpace.id,
            parseInt(req.params.id),
            { type: 'banned' },
        );

        return res.json({ errno: 0, errmsg: '' });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Article API (页面计数器)
// ============================================================

/**
 * GET /comment/:spaceCuid/api/article
 * 获取页面计数器
 */
router.get('/:spaceCuid/api/article', async (req, res, next) => {
    try {
        let urls = req.query.path || req.query.url;
        if (!urls) return res.json({ errno: 0, data: [] });

        if (typeof urls === 'string' && urls.includes(',')) {
            urls = urls.split(',');
        }

        const data = await getArticleCounter(req.commentSpace.id, urls);
        return res.json({ errno: 0, data });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /comment/:spaceCuid/api/article
 * 更新页面计数器
 */
router.post('/:spaceCuid/api/article', async (req, res, next) => {
    try {
        const url = req.body.path || req.body.url;
        if (!url) return res.status(400).json({ errno: 1004, errmsg: 'Missing url' });

        const time = await updateArticleCounter(req.commentSpace.id, url);
        return res.json({ errno: 0, data: time });
    } catch (err) {
        next(err);
    }
});

// ============================================================
// RSS
// ============================================================

/**
 * GET /comment/:spaceCuid/api/comment/rss
 * RSS 订阅 — 返回最近评论的标准 RSS 2.0
 * 可选 ?path=/xxx 按页面路径过滤
 */
router.get('/:spaceCuid/api/comment/rss', async (req, res, next) => {
    try {
        const space = req.commentSpace;
        const pathFilter = req.query.path || null;

        const where = { space_id: space.id, status: 'approved' };
        if (pathFilter) where.url = pathFilter;

        const comments = await prisma.ow_comment_service.findMany({
            where,
            orderBy: { insertedAt: 'desc' },
            take: 50,
        });

        // 构建 base link
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const now = new Date().toUTCString();
        const lastBuild = comments.length > 0
            ? comments[0].insertedAt.toUTCString()
            : now;

        const escapeXml = (s) =>
            String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

        const items = comments.map(c => {
            const commentUrl = c.url || '/';
            const nick = c.nick || 'Anonymous';
            return `        <item>
            <title><![CDATA[${nick} commented on ${commentUrl}]]></title>
            <description><![CDATA[${c.comment}]]></description>
            <link>${escapeXml(baseUrl)}/#${c.id}</link>
            <guid isPermaLink="false">${c.id}</guid>
            <pubDate>${c.insertedAt.toUTCString()}</pubDate>
        </item>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
    <channel>
        <title><![CDATA[${space.name} Recent Comments]]></title>
        <description><![CDATA[Recent comments.]]></description>
        <link>${escapeXml(baseUrl)}</link>
        <generator>ZeroCat Comment Service</generator>
        <lastBuildDate>${lastBuild}</lastBuildDate>
        <pubDate>${lastBuild}</pubDate>
${items}
    </channel>
</rss>`;

        res.set('Content-Type', 'application/rss+xml; charset=utf-8');
        return res.send(xml);
    } catch (err) {
        next(err);
    }
});

// ============================================================
// UI 路由
// ============================================================

/**
 * GET /comment/:spaceCuid/ui/login
 * 重定向到 ZeroCat 前端登录
 */
router.get('/:spaceCuid/ui/login', async (req, res, next) => {
    try {
        const frontendUrl = await zcconfig.get('urls.frontend');
        return res.redirect(302, `${frontendUrl}/app/commentservice/login?space=${req.commentSpace.cuid}`);
    } catch (err) {
        next(err);
    }
});

export default router;
