import crypto from 'crypto';
import { RichText } from '@atproto/api';
import { prisma } from '../prisma.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import { fetchWithProxy } from '../proxy/proxyManager.js';
import { getUserAtprotoSyncDid, restoreAtprotoSyncAgent } from './atprotoSyncOAuth.js';

const USER_TARGET_TYPE = 'user';
const POST_TARGET_TYPE = 'post';

function getTargetConfigModel() {
    return prisma.ow_target_configs || prisma.c;
}

export const SOCIAL_KEYS = {
    SYNC_SETTINGS: 'social.sync.settings',
    TWITTER_SYNC_APP: 'social.twitter.sync.app',
    TWITTER_SYNC_TOKENS: 'social.twitter.sync.tokens',
    BLUESKY_SYNC_TOKENS: 'social.bluesky.sync.tokens',
    BLUESKY_PDS: 'social.bluesky.pds',
};

export const SOCIAL_EVENT_TYPES = {
    POST_CREATE: 'create',
    POST_REPLY: 'reply',
    POST_QUOTE: 'quote',
    POST_DELETE: 'delete',
    POST_LIKE: 'like',
    POST_UNLIKE: 'unlike',
    POST_BOOKMARK: 'bookmark',
    POST_UNBOOKMARK: 'unbookmark',
};

const ACTION_REF_PREFIX = 'social.post.action';

function normalizeUrlBase(input) {
    const raw = typeof input === 'string' ? input.trim() : '';
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

async function getTargetConfig(targetType, targetId, key) {
    const targetConfig = getTargetConfigModel();
    const record = await targetConfig.findUnique({
        where: {
            target_type_target_id_key: {
                target_type: targetType,
                target_id: String(targetId),
                key,
            },
        },
    });
    return record?.value || null;
}

async function upsertTargetConfig(targetType, targetId, key, value) {
    const finalValue = typeof value === 'string' ? value : JSON.stringify(value);
    const targetConfig = getTargetConfigModel();
    await targetConfig.upsert({
        where: {
            target_type_target_id_key: {
                target_type: targetType,
                target_id: String(targetId),
                key,
            },
        },
        update: { value: finalValue },
        create: {
            target_type: targetType,
            target_id: String(targetId),
            key,
            value: finalValue,
        },
    });
}

async function deleteTargetConfig(targetType, targetId, key) {
    const targetConfig = getTargetConfigModel();
    await targetConfig.deleteMany({
        where: {
            target_type: targetType,
            target_id: String(targetId),
            key,
        },
    });
}

function parseJson(raw, fallback = null) {
    if (!raw || typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export async function getUserSocialSyncSettings(userId) {
    const raw = await getTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.SYNC_SETTINGS);
    const parsed = parseJson(raw, {});
    return {
        twitter: Boolean(parsed?.twitter),
        bluesky: Boolean(parsed?.bluesky),
    };
}

export async function setUserSocialSyncSettings(userId, patch) {
    const current = await getUserSocialSyncSettings(userId);
    const next = {
        ...current,
        ...(patch?.twitter !== undefined ? { twitter: Boolean(patch.twitter) } : {}),
        ...(patch?.bluesky !== undefined ? { bluesky: Boolean(patch.bluesky) } : {}),
    };

    await upsertTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.SYNC_SETTINGS, next);
    return next;
}

function maskSecret(value) {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= 8) return '*'.repeat(value.length);
    return `${value.slice(0, 4)}${'*'.repeat(Math.max(value.length - 8, 1))}${value.slice(-4)}`;
}

export async function getTwitterSyncAppConfig(userId, { masked = true } = {}) {
    const raw = await getTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_APP);
    const parsed = parseJson(raw, null);
    if (!parsed) return null;

    if (!masked) return parsed;

    return {
        clientId: parsed.clientId || '',
        clientSecret: maskSecret(parsed.clientSecret || ''),
        redirectUri: parsed.redirectUri || '',
        scope: parsed.scope || 'tweet.read tweet.write users.read offline.access',
    };
}

