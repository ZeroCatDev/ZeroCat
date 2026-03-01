/**
 * Bluesky / ATProto OAuth 封装
 *
 * 使用 @atproto/oauth-client-node 作为唯一 OAuth 实现：
 *  - 单例 NodeOAuthClient，避免重复初始化与并发竞争
 *  - stateStore  使用内存缓存（TTL 10 min），适用于单进程部署
 *  - sessionStore 使用数据库持久化，保证 access-token 自动刷新
 *  - requestLock  基于 Map 的顺序互斥队列，防止并发撤销凭据
 */

import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { prisma } from '../prisma.js';
import zcconfig from '../config/zcconfig.js';
import memoryCache from '../memoryCache.js';
import logger from '../logger.js';

// ─── 常量 ─────────────────────────────────────────────────────────────────────────────

const OAUTH_SESSION_TARGET_TYPE = 'atproto_auth_session';
const USER_TARGET_TYPE = 'user';
const AUTH_DID_KEY = 'social.atproto.auth.did';

/**
 * client-metadata.json 中声明的最大 scope 集合。
 * 具体 authorize 调用可传入更小的子集（如仅 'atproto transition:email'）。
 */
const CLIENT_METADATA_SCOPE = 'atproto transition:generic transition:email';

function normalizeBaseUrl(url) {
    const parsed = new URL(String(url || '').trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────────────────

/**
 * 将用户输入的 identifier 标准化为合法的 ATProto 入口点或 DID。
 * bsky.app 是 Bluesky 的 Web 前端，不是 PDS，需要映射到 bsky.social。
 */
function normalizeIdentifier(input, fallback = 'https://bsky.social') {
    const value = String(input || '').trim() || String(fallback || '').trim() || 'https://bsky.social';
    if (value.startsWith('did:')) return value;
    const lower = value.toLowerCase().replace(/\/+$/, '');
    if (lower === 'bsky.app' || lower === 'https://bsky.app' || lower === 'http://bsky.app') {
        return 'https://bsky.social';
    }
    if (lower === 'bsky.social' || lower === 'https://bsky.social') {
        return 'https://bsky.social';
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return normalizeBaseUrl(value);
    }
    return value;
}

// ─── fetch ───────────────────────────────────────────────────────────────────────────────

async function atprotoFetch(input, init = {}) {
    return fetch(input instanceof Request ? input : String(input), init);
}

// ─── requestLock ─────────────────────────────────────────────────────────────────────────────

/**
 * 基于 Promise 链的每-key 互斥队列，防止同一 DID 并发刷新 token 导致凭据被撤销。
 */
function createRequestLock() {
    const queue = new Map();
    return async function requestLock(key, fn) {
        const prev = queue.get(key) ?? Promise.resolve();
        let release;
        const barrier = new Promise(resolve => { release = resolve; });
        queue.set(key, prev.then(() => barrier));
        await prev;
        try {
            return await fn();
        } finally {
            release();
        }
    };
}

// ─── stateStore（内存，TTL 10 min） ───────────────────────────────────────────────────────────────────────

function createStateStore() {
    const PREFIX = 'atproto_oauth_state:';
    return {
        async set(key, value) {
            memoryCache.set(`${PREFIX}${key}`, value, 600);
        },
        async get(key) {
            return memoryCache.get(`${PREFIX}${key}`) ?? undefined;
        },
        async del(key) {
            memoryCache.delete(`${PREFIX}${key}`);
        },
    };
}

// ─── sessionStore（数据库持久化） ─────────────────────────────────────────────────────────────────────

function createSessionStore() {
    const SESSION_KEY = 'session';
    return {
        async set(sub, value) {
            await prisma.ow_target_configs.upsert({
                where: {
                    target_type_target_id_key: {
                        target_type: OAUTH_SESSION_TARGET_TYPE,
                        target_id: String(sub),
                        key: SESSION_KEY,
                    },
                },
                update: { value: JSON.stringify(value) },
                create: {
                    target_type: OAUTH_SESSION_TARGET_TYPE,
                    target_id: String(sub),
                    key: SESSION_KEY,
                    value: JSON.stringify(value),
                },
            });
        },
        async get(sub) {
            const record = await prisma.ow_target_configs.findUnique({
                where: {
                    target_type_target_id_key: {
                        target_type: OAUTH_SESSION_TARGET_TYPE,
                        target_id: String(sub),
                        key: SESSION_KEY,
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
            await prisma.ow_target_configs.deleteMany({
                where: {
                    target_type: OAUTH_SESSION_TARGET_TYPE,
                    target_id: String(sub),
                    key: SESSION_KEY,
                },
            });
        },
    };
}

// ─── client-metadata ────────────────────────────────────────────────────────────────────────────

/**
 * 构建暴露给外部（client-metadata.json 端点）的客户端元数据。
 * scope 固定为 CLIENT_METADATA_SCOPE（最大集合），具体 authorize 填写所需子集。
 */
export async function buildAtprotoAuthClientMetadata() {
    const [backendUrl, frontendUrl, siteName, siteEmail, configuredClientName] = await Promise.all([
        zcconfig.get('urls.backend'),
        zcconfig.get('urls.frontend'),
        zcconfig.get('site.name'),
        zcconfig.get('site.email'),
        zcconfig.get('oauth.bluesky.client_name'),
    ]);

    const backendBase = normalizeBaseUrl(backendUrl);
    const frontendBase = normalizeBaseUrl(frontendUrl);

    return {
        client_id: `${backendBase}/account/oauth/bluesky/client-metadata.json`,
        client_name: configuredClientName || siteName || 'ZeroCat',
        client_uri: backendBase,
        logo_uri: `${backendBase}/favicon.ico`,
        redirect_uris: [`${backendBase}/account/oauth/bluesky/callback`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        dpop_bound_access_tokens: true,
        application_type: 'web',
        scope: CLIENT_METADATA_SCOPE,
        ...(siteEmail ? { contacts: [siteEmail] } : {}),
        tos_uri: `${frontendBase}/app/legal/privacy`,
        policy_uri: `${frontendBase}/app/legal/terms`,
    };
}

// ─── 单例 NodeOAuthClient ─────────────────────────────────────────────────────────────────────

let _client = null;
let _initPromise = null;

/**
 * 获取（或懒初始化）全局单例 NodeOAuthClient。
 * 首次调用时从数据库读取配置，后续复用同一实例。
 */
async function getOAuthClient() {
    if (_client) return _client;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const clientMetadata = await buildAtprotoAuthClientMetadata();
            _client = new NodeOAuthClient({
                clientMetadata,
                stateStore: createStateStore(),
                sessionStore: createSessionStore(),
                requestLock: createRequestLock(),
                fetch: atprotoFetch,
            });
            logger.info('[atproto] NodeOAuthClient 单例初始化完成');
            return _client;
        } catch (err) {
            _initPromise = null; // 允许下次重试
            throw err;
        }
    })();

    return _initPromise;
}

/**
 * 在配置变更后（如修改 urls.backend）调用此函数以重建客户端。
 */
export function resetAtprotoOAuthClient() {
    _client = null;
    _initPromise = null;
    logger.info('[atproto] NodeOAuthClient 单例已重置');
}

// ─── 公开 API ────────────────────────────────────────────────────────────────────────────

/**
 * 生成 Bluesky OAuth 授权 URL。
 *
 * @param {object} params
 * @param {string} [params.loginHint]  用户输入的 handle / DID / PDS URL
 * @param {string} params.state        CSRF state 值
 * @param {string} [params.scope]      请求的 scope（不传则使用登录默认 scope）
 * @returns {Promise<string>} 302 重定向目标 URL
 */
export async function createAtprotoAuthAuthorizeUrl({ loginHint, state, scope }) {
    const [client, defaultHint] = await Promise.all([
        getOAuthClient(),
        zcconfig.get('oauth.bluesky.default_identifier', 'https://bsky.social'),
    ]);

    const identifier = normalizeIdentifier(loginHint, defaultHint);
    const authorizeScope = scope || 'atproto transition:email';

    try {
        return await client.authorize(identifier, {
            state: String(state || ''),
            scope: authorizeScope,
        });
    } catch (error) {
        // 指定的 PDS/handle 解析失败时，回退到公共入口 bsky.social
        if (identifier !== 'https://bsky.social') {
            logger.warn(`[atproto] authorize 失败 (identifier=${identifier})，回退到 bsky.social: ${error.message}`);
            return client.authorize('https://bsky.social', {
                state: String(state || ''),
                scope: authorizeScope,
            });
        }
        throw error;
    }
}

/**
 * 消费 Bluesky OAuth 回调，返回 { session, state }。
 * session 可直接传给 new Agent(session) 以调用 ATProto API。
 *
 * @param {URLSearchParams | Record<string, string>} callbackParams  回调查询参数
 * @returns {Promise<{ session: OAuthSession, state?: string }>}
 */
export async function consumeAtprotoAuthCallback(callbackParams) {
    const client = await getOAuthClient();
    const params = callbackParams instanceof URLSearchParams
        ? callbackParams
        : new URLSearchParams(callbackParams || {});
    return client.callback(params);
}

/**
 * 通过 DID 恢复已存在的 ATProto OAuth 会话，返回可直接调用 API 的 Agent。
 * 库会自动处理 access-token 刷新。
 *
 * @param {string} did
 * @returns {Promise<Agent>}
 */
export async function restoreAtprotoAgent(did) {
    const client = await getOAuthClient();
    const session = await client.restore(did);
    return new Agent(session);
}

/**
 * 持久化用户绑定的 ATProto DID（供后续刷新 token 时定位 sessionStore 记录）。
 */
export async function saveUserAtprotoAuthDid(userId, did) {
    if (!userId || !did) return;
    await prisma.ow_target_configs.upsert({
        where: {
            target_type_target_id_key: {
                target_type: USER_TARGET_TYPE,
                target_id: String(userId),
                key: AUTH_DID_KEY,
            },
        },
        update: { value: String(did) },
        create: {
            target_type: USER_TARGET_TYPE,
            target_id: String(userId),
            key: AUTH_DID_KEY,
            value: String(did),
        },
    });
}
