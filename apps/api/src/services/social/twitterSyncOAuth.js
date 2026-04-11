import crypto from 'crypto';
import { Client as TwitterClient, auth } from 'twitter-api-sdk';
import memoryCache from '../memoryCache.js';
import logger from '../logger.js';

const REQUIRED_SYNC_SCOPES = [
    'tweet.read',
    'tweet.write',
    'tweet.moderate.write',
    'users.read',
    'follows.read',
    'follows.write',
    'offline.access',
    'space.read',
    'mute.read',
    'mute.write',
    'like.read',
    'like.write',
    'list.read',
    'list.write',
    'block.read',
    'block.write',
    'bookmark.read',
    'bookmark.write',
];
const DEFAULT_SCOPE = REQUIRED_SYNC_SCOPES.join(' ');

function normalizeScopes(scopeInput) {
    const scope = String(scopeInput || DEFAULT_SCOPE).trim();
    const set = new Set(scope.split(/\s+/).filter(Boolean));
    for (const requiredScope of REQUIRED_SYNC_SCOPES) {
        set.add(requiredScope);
    }
    return Array.from(set);
}

function buildTwitterOAuthClient(appConfig) {
    return new auth.OAuth2User({
        client_id: String(appConfig.clientId || '').trim(),
        client_secret: String(appConfig.clientSecret || '').trim(),
        callback: String(appConfig.redirectUri || '').trim(),
        scopes: normalizeScopes(appConfig.scope),
    });
}

function formatTwitterOauthError(error, fallback = 'Twitter OAuth 调用失败') {
    const details = [];
    const push = (value) => {
        const text = String(value ?? '').trim();
        if (text) details.push(text);
    };

    push(error?.data?.detail);
    push(error?.data?.title);
    push(error?.error?.detail);
    push(error?.error?.title);
    if (Array.isArray(error?.error?.errors)) {
        for (const item of error.error.errors) {
            push(item?.detail);
            push(item?.message);
            push(item?.title);
        }
    }
    if (String(error?.message || '').trim().toLowerCase() !== 'error') {
        push(error?.message);
    }

    return details[0] || String(fallback || '').trim() || 'Twitter OAuth 调用失败';
}

async function fetchTwitterMe(oauthClient) {
    const client = new TwitterClient(oauthClient);
    const response = await client.users.findMyUser({
        'user.fields': ['profile_image_url'],
    });
    return response?.data || null;
}

export function createTwitterSyncAuthorizeUrl({ appConfig, userId, state }) {
    const finalState = String(state || crypto.randomBytes(16).toString('hex'));
    const oauthClient = buildTwitterOAuthClient(appConfig);
    const authUrl = oauthClient.generateAuthURL({
        state: finalState,
        code_challenge_method: 's256',
    });

    memoryCache.set(`twitter_sync_oauth:${finalState}`, {
        userId: Number(userId),
        oauthClient,
    }, 600);

    return { authUrl, state: finalState };
}

export async function consumeTwitterSyncCallback({ state, code }) {
    const cacheKey = `twitter_sync_oauth:${String(state || '')}`;
    const context = memoryCache.get(cacheKey);
    if (!context?.oauthClient || !context?.userId) {
        throw new Error('授权状态已失效');
    }

    memoryCache.delete(cacheKey);

    const { token } = await context.oauthClient.requestAccessToken(String(code || ''));
    if (!token?.access_token) {
        throw new Error('Twitter 未返回有效 access_token');
    }

    let profile = null;
    try {
        profile = await fetchTwitterMe(context.oauthClient);
    } catch (error) {
        // profile 拉取失败不应阻断授权完成，否则会导致 token 已拿到却绑定失败。
        logger.warn('[social] twitter sync oauth callback: fetch profile failed:', formatTwitterOauthError(error, '获取 Twitter 账号资料失败'));
    }

    return {
        userId: Number(context.userId),
        tokens: {
            access_token: token.access_token,
            refresh_token: token.refresh_token || null,
            token_type: token.token_type || 'Bearer',
            scope: token.scope || null,
            expires_in: token.expires_at ? Math.max(Math.floor((token.expires_at - Date.now()) / 1000), 0) : null,
        },
        profile: {
            id: profile?.id ? String(profile.id) : null,
            username: profile?.username ? String(profile.username) : null,
            name: profile?.name ? String(profile.name) : null,
            avatar: profile?.profile_image_url ? String(profile.profile_image_url) : null,
        },
    };
}