export async function setTwitterSyncAppConfig(userId, data) {
    const clientId = String(data?.clientId || '').trim();
    const clientSecret = String(data?.clientSecret || '').trim();
    const redirectUriRaw = String(data?.redirectUri || '').trim();
    const scope = String(data?.scope || 'tweet.read tweet.write users.read offline.access').trim();

    if (!clientId || !clientSecret) {
        throw new Error('clientId 和 clientSecret 不能为空');
    }

    const backendUrl = await zcconfig.get('urls.backend');
    const defaultRedirect = `${normalizeUrlBase(backendUrl)}/social/twitter/sync/oauth/callback`;

    const payload = {
        clientId,
        clientSecret,
        redirectUri: redirectUriRaw ? normalizeUrlBase(redirectUriRaw) : defaultRedirect,
        scope,
        updatedAt: new Date().toISOString(),
    };

    await upsertTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_APP, payload);
    return getTwitterSyncAppConfig(userId, { masked: true });
}

export async function removeTwitterSyncAppConfig(userId) {
    await deleteTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_APP);
    await deleteTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_TOKENS);
}

export async function setUserBlueskyPds(userId, pds) {
    const normalized = normalizeUrlBase(String(pds || '').trim());
    await upsertTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.BLUESKY_PDS, normalized);
    return normalized;
}

export async function getUserBlueskyPds(userId) {
    const raw = await getTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.BLUESKY_PDS);
    if (raw) return raw;
    const fromConfig = await zcconfig.get('oauth.bluesky.default_pds');
    return fromConfig || 'https://bsky.social';
}

export async function getOAuthBindingStatus(userId) {
    const contacts = await prisma.ow_users_contacts.findMany({
        where: {
            user_id: userId,
            contact_type: { in: ['oauth_twitter', 'oauth_bluesky'] },
        },
        select: {
            contact_type: true,
            verified: true,
            metadata: true,
            updated_at: true,
        },
    });

    const map = {
        twitter: contacts.some((item) => item.contact_type === 'oauth_twitter' && item.verified),
        bluesky: contacts.some((item) => item.contact_type === 'oauth_bluesky' && item.verified),
    };

    return map;
}

