/**
 * ActivityPub 路由
 * 实现 WebFinger、NodeInfo、Actor、Inbox、Outbox 等 AP 端点
 */

import { Router } from 'express';
import express from 'express';
import logger from '../services/logger.js';
import { prisma } from '../services/prisma.js';
import zcconfig from '../services/config/zcconfig.js';
import {
    AP_CONTENT_TYPE, AP_CONTEXT,
    getInstanceDomain, getInstanceBaseUrl, getApEndpointBaseUrl, getStaticUrl,
    isFederationEnabled, isApRequest,
    buildActorObject, getLocalUserByUsername,
    verifyInboxRequest, processInboxActivity,
    buildUserOutbox,
    countRemoteFollowers, getRemoteFollowers,
    buildOrderedCollection, buildOrderedCollectionPage,
    getNoteId, getNoteUrl, postToNote, getCardUrl,
    buildCreateActivity, getActorUrl,
} from '../services/activitypub/index.js';

const router = Router();

// ─── AP Body Parser：解析 activity+json / ld+json 并保留原始 body ───
router.use(express.json({
    type: [
        'application/activity+json',
        'application/ld+json',
        'application/json',
    ],
    limit: '1mb',
    verify: (req, _res, buf) => {
        // 保存原始 Buffer 用于 Digest / Signature 验证
        req.rawBody = buf;
    },
}));

// ─── 中间件：检查联邦是否启用 ──────────────────────────────

async function requireFederation(req, res, next) {
    const enabled = await isFederationEnabled();
    if (!enabled) {
        return res.status(404).json({
            error: 'ActivityPub federation is not enabled on this instance',
        });
    }
    next();
}

// ─── host-meta ──────────────────────────────────────────────

router.get('/host-meta', async (req, res) => {
    try {
        const baseUrl = await getInstanceBaseUrl();
        res.set('Content-Type', 'application/xrd+xml; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n` +
            `  <Link rel="lrdd" template="${baseUrl}/.well-known/webfinger?resource={uri}"/>\n` +
            `</XRD>`
        );
    } catch (err) {
        logger.error('[ap-route] host-meta error:', err);
        res.status(500).send('Internal server error');
    }
});

// ─── WebFinger ──────────────────────────────────────────────

