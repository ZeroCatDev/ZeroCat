import crypto from 'crypto';
import { prisma } from '../prisma.js';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import { fetchWithProxy } from '../proxy/proxyManager.js';

const USER_TARGET_TYPE = 'user';
const POST_TARGET_TYPE = 'post';

export const SOCIAL_KEYS = {
    SYNC_SETTINGS: 'social.sync.settings',
    TWITTER_SYNC_APP: 'social.twitter.sync.app',
    TWITTER_SYNC_TOKENS: 'social.twitter.sync.tokens',
    BLUESKY_SYNC_TOKENS: 'social.bluesky.sync.tokens',
    BLUESKY_PDS: 'social.bluesky.pds',
};

function normalizeUrlBase(input) {
    const raw = typeof input === 'string' ? input.trim() : '';
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

async function getTargetConfig(targetType, targetId, key) {
    const record = await prisma.ow_target_configs.findUnique({
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
    await prisma.ow_target_configs.upsert({
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
    await prisma.ow_target_configs.deleteMany({
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

function base64urlEncode(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function normalizeUrlForDpop(url) {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
}

function buildSignedJwtES256({ header, payload, privateKeyPem }) {
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
        key: privateKeyPem,
        dsaEncoding: 'ieee-p1363',
    });

    return `${signingInput}.${base64urlEncode(signature)}`;
}

function buildAccessTokenHash(accessToken) {
    if (!accessToken) return null;
    const digest = crypto.createHash('sha256').update(String(accessToken)).digest();
    return base64urlEncode(digest);
}

function buildDpopProof({ method, url, privateKeyPem, publicJwk, nonce, accessToken }) {
    const now = Math.floor(Date.now() / 1000);
    const ath = buildAccessTokenHash(accessToken);
    const payload = {
        jti: crypto.randomUUID(),
        htm: String(method || 'POST').toUpperCase(),
        htu: normalizeUrlForDpop(url),
        iat: now,
        exp: now + 60,
        ...(nonce ? { nonce } : {}),
        ...(ath ? { ath } : {}),
    };

    const header = {
        typ: 'dpop+jwt',
        alg: 'ES256',
        jwk: {
            kty: publicJwk.kty,
            crv: publicJwk.crv,
            x: publicJwk.x,
            y: publicJwk.y,
        },
    };

    return buildSignedJwtES256({ header, payload, privateKeyPem });
}

function parseStoredJwk(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return null;
}

function getHeaderValue(headers, name) {
    if (!headers) return null;
    const lower = String(name || '').toLowerCase();
    return headers.get?.(name) || headers.get?.(lower) || null;
}

async function readJsonSafe(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function resolveBlueskyPdsBase(tokens, fallbackPds) {
    return normalizeUrlBase(tokens?.pds || fallbackPds || 'https://bsky.social');
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

async function publishToTwitter(userId, post) {
    const proxyOptions = await getSocialProxyFetchOptions();
    const tokens = await getTwitterSyncTokens(userId);
    if (!tokens?.access_token) {
        throw new Error('未配置 Twitter 同步令牌');
    }

    const text = pickPostText(post);
    if (!text) {
        throw new Error('推文内容为空，无法同步到 Twitter');
    }

    const response = await fetchWithProxy('https://api.twitter.com/2/tweets', {
        method: 'POST',
        ...proxyOptions,
        headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
    });

    const body = await response.json();
    if (!response.ok) {
        throw new Error(body?.detail || body?.title || `Twitter 发布失败 (${response.status})`);
    }

    await upsertTargetConfig(POST_TARGET_TYPE, post.id, 'social.sync.twitter.result', {
        ok: true,
        data: body,
        synced_at: new Date().toISOString(),
    });

    return body;
}

async function publishToBluesky(userId, post) {
    const proxyOptions = await getSocialProxyFetchOptions();
    const tokens = await getBlueskySyncTokens(userId);
    if (!tokens?.access_token) {
        throw new Error('未配置 Bluesky 同步 OAuth 令牌，请使用同步授权重新绑定 Bluesky');
    }

    const dpopPrivateKeyPem = String(tokens?.dpopPrivateKeyPem || '').trim();
    const dpopPublicJwk = parseStoredJwk(tokens?.dpopPublicJwk);
    if (!dpopPrivateKeyPem || !dpopPublicJwk?.kty || !dpopPublicJwk?.x || !dpopPublicJwk?.y) {
        throw new Error('Bluesky 同步令牌缺少 DPoP 绑定密钥，请重新绑定 Bluesky 同步授权');
    }

    const pds = await getUserBlueskyPds(userId);
    const pdsBase = resolveBlueskyPdsBase(tokens, pds);
    const createRecordUrl = `${pdsBase}/xrpc/com.atproto.repo.createRecord`;

    const text = pickPostText(post);
    if (!text) {
        throw new Error('推文内容为空，无法同步到 Bluesky');
    }

    const repo = tokens.provider_user_id || tokens.did;
    if (!repo) {
        throw new Error('缺少 Bluesky repo/did 信息');
    }

    const requestBody = JSON.stringify({
        repo,
        collection: 'app.bsky.feed.post',
        record: {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString(),
        },
    });

    const buildHeaders = (nonce) => ({
        Authorization: `DPoP ${tokens.access_token}`,
        DPoP: buildDpopProof({
            method: 'POST',
            url: createRecordUrl,
            privateKeyPem: dpopPrivateKeyPem,
            publicJwk: dpopPublicJwk,
            accessToken: tokens.access_token,
            ...(nonce ? { nonce } : {}),
        }),
        'Content-Type': 'application/json',
    });

    let response = await fetchWithProxy(createRecordUrl, {
        method: 'POST',
        ...proxyOptions,
        headers: buildHeaders(),
        body: requestBody,
    });

    if (!response.ok) {
        const nonce = getHeaderValue(response.headers, 'dpop-nonce');
        if (nonce) {
            response = await fetchWithProxy(createRecordUrl, {
                method: 'POST',
                ...proxyOptions,
                headers: buildHeaders(nonce),
                body: requestBody,
            });
        }
    }

    const body = await readJsonSafe(response);

    if (!response.ok) {
        const errMsg = body?.message || body?.error || `Bluesky 发布失败 (${response.status})`;
        // scope 不足时给出明确提示
        if (response.status === 401 && String(errMsg).toLowerCase().includes('token scope')) {
            throw new Error('Bluesky 令牌权限不足（Bad token scope），请重新绑定 Bluesky 账号以获取写入权限');
        }
        throw new Error(errMsg);
    }

    await upsertTargetConfig(POST_TARGET_TYPE, post.id, 'social.sync.bluesky.result', {
        ok: true,
        data: body,
        synced_at: new Date().toISOString(),
    });

    return body;
}

export async function syncPostToEnabledPlatforms({ userId, postId }) {
    logger.info(`[social-sync] start userId=${userId} postId=${postId}`);

    const post = await prisma.ow_posts.findUnique({
        where: { id: Number(postId) },
        select: {
            id: true,
            author_id: true,
            post_type: true,
            content: true,
            is_deleted: true,
        },
    });

    if (!post || post.is_deleted) {
        logger.warn(`[social-sync] skip userId=${userId} postId=${postId} reason=post_not_found_or_deleted`);
        return { skipped: true, reason: 'post_not_found_or_deleted' };
    }

    if (Number(post.author_id) !== Number(userId)) {
        logger.warn(`[social-sync] skip userId=${userId} postId=${postId} reason=not_author authorId=${post.author_id}`);
        return { skipped: true, reason: 'not_author' };
    }

    if (!['normal', 'reply', 'quote'].includes(post.post_type)) {
        logger.warn(`[social-sync] skip userId=${userId} postId=${postId} reason=unsupported_post_type post_type=${post.post_type}`);
        return { skipped: true, reason: 'unsupported_post_type' };
    }

    const settings = await getUserSocialSyncSettings(userId);
    logger.debug(`[social-sync] sync settings userId=${userId} twitter=${settings.twitter} bluesky=${settings.bluesky}`);

    const results = {};
    let enabledCount = 0;

    if (settings.twitter) {
        enabledCount += 1;
        logger.info(`[social-sync] publishing to Twitter userId=${userId} postId=${postId}`);
        try {
            results.twitter = await publishToTwitter(userId, post);
            logger.info(`[social-sync] Twitter ok userId=${userId} postId=${postId}`);
        } catch (error) {
            results.twitter_error = error.message;
            logger.error(`[social-sync] Twitter failed userId=${userId} postId=${postId}: ${error.message}`);
        }
    }

    if (settings.bluesky) {
        enabledCount += 1;
        logger.info(`[social-sync] publishing to Bluesky userId=${userId} postId=${postId}`);
        try {
            results.bluesky = await publishToBluesky(userId, post);
            logger.info(`[social-sync] Bluesky ok userId=${userId} postId=${postId}`);
        } catch (error) {
            results.bluesky_error = error.message;
            logger.error(`[social-sync] Bluesky failed userId=${userId} postId=${postId}: ${error.message}`);
        }
    }

    if (enabledCount === 0) {
        logger.info(`[social-sync] skip userId=${userId} postId=${postId} reason=sync_disabled`);
        return { skipped: true, reason: 'sync_disabled' };
    }

    if (!results.twitter && !results.bluesky) {
        logger.error(`[social-sync] all platforms failed userId=${userId} postId=${postId} details=${JSON.stringify(results)}`);
        const err = new Error('所有平台同步失败');
        err.details = results;
        throw err;
    }

    logger.info(`[social-sync] done userId=${userId} postId=${postId} platforms=${Object.keys(results).filter(k => !k.endsWith('_error')).join(',')}`);
    return {
        postId: post.id,
        userId,
        results,
    };
}

export async function getSocialIntegrationOverview(userId) {
    const [syncSettings, bindings, twitterAppConfig, twitterSyncTokens, blueskySyncTokens, blueskyPds] = await Promise.all([
        getUserSocialSyncSettings(userId),
        getOAuthBindingStatus(userId),
        getTwitterSyncAppConfig(userId, { masked: true }),
        getTwitterSyncTokens(userId),
        getBlueskySyncTokens(userId),
        getUserBlueskyPds(userId),
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
            hasSyncToken: Boolean(blueskySyncTokens?.access_token),
        },
    };
}