export function buildTwitterSyncAuthorizeUrl({ appConfig, state, codeChallenge }) {
    const query = new URLSearchParams({
        response_type: 'code',
        client_id: appConfig.clientId,
        redirect_uri: appConfig.redirectUri,
        scope: appConfig.scope || 'tweet.read tweet.write users.read offline.access',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${query.toString()}`;
}

export function createPkcePair() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

async function getSocialProxyFetchOptions() {
    const proxyEnabled = await zcconfig.get('oauth.proxy.enabled', false);
    return {
        useProxy: Boolean(proxyEnabled),
    };
}

export async function exchangeTwitterSyncCode({ appConfig, code, codeVerifier }) {
    const proxyOptions = await getSocialProxyFetchOptions();
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appConfig.clientId,
        redirect_uri: appConfig.redirectUri,
        code,
        code_verifier: codeVerifier,
    });

    const basic = Buffer.from(`${appConfig.clientId}:${appConfig.clientSecret}`).toString('base64');
    const response = await fetchWithProxy('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        ...proxyOptions,
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: params.toString(),
    });

    const body = await response.json();
    if (!response.ok || !body?.access_token) {
        throw new Error(body?.error_description || body?.error || `Twitter token exchange failed (${response.status})`);
    }

    return {
        access_token: body.access_token,
        refresh_token: body.refresh_token || null,
        token_type: body.token_type || 'Bearer',
        scope: body.scope || null,
        expires_in: body.expires_in || null,
    };
}

export async function saveTwitterSyncTokens(userId, tokenData) {
    const payload = {
        ...tokenData,
        expires_at: Number(tokenData?.expires_in) > 0
            ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
            : null,
        updated_at: new Date().toISOString(),
    };
    await upsertTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_TOKENS, payload);
}

export async function saveBlueskySyncTokensFromDid(userId, { did, scope, handle }) {
    if (!userId || !did) {
        throw new Error('保存Bluesky同步令牌失败：缺少userId或did');
    }

    await upsertTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.BLUESKY_SYNC_TOKENS, {
        access_token: `atproto:${did}`,
        provider_user_id: did,
        did,
        provider_username: handle || null,
        scope: scope || null,
        updated_at: new Date().toISOString(),
    });
}

async function getTwitterSyncTokens(userId) {
    const raw = await getTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.TWITTER_SYNC_TOKENS);
    return parseJson(raw, null);
}

async function getBlueskySyncTokens(userId) {
    const raw = await getTargetConfig(USER_TARGET_TYPE, userId, SOCIAL_KEYS.BLUESKY_SYNC_TOKENS);
    return parseJson(raw, null);
}

function pickPostText(post) {
    if (!post?.content) return '';
    const text = String(post.content).trim();
    if (!text) return '';
    if (text.length <= 300) return text;
    return `${text.slice(0, 297)}...`;
}

function normalizePlatformRefs(refs) {
    if (!refs || typeof refs !== 'object' || Array.isArray(refs)) return {};
    return refs;
}

async function getPostForEvent(postId) {
    return prisma.ow_posts.findUnique({
        where: { id: Number(postId) },
        select: {
            id: true,
            author_id: true,
            post_type: true,
            content: true,
            embed: true,
            in_reply_to_id: true,
            thread_root_id: true,
            quoted_post_id: true,
            retweet_post_id: true,
            is_deleted: true,
            platform_refs: true,
            post_media: {
                select: {
                    order: true,
                    asset: {
                        select: {
                            md5: true,
                            extension: true,
                            mime_type: true,
                        },
                    },
                },
                orderBy: { order: 'asc' },
            },
        },
    });
}

async function setPostPlatformRef(postId, platform, refData) {
    const current = await prisma.ow_posts.findUnique({
        where: { id: Number(postId) },
        select: { platform_refs: true },
    });

    const refs = normalizePlatformRefs(current?.platform_refs);
    refs[platform] = refData;

    await prisma.ow_posts.update({
        where: { id: Number(postId) },
        data: { platform_refs: refs },
    });
}

function buildActionRefKey(platform, action, userId) {
    return `${ACTION_REF_PREFIX}.${platform}.${action}.${Number(userId)}`;
}

async function saveActionRef(postId, platform, action, userId, value) {
    await upsertTargetConfig(POST_TARGET_TYPE, postId, buildActionRefKey(platform, action, userId), value);
}

async function readActionRef(postId, platform, action, userId) {
    const raw = await getTargetConfig(POST_TARGET_TYPE, postId, buildActionRefKey(platform, action, userId));
    return parseJson(raw, null);
}

async function removeActionRef(postId, platform, action, userId) {
    await deleteTargetConfig(POST_TARGET_TYPE, postId, buildActionRefKey(platform, action, userId));
}

async function buildPostOutboundText(post) {
    const base = pickPostText(post);
    const frontend = normalizeUrlBase(await zcconfig.get('urls.frontend'));
    const links = [];

    const embed = post?.embed;
    if (embed?.type === 'url' && embed?.url) links.push(String(embed.url));

    const mediaUrls = await getPostMediaUrls(post);
    for (const media of mediaUrls) {
        if (media?.url) links.push(media.url);
    }

    return [base, ...links].filter(Boolean).join('\n');
}

function buildFrontendEmbedUrl(frontend, embed) {
    if (!embed || typeof embed !== 'object') return null;
    if (embed.type === 'post' && embed.id) return `${frontend}/posts/${embed.id}`;
    if (embed.type === 'url' && embed.url) return String(embed.url);
    return null;
}

function shortText(value, max = 280) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
}

function buildAssetUrl(staticBase, value, { defaultExt = '' } = {}) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const p1 = raw.substring(0, 2);
    const p2 = raw.substring(2, 4);
    const hasExt = /\.[a-z0-9]{2,6}$/i.test(raw);
    const filename = hasExt ? raw : `${raw}${defaultExt ? `.${defaultExt}` : ''}`;
    return `${staticBase}/assets/${p1}/${p2}/${filename}`;
}

async function uploadImageBlobFromUrl(agent, imageUrl) {
    const target = String(imageUrl || '').trim();
    if (!target) return null;

    try {
        const resp = await fetch(target);
        if (!resp.ok) return null;

        const contentType = String(resp.headers.get('content-type') || '').trim().toLowerCase();
        if (!contentType.startsWith('image/')) return null;

        const bytes = new Uint8Array(await resp.arrayBuffer());
        if (!bytes.length) return null;

        const uploaded = await agent.uploadBlob(bytes, {
            encoding: contentType || 'image/jpeg',
        });
        return uploaded?.data?.blob || uploaded?.blob || null;
    } catch {
        return null;
    }
}

async function resolveExternalFromOriginalEmbed(embed, frontend) {
    if (!embed || typeof embed !== 'object') return null;
    const staticBase = await getStaticBaseUrl();

    if (embed.type === 'user' && embed.id) {
        const user = await prisma.ow_users.findUnique({
            where: { id: Number(embed.id) },
            select: {
                username: true,
                display_name: true,
                bio: true,
                motto: true,
                avatar: true,
            },
        });
        if (!user?.username) return null;
        return {
            uri: `${frontend}/${encodeURIComponent(user.username)}`,
            title: shortText(user.display_name || user.username, 100),
            description: shortText(`@${user.username}${user.bio ? `\n${user.bio}` : user.motto ? `\n${user.motto}` : ''}`, 300),
            thumbUrl: buildAssetUrl(staticBase, user.avatar, { defaultExt: 'webp' }),
        };
    }

    if (embed.type === 'project' && embed.id) {
        const project = await prisma.ow_projects.findUnique({
            where: { id: Number(embed.id) },
            select: {
                id: true,
                name: true,
                title: true,
                description: true,
                thumbnail: true,
                author: {
                    select: {
                        username: true,
                        display_name: true,
                        bio: true,
                        avatar: true,
                    },
                },
            },
        });
        if (!project?.author?.username || !project?.name) return null;
        return {
            uri: `${frontend}/${encodeURIComponent(project.author.username)}/${encodeURIComponent(project.name)}`,
            title: shortText(project.title || project.name, 100),
            description: shortText(`作者: @${project.author.username}${project.description ? `\n${project.description}` : ''}`, 300),
            thumbUrl: buildAssetUrl(staticBase, project.thumbnail),
        };
    }

    if (embed.type === 'list' && embed.id) {
        const list = await prisma.ow_projects_lists.findUnique({
            where: { id: Number(embed.id) },
            select: {
                id: true,
                title: true,
                description: true,
                author: {
                    select: { username: true, display_name: true, avatar: true },
                },
            },
        });
        if (!list) return null;
        const listUri = list.author?.username
            ? `${frontend}/${encodeURIComponent(list.author.username)}/lists/${list.id}`
            : `${frontend}/lists/${list.id}`;
        return {
            uri: listUri,
            title: shortText(list.title || `列表 #${list.id}`, 100),
            description: shortText(`${list.author?.username ? `作者: @${list.author.username}\n` : ''}${list.description || ''}`, 300),
            thumbUrl: buildAssetUrl(staticBase, list.author?.avatar, { defaultExt: 'webp' }),
        };
    }

    if (embed.type === 'post' && embed.id) {
        const refPost = await prisma.ow_posts.findUnique({
            where: { id: Number(embed.id) },
            select: {
                id: true,
                content: true,
                author: { select: { username: true, display_name: true } },
            },
        });
        return {
            uri: `${frontend}/posts/${Number(embed.id)}`,
            title: shortText('ZeroCat 帖子', 100),
            description: shortText(`${refPost?.author?.username ? `作者: @${refPost.author.username}\n` : ''}${refPost?.content || ''}`, 300),
        };
    }

    if (embed.type === 'url' && embed.url) {
        return {
            uri: String(embed.url),
            title: shortText(String(embed.title || embed.url), 100),
            description: shortText(String(embed.description || ''), 300),
            thumbUrl: String(embed.thumbnail || '').trim() || null,
        };
    }

    return null;
}

