import {prisma} from "../services/prisma.js";
import logger from '../services/logger.js';
import zcconfig from "../services/config/zcconfig.js";
import crypto from 'crypto';
import { Agent } from '@atproto/api';
import {
    consumeAtprotoAuthCallback,
    createAtprotoAuthAuthorizeUrl,
    saveUserAtprotoAuthDid,
} from '../services/social/atprotoAuthOAuth.js';

import base32Encode from 'base32-encode';
import {fetchWithProxy} from '../services/proxy/proxyManager.js';

const USER_TARGET_TYPE = 'user';

function createPkcePair() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

function base64urlEncode(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
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

function createDpopKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const publicJwk = publicKey.export({ format: 'jwk' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    return { publicJwk, privateKeyPem };
}

function normalizeUrlForDpop(url) {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
}

function buildDpopProof({ method, url, privateKeyPem, publicJwk, nonce }) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        jti: crypto.randomUUID(),
        htm: String(method || 'POST').toUpperCase(),
        htu: normalizeUrlForDpop(url),
        iat: now,
        exp: now + 60,
        ...(nonce ? { nonce } : {}),
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

function getHeaderValue(headers, name) {
    if (!headers) return null;
    const lower = name.toLowerCase();
    return headers[name] || headers[lower] || null;
}

function isBlueskyClientId(value) {
    const clientId = String(value || '').trim();
    return clientId.startsWith('https://') || clientId.startsWith('did:');
}

function normalizeUrlBase(input, fallback = null) {
    const raw = typeof input === 'string' ? input.trim() : '';
    const finalInput = raw || fallback;
    if (!finalInput) {
        throw new Error('缺少有效URL配置');
    }
    const parsed = new URL(finalInput);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

function buildDidWebDocumentUrl(did) {
    const methodSpecific = String(did || '').slice('did:web:'.length);
    const segments = methodSpecific
        .split(':')
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .filter(Boolean);

    const host = segments[0];
    if (!host) return null;

    if (segments.length === 1) {
        return `https://${host}/.well-known/did.json`;
    }

    return `https://${host}/${segments.slice(1).join('/')}/did.json`;
}

function pickPdsFromDidDocument(document) {
    const services = Array.isArray(document?.service) ? document.service : [];
    for (const service of services) {
        const types = Array.isArray(service?.type) ? service.type : [service?.type];
        const isAtprotoPds = types.some(
            (item) => String(item || '').toLowerCase() === 'atprotopersonaldataserver'
        );
        const serviceId = String(service?.id || '').toLowerCase();
        const isLegacyPdsId = serviceId.endsWith('#atproto_pds');

        if (!isAtprotoPds && !isLegacyPdsId) continue;

        const endpoint = typeof service?.serviceEndpoint === 'string'
            ? service.serviceEndpoint
            : service?.serviceEndpoint?.uri;
        if (!endpoint) continue;

        try {
            return normalizeUrlBase(endpoint);
        } catch {
            // ignore invalid endpoint and continue
        }
    }
    return null;
}

async function resolveBlueskyPdsByDid(did) {
    const normalizedDid = String(did || '').trim();
    if (!normalizedDid.startsWith('did:')) return null;

    let didDocumentUrl = null;
    if (normalizedDid.startsWith('did:plc:')) {
        didDocumentUrl = `https://plc.directory/${normalizedDid}`;
    } else if (normalizedDid.startsWith('did:web:')) {
        didDocumentUrl = buildDidWebDocumentUrl(normalizedDid);
    }

    if (!didDocumentUrl) return null;

    const response = await fetchWithProxy(didDocumentUrl, {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`resolve did document failed (${response.status})`);
    }

    const didDocument = await response.json();
    return pickPdsFromDidDocument(didDocument);
}

function safeExpiresAt(tokenData) {
    const expiresIn = Number(tokenData?.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
        return null;
    }
    return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function formatOAuthError(error) {
    if (!error) return 'unknown error';
    const messages = [];

    if (error.message) {
        messages.push(error.message);
    }

    if (Array.isArray(error?.errors)) {
        for (const inner of error.errors) {
            if (inner?.message) {
                messages.push(inner.message);
            }
        }
    }

    const code = error?.code ? String(error.code) : '';
    if (code) {
        messages.push(`code=${code}`);
    }

    const deduped = [...new Set(messages.filter(Boolean))];
    return deduped.join(' | ') || 'unknown error';
}

async function saveOAuthTokens(userId, provider, tokenData, extra = {}) {
    if (!userId || !provider || !tokenData?.access_token) return;

    const requestedPurpose = extra?.tokenPurpose === 'sync' ? 'sync' : 'auth';
    const tokenPurpose = provider === 'bluesky' ? 'sync' : requestedPurpose;
    const storageKey = `social.${provider}.${tokenPurpose}.tokens`;

    let existingPayload = null;
    try {
        const existing = await prisma.ow_target_configs.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: USER_TARGET_TYPE,
                    target_id: String(userId),
                    key: storageKey,
                },
            },
            select: { value: true },
        });
        existingPayload = existing?.value ? JSON.parse(existing.value) : null;
    } catch (error) {
        logger.warn(`[oauth] 读取旧令牌配置失败，将按新值覆盖: provider=${provider}, purpose=${tokenPurpose}, userId=${userId}, err=${error.message}`);
    }

    const normalizedExtra = Object.fromEntries(
        Object.entries(extra || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    const payload = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || existingPayload?.refresh_token || null,
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
        expires_in: tokenData.expires_in || null,
        expires_at: safeExpiresAt(tokenData),
        updated_at: new Date().toISOString(),
        ...normalizedExtra,
    };

    if (provider === 'bluesky') {
        payload.provider_user_id = payload.provider_user_id || existingPayload?.provider_user_id || existingPayload?.did || null;
        payload.provider_username = payload.provider_username || existingPayload?.provider_username || null;
        payload.pds = payload.pds || existingPayload?.pds || null;
        payload.did = payload.did || payload.provider_user_id || existingPayload?.did || null;
    }

    delete payload.tokenPurpose;

    await prisma.ow_target_configs.upsert({
        where: {
            target_type_target_id_key: {
                target_type: USER_TARGET_TYPE,
                target_id: String(userId),
                key: storageKey,
            },
        },
        update: {
            value: JSON.stringify(payload),
        },
        create: {
            target_type: USER_TARGET_TYPE,
            target_id: String(userId),
            key: storageKey,
            value: JSON.stringify(payload),
        },
    });
}

// Generate a Base32 hash for TOTP
const generateContactHash = () => {
    // 生成16字节的随机数据
    const buffer = crypto.randomBytes(16);
    // 使用 base32-encode 库将随机字节转换为 Base32 格式
    return base32Encode(buffer, 'RFC4648', {padding: false});
};
// OAuth 提供商基础配置
export const OAUTH_PROVIDERS = {
    google: {
        id: 'google',
        name: 'Google',
        type: 'oauth_google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scope: 'openid email profile',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: (data) => ({ id: data.sub, email: data.email, name: data.name })
    },
    microsoft: {
        id: 'microsoft',
        name: 'Microsoft',
        type: 'oauth_microsoft',
        authUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scope: 'openid email profile User.Read',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: (data) => ({ id: data.id, email: data.mail || data.userPrincipalName, name: data.displayName })
    },
    github: {
        id: 'github',
        name: 'GitHub',
        type: 'oauth_github',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: null // GitHub needs special handling (parallel user + emails requests)
    },
    "40code": {
        id: '40code',
        name: '40Code',
        type: 'oauth_40code',
        authUrl: 'https://www.40code.com/#page=oauth_authorize',
        tokenUrl: 'https://api.abc.520gxx.com/oauth/token',
        refreshUrl: 'https://api.abc.520gxx.com/oauth/refresh',
        userInfoUrl: 'https://api.abc.520gxx.com/oauth/user',
        scope: 'basic',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: (data) => ({ id: data.id.toString(), email: data.email, name: data.nickname })
    },
    linuxdo: {
        id: 'linuxdo',
        name: 'Linux.do',
        type: 'oauth_linuxdo',
        authUrl: 'https://connect.linux.do/oauth2/authorize',
        tokenUrl: 'https://connect.linux.do/oauth2/token',
        userInfoUrl: 'https://connect.linux.do/api/user',
        scope: '',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: (data) => ({ id: data.id.toString(), email: data.email, name: data.name || data.username })
    },
    twitter: {
        id: 'twitter',
        name: 'Twitter',
        type: 'oauth_twitter',
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        userInfoUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
        scope: 'tweet.read users.read offline.access',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        mapUserInfo: (data) => {
            const user = data?.data || {};
            return {
                id: user.id,
                email: null,
                name: user.name || user.username,
                username: user.username,
                avatar: user.profile_image_url || null,
            };
        },
    },
    bluesky: {
        id: 'bluesky',
        name: 'Bluesky',
        type: 'oauth_bluesky',
        authUrl: 'https://bsky.social/oauth/authorize',
        tokenUrl: 'https://bsky.social/oauth/token',
        userInfoUrl: 'https://bsky.social/xrpc/com.atproto.server.getSession',
        scope: 'atproto',
        enabled: false,
        clientId: null,
        clientSecret: null,
        redirectUri: null,
        defaultPds: 'https://bsky.social',
        mapUserInfo: (data) => ({
            id: data.did || data.handle,
            email: data.email || null,
            name: data.handle || data.did,
            handle: data.handle || null,
            did: data.did || null,
        }),
    }
};

// 初始化 OAuth 配置
export async function initializeOAuthProviders() {
    try {
        // 从数据库读取所有 OAuth 相关配置
        for (const provider of Object.values(OAUTH_PROVIDERS)) {
            const enabled = await zcconfig.get(`oauth.${provider.id}.enabled`);
            const clientId = await zcconfig.get(`oauth.${provider.id}.client_id`);
            const clientSecret = await zcconfig.get(`oauth.${provider.id}.client_secret`);
            const baseUrl = await zcconfig.get('urls.backend');
            provider.enabled = enabled;
            provider.clientId = clientId;
            provider.clientSecret = clientSecret;
            provider.redirectUri = `${baseUrl}/account/oauth/${provider.id}/callback`;

            if (provider.id === 'bluesky') {
                const defaultPds = await zcconfig.get('oauth.bluesky.default_pds');
                provider.defaultPds = defaultPds || provider.defaultPds;
                provider.clientId = `${baseUrl}/account/oauth/bluesky/client-metadata.json`;
            }

            logger.debug(`OAuth 提供商 ${provider.name} 加载完成, 启用状态: ${provider.enabled}`);
        }
    } catch (error) {
        logger.error('[oauth] 初始化OAuth提供商失败:', error);
    }
}

function getBlueskyEndpoints(config, options = {}) {
    const pds = normalizeUrlBase(options.pds, config.defaultPds || 'https://bsky.social');
    return {
        pds,
        authUrl: `${pds}/oauth/authorize`,
        tokenUrl: `${pds}/oauth/token`,
        userInfoUrl: `${pds}/xrpc/com.atproto.server.getSession`,
    };
}

// 生成 OAuth 授权 URL
export async function generateAuthUrl(provider, state, options = {}) {
    const config = OAUTH_PROVIDERS[provider];
    if (!config) throw new Error('[oauth] 不支持的 OAuth 提供商');
    if (!config.enabled) throw new Error('[oauth] 此 OAuth 提供商未启用');

    const isBluesky = provider === 'bluesky';
    const authUrl = config.authUrl;

    if (isBluesky) {
        const identifier = options?.identifier || options?.account || options?.domain || options?.pds || '';
        return createAtprotoAuthAuthorizeUrl({
            loginHint: identifier,
            state,
            scope: options?.scope || config.scope || 'atproto',
        });
    }

    if (provider === '40code') {
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scope,
            state: state
        });
        return `${authUrl}&${params.toString()}`;
    }

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: options?.scope || config.scope,
        state: state
    });

    return `${authUrl}?${params.toString()}`;
}

