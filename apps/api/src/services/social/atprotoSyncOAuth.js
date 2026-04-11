import { Agent } from '@atproto/api';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { prisma } from '../prisma.js';
import zcconfig from '../config/zcconfig.js';
import memoryCache from '../memoryCache.js';
import { fetchWithProxy } from '../proxy/proxyManager.js';

const OAUTH_SESSION_TARGET_TYPE = 'atproto_sync_session';
const USER_TARGET_TYPE = 'user';
const SYNC_DID_KEY = 'social.atproto.sync.did';

function getTargetConfigModel() {
    return prisma.ow_target_configs || prisma.c;
}

function normalizeBaseUrl(url) {
    const parsed = new URL(String(url || '').trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

function normalizeIdentifier(input, fallback = 'https://bsky.app') {
    const value = String(input || '').trim() || String(fallback || '').trim() || 'https://bsky.app';
    if (value.startsWith('did:')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return normalizeBaseUrl(value);
    if (value.toLowerCase() === 'bsky.social' || value.toLowerCase() === 'bsky.app') return 'https://bsky.app';
    return value;
}

function tryBskyEntrywayFallback(identifier) {
    const value = String(identifier || '').trim().toLowerCase();
    if (value === 'https://bsky.social' || value === 'bsky.social') return 'https://bsky.app';
    return identifier;
}

async function atprotoFetch(input, init = {}) {
    const requestInput = input instanceof Request ? input : String(input);
    try {
        return await fetch(requestInput, init);
    } catch (error) {
        const proxyEnabled = await zcconfig.get('oauth.proxy.enabled', false);
        if (!proxyEnabled) throw error;

        const url = requestInput instanceof Request ? requestInput.url : String(requestInput);
        const raw = await fetchWithProxy(url, { ...init, useProxy: true });
        const text = typeof raw?.text === 'function' ? await raw.text() : '';
        return new Response(text, {
            status: Number(raw?.status || 500),
            headers: new Headers(raw?.headers || {}),
        });
    }
}

function createStateStore() {
    const prefix = 'atproto_oauth_state:sync:';
    return {
        async set(key, value) {
            memoryCache.set(`${prefix}${key}`, value, 3600);
        },
        async get(key) {
            return memoryCache.get(`${prefix}${key}`) || undefined;
        },
        async del(key) {
            memoryCache.delete(`${prefix}${key}`);
        },
    };
}

export async function getAtprotoSyncAppStateByCallbackState(callbackState) {
    const key = `atproto_oauth_state:sync:${String(callbackState || '')}`;
    const value = memoryCache.get(key);
    if (!value || typeof value !== 'object') return null;
    return String(value.appState || '');
}

function createSessionStore() {
    const key = 'session';
    return {
        async set(sub, value) {
            const targetConfig = getTargetConfigModel();
            await targetConfig.upsert({
                where: {
                    target_type_target_id_key: {
                        target_type: OAUTH_SESSION_TARGET_TYPE,
                        target_id: String(sub),
                        key,
                    },
                },
                update: { value: JSON.stringify(value) },
                create: {
                    target_type: OAUTH_SESSION_TARGET_TYPE,
                    target_id: String(sub),
                    key,
                    value: JSON.stringify(value),
                },
            });
        },
        async get(sub) {
            const targetConfig = getTargetConfigModel();
            const record = await targetConfig.findUnique({
                where: {
                    target_type_target_id_key: {
                        target_type: OAUTH_SESSION_TARGET_TYPE,
                        target_id: String(sub),
                        key,
                    },
                },
                select: { value: true },
            });
            if (!record?.value) return undefined;
            try {
                return JSON.parse(record.value);
            } catch {
                return undefined;
            }
        },
        async del(sub) {
            const targetConfig = getTargetConfigModel();
            await targetConfig.deleteMany({
                where: {
                    target_type: OAUTH_SESSION_TARGET_TYPE,
                    target_id: String(sub),
                    key,
                },
            });
        },
    };
}

export async function buildAtprotoSyncClientMetadata(scope) {
    const backendUrl = await zcconfig.get('urls.backend');
    const frontendUrl = await zcconfig.get('urls.frontend');
    const siteName = await zcconfig.get('site.name');
    const siteEmail = await zcconfig.get('site.email');
    const configuredClientName = await zcconfig.get('oauth.bluesky.client_name');

    const backendBase = normalizeBaseUrl(backendUrl);
    const frontendBase = normalizeBaseUrl(frontendUrl);

    return {
        client_id: `${backendBase}/social/bluesky/sync/client-metadata.json`,
        client_name: configuredClientName || siteName || 'ZeroCat',
        client_uri: backendBase,
        logo_uri: `${backendBase}/favicon.ico`,
        redirect_uris: [`${backendBase}/social/bluesky/sync/oauth/callback`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: true,
        application_type: 'web',
        scope,
        ...(siteEmail ? { contacts: [siteEmail] } : {}),
        tos_uri: `${frontendBase}/app/legal/privacy`,
        policy_uri: `${frontendBase}/app/legal/terms`,
    };
}

async function createSyncClient(scope) {
    const clientMetadata = await buildAtprotoSyncClientMetadata(scope);
    return new NodeOAuthClient({
        clientMetadata,
        stateStore: createStateStore(),
        sessionStore: createSessionStore(),
        fetch: atprotoFetch,
    });
}

export async function createAtprotoSyncAuthorizeUrl({ loginHint, state, scope }) {
    const defaultHint = await zcconfig.get('oauth.bluesky.default_identifier', 'https://bsky.app');
    const identifier = normalizeIdentifier(loginHint, defaultHint);
    const client = await createSyncClient(scope);
    try {
        return await client.authorize(identifier, { state: String(state || '') });
    } catch (error) {
        const fallback = tryBskyEntrywayFallback(identifier);
        if (fallback !== identifier) {
            return client.authorize(fallback, { state: String(state || '') });
        }
        throw error;
    }
}

export async function consumeAtprotoSyncCallback({ callbackQuery, scope }) {
    const client = await createSyncClient(scope);
    const params = new URLSearchParams(callbackQuery || {});
    return client.callback(params);
}

export async function restoreAtprotoSyncAgent({ did, scope }) {
    const client = await createSyncClient(scope);
    const session = await client.restore(String(did || ''));
    return new Agent(session);
}

export async function saveUserAtprotoSyncDid(userId, did) {
    if (!userId || !did) return;
    const targetConfig = getTargetConfigModel();
    await targetConfig.upsert({
        where: {
            target_type_target_id_key: {
                target_type: USER_TARGET_TYPE,
                target_id: String(userId),
                key: SYNC_DID_KEY,
            },
        },
        update: { value: String(did) },
        create: {
            target_type: USER_TARGET_TYPE,
            target_id: String(userId),
            key: SYNC_DID_KEY,
            value: String(did),
        },
    });
}

export async function getUserAtprotoSyncDid(userId) {
    const targetConfig = getTargetConfigModel();
    const record = await targetConfig.findUnique({
        where: {
            target_type_target_id_key: {
                target_type: USER_TARGET_TYPE,
                target_id: String(userId),
                key: SYNC_DID_KEY,
            },
        },
        select: { value: true },
    });
    return record?.value || null;
}