async function buildBlueskyExternalEmbed(agent, post) {
    const frontend = normalizeUrlBase(await zcconfig.get('urls.frontend'));
    const resolved = await resolveExternalFromOriginalEmbed(post?.embed, frontend);
    if (!resolved?.uri) return null;
    const thumb = await uploadImageBlobFromUrl(agent, resolved.thumbUrl);

    return {
        $type: 'app.bsky.embed.external',
        external: {
            uri: resolved.uri,
            title: resolved.title || 'ZeroCat',
            description: resolved.description || '',
            ...(thumb ? { thumb } : {}),
        },
    };
}

let cachedStaticBaseUrl = null;
async function getStaticBaseUrl() {
    if (cachedStaticBaseUrl) return cachedStaticBaseUrl;
    const raw = await zcconfig.get('s3.staticurl');
    const parsed = new URL(String(raw || '').trim());
    cachedStaticBaseUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    return cachedStaticBaseUrl;
}

async function getPostMediaUrls(post) {
    const staticBase = await getStaticBaseUrl();
    const medias = Array.isArray(post?.post_media) ? post.post_media : [];
    return medias
        .map((item) => {
            const asset = item?.asset;
            if (!asset?.md5) return null;
            const ext = asset.extension || asset.mime_type?.split('/')[1] || 'webp';
            const p1 = asset.md5.substring(0, 2);
            const p2 = asset.md5.substring(2, 4);
            return {
                url: `${staticBase}/assets/${p1}/${p2}/${asset.md5}.${ext}`,
                mime: asset.mime_type || null,
            };
        })
        .filter(Boolean);
}