// 获取 OAuth 访问令牌
async function getAccessToken(provider, code, options = {}) {
    if (provider === 'bluesky') {
        throw new Error('Bluesky OAuth 已切换为官方 @atproto/oauth-client-node，请使用 atproto 回调消费流程');
    }

    const config = OAUTH_PROVIDERS[provider];
    const tokenUrl = config.tokenUrl;
    const effectiveClientId = String(config.clientId || '');

    const params = new URLSearchParams();
    params.set('client_id', effectiveClientId);
    params.set('code', code);
    params.set('redirect_uri', options?.redirectUri || config.redirectUri);
    params.set('grant_type', 'authorization_code');

    params.set('client_secret', config.clientSecret);

    try {
        const requestHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const response = await fetchWithProxy(tokenUrl, {
            method: 'POST',
            headers: requestHeaders,
            body: params.toString()
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        return await response.json();
    } catch (error) {
        logger.error(`[oauth] 获取${provider}访问令牌失败: ${formatOAuthError(error)}`, error);
        throw error;
    }
}

// 获取 GitHub 用户信息（需要并行请求 user + emails）
async function getGitHubUserInfo(accessToken) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
    };

    const [userResponse, emailsResponse] = await Promise.all([
        fetchWithProxy(OAUTH_PROVIDERS.github.userInfoUrl, { headers }),
        fetchWithProxy('https://api.github.com/user/emails', { headers })
    ]);

    if (!userResponse.ok) {
        const text = await userResponse.text();
        throw new Error(`GitHub user API HTTP ${userResponse.status}: ${text}`);
    }
    if (!emailsResponse.ok) {
        const text = await emailsResponse.text();
        throw new Error(`GitHub emails API HTTP ${emailsResponse.status}: ${text}`);
    }

    const userData = await userResponse.json();
    const emailsData = await emailsResponse.json();
    const primaryEmail = emailsData.find(email => email.primary)?.email || emailsData[0]?.email;

    return {
        id: userData.id.toString(),
        email: primaryEmail,
        name: userData.name || userData.login
    };
}