router.get('/webfinger', async (req, res) => {
    try {
        const resource = req.query.resource;
        if (!resource) {
            return res.status(400).json({ error: 'Missing resource parameter' });
        }

        // 解析 acct:username@domain 格式
        const acctMatch = resource.match(/^acct:([^@]+)@(.+)$/);
        if (!acctMatch) {
            return res.status(400).json({ error: 'Invalid resource format. Expected acct:user@domain' });
        }

        const [, username, domain] = acctMatch;
        const instanceDomain = await getInstanceDomain();

        // 只处理本实例的请求
        if (domain !== instanceDomain) {
            return res.status(404).json({ error: 'User not found on this instance' });
        }

        // 查找用户
        const user = await getLocalUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const baseUrl = await getInstanceBaseUrl();
        const apBaseUrl = await getApEndpointBaseUrl();

        res.set('Content-Type', 'application/jrd+json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        return res.json({
            subject: `acct:${user.username}@${instanceDomain}`,
            aliases: [
                `${apBaseUrl}/ap/users/${user.username}`,
                `${baseUrl}/${user.username}`,
            ],
            links: [
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `${apBaseUrl}/ap/users/${user.username}`,
                },
                {
                    rel: 'http://webfinger.net/rel/profile-page',
                    type: 'text/html',
                    href: `${baseUrl}/${user.username}`,
                },
            ],
        });
    } catch (err) {
        logger.error('[ap-route] WebFinger error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── NodeInfo ───────────────────────────────────────────────

router.get('/nodeinfo', async (req, res) => {
    try {
        const apBaseUrl = await getApEndpointBaseUrl();
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        return res.json({
            links: [
                {
                    rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                    href: `${apBaseUrl}/ap/nodeinfo/2.0`,
                },
            ],
        });
    } catch (err) {
        logger.error('[ap-route] NodeInfo links error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/nodeinfo/2.0', async (req, res) => {
    try {
        const [userCount, postCount] = await Promise.all([
            prisma.ow_users.count({ where: { status: 'active' } }),
            prisma.ow_posts.count({ where: { is_deleted: false } }),
        ]);

        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        return res.json({
            version: '2.0',
            software: {
                name: 'zerocat',
                version: '1.0.0',
            },
            protocols: ['activitypub'],
            usage: {
                users: {
                    total: userCount,
                    activeMonth: userCount, // 简化处理
                    activeHalfyear: userCount,
                },
                localPosts: postCount,
            },
            openRegistrations: true,
            services: {
                inbound: [],
                outbound: [],
            },
            metadata: {},
        });
    } catch (err) {
        logger.error('[ap-route] NodeInfo 2.0 error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Actor Profile ──────────────────────────────────────────

router.get('/users/:username', requireFederation, async (req, res) => {
    try {
        const { username } = req.params;

        // 检查 Accept 头 - 只在 AP 请求时返回 JSON-LD
        if (!isApRequest(req)) {
            // 非 AP 请求重定向到用户页面
            const baseUrl = await getInstanceBaseUrl();
            return res.redirect(`${baseUrl}/${username}`);
        }

        const user = await getLocalUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const actor = await buildActorObject(user);

        res.set('Content-Type', AP_CONTENT_TYPE);
        res.set('Cache-Control', 'max-age=300');
        return res.json(actor);
    } catch (err) {
        logger.error('[ap-route] Actor error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── User Inbox (POST) ─────────────────────────────────────

router.post('/users/:username/inbox', requireFederation, async (req, res) => {
    try {
        const { username } = req.params;

        // 验证目标用户存在
        const user = await getLocalUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 验证 HTTP Signature
        const verification = await verifyInboxRequest(req);
        if (!verification.valid) {
            logger.warn(`[ap-route] Inbox signature verification failed for ${username}: ${verification.message}`);
            // 在开发环境可以放宽验证
            if (process.env.NODE_ENV === 'production') {
                return res.status(401).json({ error: verification.message });
            }
            logger.warn('[ap-route] Proceeding without valid signature (non-production)');
        }

        const activity = req.body;
        if (!activity || !activity.type) {
            return res.status(400).json({ error: 'Invalid activity' });
        }

        // 获取远程 Actor
        const remoteActor = verification.actor || await (async () => {
            const { fetchRemoteActor } = await import('../services/activitypub/federation.js');
            const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
            return actorUrl ? fetchRemoteActor(actorUrl) : null;
        })();

        if (!remoteActor) {
            return res.status(400).json({ error: 'Could not resolve actor' });
        }

        // 处理活动
        const result = await processInboxActivity(activity, remoteActor, username);

        // ActivityPub 规范要求收件箱返回 202 Accepted
        return res.status(202).json({ status: 'accepted', ...result });
    } catch (err) {
        logger.error('[ap-route] Inbox error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Shared Inbox (POST) ────────────────────────────────────

router.post('/inbox', requireFederation, async (req, res) => {
    try {
        // 验证 HTTP Signature
        const verification = await verifyInboxRequest(req);
        if (!verification.valid && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: verification.message });
        }

        const activity = req.body;
        if (!activity || !activity.type) {
            return res.status(400).json({ error: 'Invalid activity' });
        }

        const remoteActor = verification.actor || await (async () => {
            const { fetchRemoteActor } = await import('../services/activitypub/federation.js');
            const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
            return actorUrl ? fetchRemoteActor(actorUrl) : null;
        })();

        if (!remoteActor) {
            return res.status(400).json({ error: 'Could not resolve actor' });
        }

        // 共享收件箱不指定特定用户
        const result = await processInboxActivity(activity, remoteActor, null);

        return res.status(202).json({ status: 'accepted', ...result });
    } catch (err) {
        logger.error('[ap-route] Shared inbox error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── User Outbox (GET) ──────────────────────────────────────

router.get('/users/:username/outbox', requireFederation, async (req, res) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 0;

        const outbox = await buildUserOutbox(username, page);
        if (!outbox) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.set('Content-Type', AP_CONTENT_TYPE);
        res.set('Cache-Control', 'max-age=60');
        return res.json(outbox);
    } catch (err) {
        logger.error('[ap-route] Outbox error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Followers Collection ───────────────────────────────────

router.get('/users/:username/followers', requireFederation, async (req, res) => {
    try {
        const { username } = req.params;
        const apBaseUrl = await getApEndpointBaseUrl();
        const followersUrl = `${apBaseUrl}/ap/users/${username}/followers`;
        const page = parseInt(req.query.page) || 0;

        const user = await getLocalUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 统计本地关注者
        const localFollowerCount = await prisma.ow_user_relationships.count({
            where: {
                target_user_id: user.id,
                relationship_type: 'follow',
            },
        });

        // 统计远程关注者
        const remoteFollowerCount = await countRemoteFollowers(user.id);
        const totalItems = localFollowerCount + remoteFollowerCount;

        if (page === 0) {
            res.set('Content-Type', AP_CONTENT_TYPE);
            return res.json(buildOrderedCollection(
                followersUrl,
                totalItems,
                `${followersUrl}?page=1`,
            ));
        }

        // 获取关注者列表（AP 规范通常只返回 URL）
        const pageSize = 20;

        // 获取本地关注者
        const localFollowers = await prisma.ow_user_relationships.findMany({
            where: {
                target_user_id: user.id,
                relationship_type: 'follow',
            },
            include: {
                source_user: { select: { username: true } },
            },
            take: pageSize,
            skip: (page - 1) * pageSize,
        });

        const items = localFollowers
            .filter(f => f.source_user)
            .map(f => `${apBaseUrl}/ap/users/${f.source_user.username}`);

        // 如果本地关注者不足一页，补充远程关注者
        if (items.length < pageSize) {
            const remoteOffset = Math.max(0, (page - 1) * pageSize - localFollowerCount);
            const remoteFollowers = await getRemoteFollowers(
                user.id,
                pageSize - items.length,
                remoteOffset,
            );
            items.push(...remoteFollowers.map(f => f.actorUrl));
        }

        const hasMore = items.length === pageSize;
        const nextPage = hasMore ? `${followersUrl}?page=${page + 1}` : null;
        const prevPage = page > 1 ? `${followersUrl}?page=${page - 1}` : null;

        res.set('Content-Type', AP_CONTENT_TYPE);
        return res.json(buildOrderedCollectionPage(
            `${followersUrl}?page=${page}`,
            followersUrl,
            items,
            nextPage,
            prevPage,
        ));
    } catch (err) {
        logger.error('[ap-route] Followers error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Following Collection ───────────────────────────────────

router.get('/users/:username/following', requireFederation, async (req, res) => {
    try {
        const { username } = req.params;
        const apBaseUrl = await getApEndpointBaseUrl();
        const followingUrl = `${apBaseUrl}/ap/users/${username}/following`;
        const page = parseInt(req.query.page) || 0;

        const user = await getLocalUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const totalItems = await prisma.ow_user_relationships.count({
            where: {
                source_user_id: user.id,
                relationship_type: 'follow',
            },
        });

        if (page === 0) {
            res.set('Content-Type', AP_CONTENT_TYPE);
            return res.json(buildOrderedCollection(
                followingUrl,
                totalItems,
                `${followingUrl}?page=1`,
            ));
        }

        const pageSize = 20;
        const following = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: user.id,
                relationship_type: 'follow',
            },
            include: {
                target_user: { select: { username: true } },
            },
            take: pageSize,
            skip: (page - 1) * pageSize,
        });

        const items = following
            .filter(f => f.target_user)
            .map(f => `${apBaseUrl}/ap/users/${f.target_user.username}`);

        const hasMore = items.length === pageSize;
        const nextPage = hasMore ? `${followingUrl}?page=${page + 1}` : null;
        const prevPage = page > 1 ? `${followingUrl}?page=${page - 1}` : null;

        res.set('Content-Type', AP_CONTENT_TYPE);
        return res.json(buildOrderedCollectionPage(
            `${followingUrl}?page=${page}`,
            followingUrl,
            items,
            nextPage,
            prevPage,
        ));
    } catch (err) {
        logger.error('[ap-route] Following error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Note Object (GET) ─────────────────────────────────────

router.get('/notes/:postId', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'Invalid post ID' });
        }

        const post = await prisma.ow_posts.findUnique({
            where: { id: postId },
            include: {
                author: { select: { id: true, username: true, display_name: true } },
            },
        });

        if (!post || post.is_deleted) {
            // AP 规范要求返回 Tombstone
            if (isApRequest(req)) {
                res.set('Content-Type', AP_CONTENT_TYPE);
                return res.status(410).json({
                    '@context': AP_CONTEXT,
                    id: await getNoteId(postId),
                    type: 'Tombstone',
                    formerType: 'Note',
                });
            }
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!isApRequest(req)) {
            // 非 AP 请求重定向到帖子页面
            const baseUrl = await getInstanceBaseUrl();
            return res.redirect(`${baseUrl}/app/posts/${postId}`);
        }

        const note = await postToNote(post);
        if (!note) {
            return res.status(500).json({ error: 'Could not serialize post' });
        }

        res.set('Content-Type', AP_CONTENT_TYPE);
        res.set('Cache-Control', 'max-age=300');
        return res.json(note);
    } catch (err) {
        logger.error('[ap-route] Note error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Activity Object (GET) ──────────────────────────────────

router.get('/activities/:activityId', requireFederation, async (req, res) => {
    try {
        const { getActivity } = await import('../services/activitypub/store.js');
        const activity = await getActivity(req.params.activityId);

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.set('Content-Type', AP_CONTENT_TYPE);
        return res.json(activity);
    } catch (err) {
        logger.error('[ap-route] Activity error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── AP 管理接口 ─────────────────────────────────────────────

router.get('/status', async (req, res) => {
    try {
        const { getActivityPubStatus } = await import('../services/activitypub/setup.js');
        const status = await getActivityPubStatus();
        return res.json(status);
    } catch (err) {
        logger.error('[ap-route] Status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 初始化/配置 ActivityPub (需要管理员权限)
 * POST /ap/admin/setup
 * Body: { domain?, name?, description?, enabled?, autoAcceptFollows? }
 */
router.post('/admin/setup', async (req, res) => {
    try {
        // 验证管理员权限
        if (!res.locals.userid) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const zcconfig = (await import('../services/config/zcconfig.js')).default;
        const adminUsers = await zcconfig.get('security.adminusers');
        if (!adminUsers?.includes(String(res.locals.userid))) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { initializeActivityPub } = await import('../services/activitypub/setup.js');
        const result = await initializeActivityPub(req.body);

        return res.json({ status: 'ok', ...result });
    } catch (err) {
        logger.error('[ap-route] Setup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 切换联邦启用状态 (需要管理员权限)
 * PATCH /ap/admin/federation
 * Body: { enabled: boolean }
 */
router.patch('/admin/federation', async (req, res) => {
    try {
        if (!res.locals.userid) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const zcconfig = (await import('../services/config/zcconfig.js')).default;
        const adminUsers = await zcconfig.get('security.adminusers');
        if (!adminUsers?.includes(String(res.locals.userid))) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { setFederationEnabled } = await import('../services/activitypub/setup.js');
        await setFederationEnabled(Boolean(req.body.enabled));

        return res.json({ status: 'ok', enabled: Boolean(req.body.enabled) });
    } catch (err) {
        logger.error('[ap-route] Federation toggle error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * 用户的远程关注者统计
 * GET /ap/users/:username/remote-followers/count
 */
router.get('/users/:username/remote-followers/count', async (req, res) => {
    try {
        const user = await getLocalUserByUsername(req.params.username);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const count = await countRemoteFollowers(user.id);
        return res.json({ username: req.params.username, remoteFollowers: count });
    } catch (err) {
        logger.error('[ap-route] Remote followers count error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// OG Card 端点 — 为 Mastodon 等 ActivityPub 实现提供链接预览卡片
// Mastodon 从帖子 content HTML 中提取 URL 并抓取其 OpenGraph 元数据
// 这些端点返回带有 og: 标签的最小 HTML 页面，并自动重定向到前端
// ═══════════════════════════════════════════════════════════════

/**
 * 生成带 OG 标签的最小 HTML 页面
 */
function renderOgPage({ title, description, image, url, siteName, redirectUrl }) {
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description || '')}"/>
${image ? `<meta property="og:image" content="${esc(image)}"/>` : ''}
<meta property="og:url" content="${esc(url)}"/>
${siteName ? `<meta property="og:site_name" content="${esc(siteName)}"/>` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description || '')}"/>
${image ? `<meta name="twitter:image" content="${esc(image)}"/>` : ''}
<meta http-equiv="refresh" content="0;url=${esc(redirectUrl || url)}"/>
<title>${esc(title)}</title>
</head>
<body>
<p>Redirecting to <a href="${esc(redirectUrl || url)}">${esc(title)}</a>...</p>
</body>
</html>`;
}

/**
 * OG Card: Project
 * GET /ap/card/project/:id
 */
router.get('/card/project/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('Invalid ID');

        const project = await prisma.ow_projects.findUnique({
            where: { id },
            select: {
                id: true, name: true, title: true, description: true,
                thumbnail: true, state: true,
                author: { select: { username: true, display_name: true } },
            },
        });

        if (!project || project.state === 'private') {
            return res.status(404).send('Not found');
        }

        const staticUrl = await getStaticUrl();
        const frontendUrl = (await zcconfig.get('urls.frontend')) || (await getInstanceBaseUrl());
        const domain = await getInstanceDomain();
        const title = project.title || project.name;
        const description = project.description
            ? project.description.substring(0, 200)
            : `Project by ${project.author?.display_name || project.author?.username || 'unknown'}`;
        let image = null;
        if (project.thumbnail) {
            const p1 = project.thumbnail.substring(0, 2);
            const p2 = project.thumbnail.substring(2, 4);
            image = `${staticUrl}/assets/${p1}/${p2}/${project.thumbnail}.webp`;
        }

        const authorName = project.author?.username || 'unknown';
        const projectUrl = `${frontendUrl}/${encodeURIComponent(authorName)}/${encodeURIComponent(project.name)}`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'max-age=3600');
        return res.send(renderOgPage({
            title,
            description,
            image,
            url: projectUrl,
            siteName: domain,
            redirectUrl: projectUrl,
        }));
    } catch (err) {
        logger.error('[ap-card] Project card error:', err);
        res.status(500).send('Internal server error');
    }
});

/**
 * OG Card: User
 * GET /ap/card/user/:id
 */
router.get('/card/user/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('Invalid ID');

        const user = await prisma.ow_users.findUnique({
            where: { id },
            select: { id: true, username: true, display_name: true, bio: true, avatar: true },
        });

        if (!user) return res.status(404).send('Not found');

        const staticUrl = await getStaticUrl();
        const frontendUrl = (await zcconfig.get('urls.frontend')) || (await getInstanceBaseUrl());
        const domain = await getInstanceDomain();
        const title = `${user.display_name || user.username} (@${user.username}@${domain})`;
        const description = user.bio ? user.bio.substring(0, 200) : `User profile on ${domain}`;
        let image = null;
        if (user.avatar && !user.avatar.startsWith('http')) {
            const p1 = user.avatar.substring(0, 2);
            const p2 = user.avatar.substring(2, 4);
            image = `${staticUrl}/assets/${p1}/${p2}/${user.avatar}.webp`;
        }

        const userUrl = `${frontendUrl}/${encodeURIComponent(user.username)}`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'max-age=3600');
        return res.send(renderOgPage({
            title,
            description,
            image,
            url: userUrl,
            siteName: domain,
            redirectUrl: userUrl,
        }));
    } catch (err) {
        logger.error('[ap-card] User card error:', err);
        res.status(500).send('Internal server error');
    }
});

/**
 * OG Card: List (合集)
 * GET /ap/card/list/:id
 */
router.get('/card/list/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('Invalid ID');

        const list = await prisma.ow_projects_lists.findUnique({
            where: { id },
            select: {
                id: true, title: true, description: true, state: true,
                author: { select: { username: true, display_name: true } },
            },
        });

        if (!list || list.state === 'private') {
            return res.status(404).send('Not found');
        }

        const frontendUrl = (await zcconfig.get('urls.frontend')) || (await getInstanceBaseUrl());
        const domain = await getInstanceDomain();
        const title = list.title;
        const description = list.description
            ? list.description.substring(0, 200)
            : `Collection by ${list.author?.display_name || list.author?.username || 'unknown'}`;

        const listUrl = `${frontendUrl}/app/projectlist/${list.id}`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'max-age=3600');
        return res.send(renderOgPage({
            title,
            description,
            image: null,
            url: listUrl,
            siteName: domain,
            redirectUrl: listUrl,
        }));
    } catch (err) {
        logger.error('[ap-card] List card error:', err);
        res.status(500).send('Internal server error');
    }
});

export default router;