async function buildBlueskyImagesEmbed(agent, post) {
    const mediaUrls = await getPostMediaUrls(post);
    const images = [];

    for (const media of mediaUrls.slice(0, 4)) {
        if (!media.mime?.startsWith('image/')) continue;
        const resp = await fetch(media.url);
        if (!resp.ok) continue;
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const uploaded = await agent.uploadBlob(bytes, {
            encoding: media.mime || 'image/jpeg',
        });
        const blob = uploaded?.data?.blob || uploaded?.blob;
        if (!blob) continue;
        images.push({ image: blob, alt: '' });
    }

    if (images.length === 0) return null;
    return {
        $type: 'app.bsky.embed.images',
        images,
    };
}

async function createTwitterPost(actorUserId, post) {
    const proxyOptions = await getSocialProxyFetchOptions();
    const tokens = await getTwitterSyncTokens(actorUserId);
    if (!tokens?.access_token) throw new Error('未配置 Twitter 同步令牌');

    const text = await buildPostOutboundText(post);
    const body = { text };

    if (post.post_type === 'retweet' && post.retweet_post_id) {
        const target = await getPostForEvent(post.retweet_post_id);
        const targetRef = normalizePlatformRefs(target?.platform_refs)?.twitter;
        if (!targetRef?.id) {
            return { skipped: true, reason: 'missing_retweet_target_ref' };
        }

        const userId = String(tokens?.provider_user_id || '').trim();
        if (!userId) {
            return { skipped: true, reason: 'missing_user_binding' };
        }

        const rtResp = await fetchWithProxy(`https://api.twitter.com/2/users/${userId}/retweets`, {
            method: 'POST',
            ...proxyOptions,
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tweet_id: targetRef.id }),
        });
        const rtPayload = await rtResp.json();
        if (!rtResp.ok) {
            throw new Error(rtPayload?.detail || rtPayload?.title || `Twitter 转推失败 (${rtResp.status})`);
        }
        return {
            kind: 'retweet',
            target_id: targetRef.id,
            raw: rtPayload,
        };
    }

    if (post.post_type === 'reply' && post.in_reply_to_id) {
        const parent = await getPostForEvent(post.in_reply_to_id);
        const parentRef = normalizePlatformRefs(parent?.platform_refs)?.twitter;
        if (parentRef?.id) {
            body.reply = { in_reply_to_tweet_id: parentRef.id };
        }
    }

    if (post.post_type === 'quote' && post.quoted_post_id) {
        const quoted = await getPostForEvent(post.quoted_post_id);
        const quotedRef = normalizePlatformRefs(quoted?.platform_refs)?.twitter;
        if (quotedRef?.id) {
            body.quote_tweet_id = quotedRef.id;
        }
    }

    const response = await fetchWithProxy('https://api.twitter.com/2/tweets', {
        method: 'POST',
        ...proxyOptions,
        headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.title || `Twitter 发布失败 (${response.status})`);
    }

    return {
        id: payload?.data?.id || null,
        raw: payload,
    };
}

