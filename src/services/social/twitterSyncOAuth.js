import crypto from 'crypto';
import { Client as TwitterClient, auth } from 'twitter-api-sdk';
import memoryCache from '../memoryCache.js';

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

async function fetchTwitterMe(accessToken) {
    const client = new TwitterClient(String(accessToken || ''));
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

    const profile = await fetchTwitterMe(token.access_token);

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