// 通过 DPoP 调用 Bluesky getSession 端点，尝试获取邮箱等用户信息
async function getBlueskyUserInfoFromApi(accessToken, userInfoUrl, options = {}) {
    const makeHeaders = (nonce) => {
        const h = { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };
        if (options?.dpopPrivateKeyPem && options?.dpopPublicJwk) {
            h.DPoP = buildDpopProof({
                method: 'GET',
                url: userInfoUrl,
                privateKeyPem: options.dpopPrivateKeyPem,
                publicJwk: options.dpopPublicJwk,
                ...(nonce ? { nonce } : {}),
            });
        }
        return h;
    };

    let response = await fetchWithProxy(userInfoUrl, { headers: makeHeaders() });

    // DPoP nonce 重试
    if (!response.ok && options?.dpopPrivateKeyPem) {
        const nonce = getHeaderValue(response.headers, 'dpop-nonce');
        if (nonce) {
            response = await fetchWithProxy(userInfoUrl, { headers: makeHeaders(nonce) });
        }
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Bluesky getSession HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    return {
        id: data.did || data.handle,
        email: data.email || null,
        name: data.handle || data.did,
        handle: data.handle || null,
        did: data.did || null,
    };
}

// 通用获取用户信息函数
async function getUserInfo(provider, accessToken, options = {}, tokenData = null) {
    if (provider === 'bluesky') {
        throw new Error('Bluesky 用户信息获取已切换为官方 @atproto/api + @atproto/oauth-client-node');
    }

    const config = OAUTH_PROVIDERS[provider];
    const userInfoUrl = config.userInfoUrl;

    // GitHub 需要特殊处理
    if (!config.mapUserInfo) {
        return getGitHubUserInfo(accessToken);
    }

    try {
        const response = await fetchWithProxy(userInfoUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        return config.mapUserInfo(data);
    } catch (error) {
        logger.error(`[oauth] 获取${provider}用户信息失败:`, error);
        throw error;
    }
}

// 生成唯一用户名
async function generateUniqueUsername(baseName) {
    // 清理用户名，只保留字母数字和下划线
    const cleanName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    let username = cleanName;
    let counter = 1;

    // 检查用户名是否已存在，如果存在则添加数字
    while (true) {
        const existingUser = await prisma.ow_users.findUnique({
            where: {username}
        });

        if (!existingUser) break;
        username = `${cleanName}_${counter++}`;
    }

    return username;
}

export async function handleOAuthCallback(provider, code, userIdToBind = null, options = {}) {
    logger.info(`[oauth] handleOAuthCallback: ${provider}, code: ${code.substring(0, 10)}..., userIdToBind: ${userIdToBind}`);
    try {
        const tokenPurpose = options?.tokenPurpose === 'sync' ? 'sync' : 'auth';

        // 获取访问令牌与用户信息
        let tokenData;
        let userInfo;

        if (provider === 'bluesky') {
            const callbackQuery = options?.callbackQuery || {
                code,
                state: options?.state,
                ...(options?.iss ? { iss: options.iss } : {}),
            };

            const { session } = await consumeAtprotoAuthCallback(callbackQuery);

            const did = String(session?.did || '').trim();
            if (!did) {
                throw new Error('Bluesky OAuth 回调未返回有效 DID');
            }

            let profile = null;
            try {
                const agent = new Agent(session);
                const profileResp = await agent.getProfile({ actor: did });
                profile = profileResp?.data || null;
            } catch (error) {
                logger.warn(`[oauth] 读取Bluesky资料失败，将使用DID回退: ${error.message}`);
            }

            tokenData = {
                access_token: `atproto:${did}`,
                scope: options?.scope || OAUTH_PROVIDERS.bluesky.scope,
                sub: did,
            };

            userInfo = {
                id: did,
                email: null,
                name: profile?.displayName || profile?.handle || did,
                handle: profile?.handle || null,
                did,
            };
        } else {
            try {
                tokenData = await getAccessToken(provider, code, options);
            } catch (error) {
                const detail = formatOAuthError(error);
                logger.error(`[oauth] 获取${provider}的访问令牌失败: ${detail}`);
                throw new Error(`获取${provider}访问令牌失败: ${detail}`);
            }

            if (!tokenData.access_token) {
                logger.error(`[oauth] ${provider}未返回access_token`, tokenData);
                throw new Error(`${provider}未返回有效的访问令牌`);
            }

            const accessToken = tokenData.access_token;
            try {
                userInfo = await getUserInfo(provider, accessToken, options, tokenData);
            } catch (error) {
                logger.error(`[oauth] 获取${provider}用户信息失败:`, error.message);
                throw new Error(`获取${provider}用户信息失败: ${error.message}`);
            }
        }

        if (!userInfo || !userInfo.id) {
            logger.error(`[oauth] 无法获取${provider}用户ID`, userInfo);
            throw new Error(`无法获取${provider}的有效用户信息`);
        }

        logger.debug(`[oauth] ${provider}用户信息:`, {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name
        });

        if (userIdToBind) {
            // 绑定操作
            logger.info(`[oauth] 处理OAuth绑定操作: provider=${provider}, targetUserId=${userIdToBind}`);

            const user = await prisma.ow_users.findUnique({
                where: {id: userIdToBind}
            });

            if (!user) {
                logger.error(`[oauth] 绑定目标用户不存在: ${userIdToBind}`);
                return {success: false, message: "[oauth] 绑定的用户不存在"};
            }

            // 检查该 OAuth 账号是否已被其他用户绑定
            const existingOAuthContact = await prisma.ow_users_contacts.findFirst({
                where: {
                    contact_value: userInfo.id,
                    contact_type: "oauth_" + provider
                }
            });

            const existingUserProviderContact = await prisma.ow_users_contacts.findFirst({
                where: {
                    user_id: user.id,
                    contact_type: "oauth_" + provider,
                }
            });

            if (existingOAuthContact && existingOAuthContact.user_id !== userIdToBind) {
                logger.warn(`[oauth] OAuth账号已被其他用户绑定: provider=${provider}, oauthId=${userInfo.id}, existingUserId=${existingOAuthContact.user_id}`);
                return {success: false, message: "[oauth] 该OAuth账号已被其他用户绑定"};
            }

            // 绑定 OAuth 账号到指定用户
            try {
                if (existingUserProviderContact && existingUserProviderContact.contact_value !== userInfo.id) {
                    await prisma.ow_users_contacts.update({
                        where: { contact_id: existingUserProviderContact.contact_id },
                        data: {
                            contact_value: userInfo.id,
                            contact_info: generateContactHash(),
                            verified: true,
                            metadata: userInfo,
                            updated_at: new Date(),
                        },
                    });
                    logger.info(`[oauth] 重绑OAuth账号并覆盖联系方式: userId=${user.id}, provider=${provider}, oauthId=${userInfo.id}`);
                } else if (!existingUserProviderContact && !existingOAuthContact) {
                    await prisma.ow_users_contacts.create({
                        data: {
                            user_id: user.id,
                            contact_value: userInfo.id,
                            contact_info: generateContactHash(),
                            contact_type: "oauth_" + provider,
                            verified: true,
                            metadata: userInfo
                        }
                    });
                    logger.info(`[oauth] 成功绑定OAuth账号: userId=${user.id}, provider=${provider}`);
                } else {
                    await prisma.ow_users_contacts.update({
                        where: { contact_id: (existingUserProviderContact || existingOAuthContact).contact_id },
                        data: {
                            verified: true,
                            metadata: userInfo,
                            updated_at: new Date(),
                        },
                    });
                    logger.info(`[oauth] OAuth账号已存在，刷新绑定信息: userId=${user.id}, provider=${provider}`);
                }

                await saveOAuthTokens(user.id, provider, tokenData, {
                    tokenPurpose: provider === 'bluesky' ? 'sync' : tokenPurpose,
                    provider_user_id: userInfo.id,
                    provider_username: userInfo.username || userInfo.handle || null,
                    pds: options?.pds || null,
                });

                if (provider === 'bluesky' && userInfo?.did) {
                    await saveUserAtprotoAuthDid(user.id, userInfo.did);
                }
            } catch (error) {
                logger.error(`[oauth] 绑定OAuth账号失败:`, error);
                return {success: false, message: "[oauth] 绑定OAuth账号失败: " + error.message};
            }

            // 添加邮箱联系方式（如果邮箱不存在）
            if (userInfo.email) {
                try {
                    const emailContact = await prisma.ow_users_contacts.findFirst({
                        where: {
                            user_id: user.id,
                            contact_value: userInfo.email,
                            contact_type: 'email'
                        }
                    });

                    if (!emailContact) {
                        await prisma.ow_users_contacts.create({
                            data: {
                                user_id: user.id,
                                contact_value: userInfo.email,
                                contact_info: generateContactHash(),
                                contact_type: 'email',
                                is_primary: false,
                                verified: false
                            }
                        });
                        logger.debug(`[oauth] 为绑定用户添加邮箱: userId=${user.id}, email=${userInfo.email}`);
                    }
                } catch (error) {
                    logger.warn(`[oauth] 添加邮箱联系方式失败（不中断绑定操作）:`, error);
                }
            }

            return {success: true, message: "OAuth账号绑定成功"};
        } else {
            // 登录/注册操作
            logger.info(`[oauth] 处理OAuth登录/注册: provider=${provider}, oauthId=${userInfo.id}, email=${userInfo.email}`);

            let contact = await prisma.ow_users_contacts.findFirst({
                where: {
                    contact_value: userInfo.id,
                    contact_type: "oauth_" + provider
                }
            });

            if (!contact) {
                logger.debug(`[oauth] OAuth账号未绑定，开始注册/关联用户: provider=${provider}, email=${userInfo.email}`);

                let userId;

                if (userInfo.email) {
                    // 有邮箱时：先查是否已有同邮箱用户
                    const emailContact = await prisma.ow_users_contacts.findFirst({
                        where: {
                            contact_value: userInfo.email,
                            contact_type: 'email'
                        }
                    });

                    if (emailContact) {
                        // 邮箱已存在，关联该用户
                        userId = emailContact.user_id;
                        logger.info(`[oauth] OAuth邮箱已关联现有用户: userId=${userId}, provider=${provider}`);
                    } else {
                        // 创建新用户（有邮箱）
                        logger.info(`[oauth] 创建新用户(有邮箱): provider=${provider}`);
                        const username = await generateUniqueUsername(userInfo.name || 'user');
                        try {
                            const newUser = await prisma.ow_users.create({
                                data: {
                                    username,
                                    password: null,
                                    display_name: userInfo.name || username,
                                    type: 'user',
                                    regTime: new Date(),
                                    createdAt: new Date()
                                }
                            });
                            userId = newUser.id;
                            logger.info(`[oauth] 成功创建新用户: userId=${userId}, username=${username}, provider=${provider}`);
                        } catch (error) {
                            logger.error(`[oauth] 创建新用户失败:`, error);
                            throw new Error(`创建新用户失败: ${error.message}`);
                        }

                        // 创建 email 联系方式
                        try {
                            await prisma.ow_users_contacts.create({
                                data: {
                                    user_id: userId,
                                    contact_value: userInfo.email,
                                    contact_info: generateContactHash(),
                                    contact_type: 'email',
                                    is_primary: true,
                                    verified: true
                                }
                            });
                            logger.debug(`[oauth] 为新用户添加邮箱: userId=${userId}, email=${userInfo.email}`);
                        } catch (error) {
                            logger.error(`[oauth] 为新用户添加邮箱失败，尝试删除用户:`, error);
                            try {
                                await prisma.ow_users.delete({ where: { id: userId } });
                                logger.info(`[oauth] 已删除创建失败的用户: userId=${userId}`);
                            } catch (deleteError) {
                                logger.error(`[oauth] 删除用户失败:`, deleteError);
                            }
                            throw new Error(`添加用户邮箱失败: ${error.message}`);
                        }
                    }
                } else {
                    // 无邮箱（如 Bluesky 未开放邮箱）：直接创建新用户，不添加邮箱联系方式
                    logger.info(`[oauth] 创建新用户(无邮箱): provider=${provider}, oauthId=${userInfo.id}`);
                    const baseName = userInfo.handle || userInfo.name || 'user';
                    const username = await generateUniqueUsername(baseName);
                    try {
                        const newUser = await prisma.ow_users.create({
                            data: {
                                username,
                                password: null,
                                display_name: userInfo.name || username,
                                type: 'user',
                                regTime: new Date(),
                                createdAt: new Date()
                            }
                        });
                        userId = newUser.id;
                        logger.info(`[oauth] 成功创建无邮箱新用户: userId=${userId}, username=${username}, provider=${provider}`);
                    } catch (error) {
                        logger.error(`[oauth] 创建无邮箱新用户失败:`, error);
                        throw new Error(`创建新用户失败: ${error.message}`);
                    }
                }

                // 创建 OAuth 联系方式
                try {
                    contact = await prisma.ow_users_contacts.create({
                        data: {
                            user_id: userId,
                            contact_value: userInfo.id,
                            contact_info: generateContactHash(),
                            contact_type: "oauth_" + provider,
                            verified: true,
                            metadata: userInfo
                        }
                    });
                    logger.info(`[oauth] 成功创建OAuth联系方式: userId=${userId}, provider=${provider}`);
                } catch (error) {
                    logger.error(`[oauth] 创建OAuth联系方式失败:`, error);
                    throw new Error(`创建OAuth联系方式失败: ${error.message}`);
                }
            }

            // 获取用户信息
            const user = await prisma.ow_users.findUnique({
                where: {id: contact.user_id}
            });

            if (!user) {
                logger.error(`[oauth] 用户不存在: userId=${contact.user_id}`);
                throw new Error('[oauth] 用户不存在');
            }

            // 获取用户主邮箱
            const primaryEmail = await prisma.ow_users_contacts.findFirst({
                where: {
                    user_id: user.id,
                    contact_type: 'email',
                    is_primary: true
                }
            });

            logger.info(`[oauth] OAuth登录成功: userId=${user.id}, username=${user.username}, provider=${provider}`);
            logger.debug(`[oauth] OAuth登录流程跳过令牌持久化: userId=${user.id}, provider=${provider}`);

            return {
                user,
                contact: primaryEmail || contact  // 优先返回主邮箱联系方式
            };
        }
    } catch (error) {
        logger.error('[oauth] OAuth callback 发生错误:', error);
        throw error;
    }
}

/**
 * 仅获取访问令牌并以 sync 用途保存，不创建/修改任何 oauth 联系方式记录。
 * 专用于帖文同步（Bluesky/Twitter sync）的授权绑定流程。
 */
export async function handleOAuthSyncBind(provider, code, userId, options = {}) {
    logger.info(`[oauth] handleOAuthSyncBind: ${provider}, userId: ${userId}`);
    try {
        if (provider === 'bluesky') {
            return {
                success: false,
                message: 'Bluesky 同步OAuth已迁移到 /social/bluesky/sync/* 专用流程',
            };
        }

        let tokenData;
        try {
            tokenData = await getAccessToken(provider, code, options);
        } catch (error) {
            const detail = formatOAuthError(error);
            logger.error(`[oauth] 获取${provider}的访问令牌失败(sync): ${detail}`);
            throw new Error(`获取${provider}访问令牌失败: ${detail}`);
        }

        if (!tokenData.access_token) {
            throw new Error(`${provider}未返回有效的访问令牌`);
        }

        let userInfo = null;
        try {
            userInfo = await getUserInfo(provider, tokenData.access_token, options, tokenData);
        } catch (error) {
            logger.warn(`[oauth] 获取${provider}用户信息失败(sync)，令牌仍将保存: ${error.message}`);
        }

        let resolvedPds = options?.pds || null;
        if (provider === 'bluesky') {
            const did = String(userInfo?.did || userInfo?.id || tokenData?.sub || '').trim();
            if (did) {
                try {
                    const didResolvedPds = await resolveBlueskyPdsByDid(did);
                    if (didResolvedPds) {
                        resolvedPds = didResolvedPds;
                        logger.info(`[oauth] Bluesky DID解析PDS成功: did=${did}, pds=${didResolvedPds}`);
                    } else {
                        logger.warn(`[oauth] Bluesky DID未解析到PDS，回退配置值: did=${did}`);
                    }
                } catch (error) {
                    logger.warn(`[oauth] Bluesky DID解析PDS失败，回退配置值: did=${did}, err=${error.message}`);
                }
            }
        }

        await saveOAuthTokens(userId, provider, tokenData, {
            tokenPurpose: 'sync',
            provider_user_id: userInfo?.id || null,
            provider_username: userInfo?.username || userInfo?.handle || null,
            pds: resolvedPds,
            dpopPrivateKeyPem: options?.dpopPrivateKeyPem || null,
            dpopPublicJwk: options?.dpopPublicJwk || null,
        });

        logger.info(`[oauth] Sync令牌保存成功: userId=${userId}, provider=${provider}`);
        return { success: true };
    } catch (error) {
        logger.error('[oauth] handleOAuthSyncBind 发生错误:', error);
        return { success: false, message: error.message };
    }
}

export { createPkcePair };