async function deleteTwitterPost(actorUserId, postRef) {
    if (!postRef?.id && !(postRef?.kind === 'retweet' && postRef?.target_id)) {
        return { skipped: true, reason: 'missing_ref' };
    }
    const proxyOptions = await getSocialProxyFetchOptions();
    const tokens = await getTwitterSyncTokens(actorUserId);
    if (!tokens?.access_token) return { skipped: true, reason: 'missing_token' };

    if (postRef?.kind === 'retweet' && postRef?.target_id) {
        const userId = String(tokens?.provider_user_id || '').trim();
        if (!userId) return { skipped: true, reason: 'missing_user_binding' };
        const unretweetResp = await fetchWithProxy(`https://api.twitter.com/2/users/${userId}/retweets/${postRef.target_id}`, {
            method: 'DELETE',
            ...proxyOptions,
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const unretweetPayload = await unretweetResp.json();
        if (!unretweetResp.ok) {
            throw new Error(unretweetPayload?.detail || unretweetPayload?.title || `Twitter 取消转推失败 (${unretweetResp.status})`);
        }
        return unretweetPayload;
    }

    const response = await fetchWithProxy(`https://api.twitter.com/2/tweets/${postRef.id}`, {
        method: 'DELETE',
        ...proxyOptions,
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.title || `Twitter 删除失败 (${response.status})`);
    }
    return payload;
}

async function sendTwitterEngagement(actorUserId, action, postRef) {
    if (!postRef?.id) return { skipped: true, reason: 'missing_ref' };

    const proxyOptions = await getSocialProxyFetchOptions();
    const tokens = await getTwitterSyncTokens(actorUserId);
    const userId = String(tokens?.provider_user_id || '').trim();
    if (!tokens?.access_token || !userId) {
        return { skipped: true, reason: 'missing_user_binding' };
    }

    const endpointMap = {
        like: { method: 'POST', url: `https://api.twitter.com/2/users/${userId}/likes`, body: { tweet_id: postRef.id } },
        unlike: { method: 'DELETE', url: `https://api.twitter.com/2/users/${userId}/likes/${postRef.id}` },
        bookmark: { method: 'POST', url: `https://api.twitter.com/2/users/${userId}/bookmarks`, body: { tweet_id: postRef.id } },
        unbookmark: { method: 'DELETE', url: `https://api.twitter.com/2/users/${userId}/bookmarks/${postRef.id}` },
    };

    const req = endpointMap[action];
    if (!req) return { skipped: true, reason: 'unsupported_action' };

    const response = await fetchWithProxy(req.url, {
        method: req.method,
        ...proxyOptions,
        headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            ...(req.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.title || `Twitter ${action} 失败 (${response.status})`);
    }
    return payload;
}

async function getBlueskyAgent(actorUserId) {
    const tokens = await getBlueskySyncTokens(actorUserId);
    const did = await getUserAtprotoSyncDid(actorUserId) || tokens?.provider_user_id || tokens?.did;
    if (!did) throw new Error('未配置 Bluesky 同步 OAuth 令牌，请重新绑定');

    return restoreAtprotoSyncAgent({
        did,
        scope: 'atproto repo:* blob:*/* transition:generic account:* identity:*',
    });
}

async function createBlueskyPost(actorUserId, post) {
    const agent = await getBlueskyAgent(actorUserId);

    if (post.post_type === 'retweet' && post.retweet_post_id) {
        const target = await getPostForEvent(post.retweet_post_id);
        const targetRef = normalizePlatformRefs(target?.platform_refs)?.bluesky;
        if (!targetRef?.uri || !targetRef?.cid) {
            return { skipped: true, reason: 'missing_retweet_target_ref' };
        }
        return agent.repost(targetRef.uri, targetRef.cid);
    }

    const text = pickPostText(post);
    const richText = new RichText({ text });
    await richText.detectFacets(agent);
    const imageEmbed = await buildBlueskyImagesEmbed(agent, post);
    const externalEmbed = await buildBlueskyExternalEmbed(agent, post);

    const record = {
        text: richText.text,
        ...(Array.isArray(richText.facets) && richText.facets.length > 0 ? { facets: richText.facets } : {}),
        createdAt: new Date().toISOString(),
    };

    if (post.post_type === 'reply' && post.in_reply_to_id) {
        const parent = await getPostForEvent(post.in_reply_to_id);
        const parentRef = normalizePlatformRefs(parent?.platform_refs)?.bluesky;

        const rootPostId = post.thread_root_id || post.in_reply_to_id;
        const rootPost = await getPostForEvent(rootPostId);
        const rootRef = normalizePlatformRefs(rootPost?.platform_refs)?.bluesky || parentRef;

        if (parentRef?.uri && parentRef?.cid && rootRef?.uri && rootRef?.cid) {
            record.reply = {
                root: { uri: rootRef.uri, cid: rootRef.cid },
                parent: { uri: parentRef.uri, cid: parentRef.cid },
            };
        }
    }

    if (post.post_type === 'quote' && post.quoted_post_id) {
        const quoted = await getPostForEvent(post.quoted_post_id);
        const quotedRef = normalizePlatformRefs(quoted?.platform_refs)?.bluesky;
        if (quotedRef?.uri && quotedRef?.cid) {
            const mediaEmbed = externalEmbed || imageEmbed || null;
            if (mediaEmbed) {
                record.embed = {
                    $type: 'app.bsky.embed.recordWithMedia',
                    record: {
                        record: {
                            uri: quotedRef.uri,
                            cid: quotedRef.cid,
                        },
                    },
                    media: mediaEmbed,
                };
            } else {
                record.embed = {
                    $type: 'app.bsky.embed.record',
                    record: {
                        uri: quotedRef.uri,
                        cid: quotedRef.cid,
                    },
                };
            }
        }
    } else if (externalEmbed) {
        record.embed = externalEmbed;
    } else if (imageEmbed) {
        record.embed = imageEmbed;
    }

    return agent.post(record);
}

async function deleteBlueskyPost(actorUserId, postRef) {
    if (!postRef?.uri) return { skipped: true, reason: 'missing_ref' };
    const agent = await getBlueskyAgent(actorUserId);
    if (postRef?.kind === 'repost') {
        await agent.deleteRepost(postRef.uri);
    } else {
        await agent.deletePost(postRef.uri);
    }
    return { ok: true };
}

async function likeBlueskyPost(actorUserId, postRef) {
    if (!postRef?.uri || !postRef?.cid) return { skipped: true, reason: 'missing_ref' };
    const agent = await getBlueskyAgent(actorUserId);
    return agent.like(postRef.uri, postRef.cid);
}

async function unlikeBlueskyPost(actorUserId, likeRef) {
    if (!likeRef?.uri) return { skipped: true, reason: 'missing_ref' };
    const agent = await getBlueskyAgent(actorUserId);
    await agent.deleteLike(likeRef.uri);
    return { ok: true };
}

async function handlePlatformCreate(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    if (refs?.[platform]) {
        return { skipped: true, reason: 'already_synced', ref: refs[platform] };
    }

    if (platform === 'twitter') {
        const ref = await createTwitterPost(actorUserId, post);
        if (ref?.id) await setPostPlatformRef(post.id, 'twitter', ref);
        if (ref?.kind === 'retweet' && ref?.target_id) await setPostPlatformRef(post.id, 'twitter', ref);
        return ref;
    }

    if (platform === 'bluesky') {
        const ref = await createBlueskyPost(actorUserId, post);
        if (ref?.uri) await setPostPlatformRef(post.id, 'bluesky', { uri: ref.uri, cid: ref.cid });
        if (ref?.uri && post.post_type === 'retweet') {
            await setPostPlatformRef(post.id, 'bluesky', { uri: ref.uri, cid: ref.cid || null, kind: 'repost' });
        }
        return ref;
    }

    return { skipped: true, reason: 'unknown_platform' };
}

async function handlePlatformDelete(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    const postRef = refs?.[platform];
    if (!postRef) return { skipped: true, reason: 'missing_ref' };

    if (platform === 'twitter') return deleteTwitterPost(actorUserId, postRef);
    if (platform === 'bluesky') return deleteBlueskyPost(actorUserId, postRef);
    return { skipped: true, reason: 'unknown_platform' };
}

async function handlePlatformLike(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    const postRef = refs?.[platform];
    if (!postRef) return { skipped: true, reason: 'missing_ref' };

    if (platform === 'twitter') {
        return sendTwitterEngagement(actorUserId, 'like', postRef);
    }

    if (platform === 'bluesky') {
        const likeRef = await likeBlueskyPost(actorUserId, postRef);
        await saveActionRef(post.id, 'bluesky', 'like', actorUserId, { uri: likeRef?.uri, cid: likeRef?.cid || null });
        return likeRef;
    }

    return { skipped: true, reason: 'unknown_platform' };
}

async function handlePlatformUnlike(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    const postRef = refs?.[platform];
    if (!postRef) return { skipped: true, reason: 'missing_ref' };

    if (platform === 'twitter') {
        return sendTwitterEngagement(actorUserId, 'unlike', postRef);
    }

    if (platform === 'bluesky') {
        const likeRef = await readActionRef(post.id, 'bluesky', 'like', actorUserId);
        const result = await unlikeBlueskyPost(actorUserId, likeRef);
        await removeActionRef(post.id, 'bluesky', 'like', actorUserId);
        return result;
    }

    return { skipped: true, reason: 'unknown_platform' };
}

async function handlePlatformBookmark(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    const postRef = refs?.[platform];
    if (!postRef) return { skipped: true, reason: 'missing_ref' };

    if (platform === 'twitter') {
        return sendTwitterEngagement(actorUserId, 'bookmark', postRef);
    }

    if (platform === 'bluesky') {
        return { skipped: true, reason: 'unsupported_bookmark' };
    }

    return { skipped: true, reason: 'unknown_platform' };
}

async function handlePlatformUnbookmark(platform, actorUserId, post) {
    const refs = normalizePlatformRefs(post?.platform_refs);
    const postRef = refs?.[platform];
    if (!postRef) return { skipped: true, reason: 'missing_ref' };

    if (platform === 'twitter') {
        return sendTwitterEngagement(actorUserId, 'unbookmark', postRef);
    }

    if (platform === 'bluesky') {
        return { skipped: true, reason: 'unsupported_bookmark' };
    }

    return { skipped: true, reason: 'unknown_platform' };
}

function toEventType(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (Object.values(SOCIAL_EVENT_TYPES).includes(raw)) return raw;
    if (raw === 'manual' || !raw) return SOCIAL_EVENT_TYPES.POST_CREATE;
    return raw;
}

function ensureEnabledPlatforms(settings) {
    const platforms = [];
    if (settings?.twitter) platforms.push('twitter');
    if (settings?.bluesky) platforms.push('bluesky');
    return platforms;
}

export async function syncSocialEvent({ actorUserId, postId, eventType }) {
    const uid = Number(actorUserId);
    const pid = Number(postId);
    const type = toEventType(eventType);

    if (!uid || !pid) {
        return { skipped: true, reason: 'invalid_event_payload' };
    }

    const settings = await getUserSocialSyncSettings(uid);
    const platforms = ensureEnabledPlatforms(settings);
    if (platforms.length === 0) {
        return { skipped: true, reason: 'sync_disabled' };
    }

    const post = await getPostForEvent(pid);
    if (!post) {
        return { skipped: true, reason: 'post_not_found' };
    }

    const results = {};

    for (const platform of platforms) {
        try {
            if ([SOCIAL_EVENT_TYPES.POST_CREATE, SOCIAL_EVENT_TYPES.POST_REPLY, SOCIAL_EVENT_TYPES.POST_QUOTE].includes(type)) {
                if (post.is_deleted) {
                    results[platform] = { skipped: true, reason: 'post_deleted' };
                } else {
                    results[platform] = await handlePlatformCreate(platform, uid, post);
                }
            } else if (type === SOCIAL_EVENT_TYPES.POST_DELETE) {
                results[platform] = await handlePlatformDelete(platform, uid, post);
            } else if (type === SOCIAL_EVENT_TYPES.POST_LIKE) {
                results[platform] = await handlePlatformLike(platform, uid, post);
            } else if (type === SOCIAL_EVENT_TYPES.POST_UNLIKE) {
                results[platform] = await handlePlatformUnlike(platform, uid, post);
            } else if (type === SOCIAL_EVENT_TYPES.POST_BOOKMARK) {
                results[platform] = await handlePlatformBookmark(platform, uid, post);
            } else if (type === SOCIAL_EVENT_TYPES.POST_UNBOOKMARK) {
                results[platform] = await handlePlatformUnbookmark(platform, uid, post);
            } else {
                results[platform] = { skipped: true, reason: 'unsupported_event' };
            }
        } catch (error) {
            results[`${platform}_error`] = error.message;
            logger.error(`[social-sync] ${platform} failed event=${type} post=${pid} user=${uid}: ${error.message}`);
        }
    }

    await upsertTargetConfig(POST_TARGET_TYPE, pid, 'social.sync.last_event', {
        eventType: type,
        actorUserId: uid,
        results,
        synced_at: new Date().toISOString(),
    });

    return {
        actorUserId: uid,
        postId: pid,
        eventType: type,
        results,
    };
}

export async function syncPostToEnabledPlatforms({ userId, postId, trigger = 'create' }) {
    return syncSocialEvent({
        actorUserId: userId,
        postId,
        eventType: trigger,
    });
}

export async function getSocialIntegrationOverview(userId) {
    const [syncSettings, bindings, twitterAppConfig, twitterSyncTokens, blueskySyncTokens, blueskyPds, blueskyDid] = await Promise.all([
        getUserSocialSyncSettings(userId),
        getOAuthBindingStatus(userId),
        getTwitterSyncAppConfig(userId, { masked: true }),
        getTwitterSyncTokens(userId),
        getBlueskySyncTokens(userId),
        getUserBlueskyPds(userId),
        getUserAtprotoSyncDid(userId),
    ]);

    return {
        bindings,
        sync: syncSettings,
        twitter: {
            hasSyncAppConfig: Boolean(twitterAppConfig),
            hasSyncToken: Boolean(twitterSyncTokens?.access_token),
            appConfig: twitterAppConfig,
        },
        bluesky: {
            pds: blueskyPds,
            did: blueskyDid || null,
            hasSyncToken: Boolean(blueskyDid || blueskySyncTokens?.access_token),
        },
    };
}
