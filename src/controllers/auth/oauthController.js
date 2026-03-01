import logger from "../../services/logger.js";
import {prisma} from "../../services/prisma.js";
import crypto from "crypto";
import memoryCache from "../../services/memoryCache.js";
import {generateAuthUrl, handleOAuthCallback, handleOAuthSyncBind, OAUTH_PROVIDERS,} from "../oauth.js";
import zcconfig from "../../services/config/zcconfig.js";
import {createTemporaryToken} from "../../services/auth/verification.js";

const BLUESKY_SCOPE_LOGIN = 'atproto transition:email';
const BLUESKY_SCOPE_BIND = 'atproto transition:generic transition:email';

function resolveBlueskyScope(flow) {
    return flow === 'bind' ? BLUESKY_SCOPE_BIND : BLUESKY_SCOPE_LOGIN;
}

function getCallbackStateFromAuthUrl(authUrl, fallbackState) {
    try {
        const parsed = new URL(String(authUrl));
        return String(parsed.searchParams.get('state') || fallbackState || '');
    } catch {
        return String(fallbackState || '');
    }
}

/**
 * 获取支持的OAuth提供商列表
 */
export const getOAuthProviders = async (req, res) => {
    const providers = Object.values(OAUTH_PROVIDERS)
        .filter((provider) => provider.enabled) // 只返回已启用的提供商
        .map((provider) => ({
            id: provider.id,
            name: provider.name,
            type: provider.type,
            enabled: provider.enabled
        }));

    res.status(200).json({
        status: "success",
        data: providers,
    });
};

/**
 * 处理OAuth绑定请求
 */
export const bindOAuth = async (req, res) => {
    try {
        const {provider} = req.params;
        const identifier = provider === 'bluesky'
            ? String(req.query?.identifier || req.query?.account || req.query?.domain || req.query?.pds || '').trim()
            : '';
        const blueskyScope = provider === 'bluesky' ? resolveBlueskyScope('bind') : null;
        if (!OAUTH_PROVIDERS[provider]) {
            return res.status(400).json({
                status: "error",
                message: "不支持的 OAuth 提供商",
            });
        }

        const state =
            crypto.randomBytes(16).toString("hex") + `:bind:${res.locals.userid}`;
        const authUrl = await generateAuthUrl(provider, state, {
            ...(identifier ? { identifier } : {}),
            ...(blueskyScope ? { scope: blueskyScope } : {}),
            ...(provider === 'bluesky' ? { flow: 'auth' } : {}),
        });
        const callbackState = provider === 'bluesky'
            ? getCallbackStateFromAuthUrl(authUrl, state)
            : state;

        // 存储 state 与用户 ID 的映射，用于回调时识别绑定操作
        memoryCache.set(
            `oauth_state:${callbackState}`,
            {
                type: 'bind',
                userId: res.locals.userid,
                context: {
                    ...(identifier ? { identifier } : {}),
                    ...(blueskyScope ? { scope: blueskyScope } : {}),
                },
            },
            600
        ); // 10分钟有效期

        res.redirect(authUrl);
    } catch (error) {
        logger.error("OAuth 绑定请求错误:", error);
        if (error?.code === 'ATPROTO_SERVICE_UNAVAILABLE') {
            return res.status(503).json({
                status: "error",
                message: "Bluesky 服务暂时不可达，请稍后重试",
            });
        }
        res.status(500).json({
            status: "error",
            message: "绑定请求失败",
        });
    }
};

/**
 * 处理OAuth登录请求
 */
export const authWithOAuth = async (req, res) => {
    try {
        const {provider} = req.params;
        const tokenPurpose = 'auth';
        const identifier = provider === 'bluesky'
            ? String(req.query?.identifier || req.query?.account || req.query?.domain || req.query?.pds || '').trim()
            : '';
        const blueskyScope = provider === 'bluesky' ? resolveBlueskyScope('login') : null;
        if (!OAUTH_PROVIDERS[provider]) {
            logger.error("不支持的 OAuth 提供商:", provider);
            return res.status(400).json({
                status: "error",
                message: "不支持的 OAuth 提供商",
            });
        }

        const state = crypto.randomBytes(16).toString("hex");
        const authUrl = await generateAuthUrl(provider, state, {
            ...(identifier ? { identifier } : {}),
            ...(blueskyScope ? { scope: blueskyScope } : {}),
            ...(provider === 'bluesky' ? { flow: 'auth' } : {}),
        });
        const callbackState = provider === 'bluesky'
            ? getCallbackStateFromAuthUrl(authUrl, state)
            : state;

        // 存储 state 用于验证回调
        memoryCache.set(
            `oauth_state:${callbackState}`,
            {
                type: 'login',
                context: {
                    tokenPurpose,
                    ...(identifier ? { identifier } : {}),
                    ...(blueskyScope ? { scope: blueskyScope } : {}),
                },
            },
            600
        ); // 10分钟有效期

        res.redirect(authUrl);
    } catch (error) {
        logger.error("OAuth authorization error:", error);
        if (error?.code === 'ATPROTO_SERVICE_UNAVAILABLE') {
            return res.status(503).json({
                status: "error",
                message: "Bluesky 服务暂时不可达，请稍后重试",
            });
        }
        res.status(500).json({
            status: "error",
            message: "授权请求失败",
        });
    }
};

/**
 * 处理OAuth回调
 */
export const handleOAuthCallbackRequest = async (req, res) => {
    const frontendUrl = await zcconfig.get("urls.frontend");

    const redirectTo = (path, message) => {
        const url = message
            ? `${frontendUrl}${path}?message=${encodeURIComponent(message)}`
            : `${frontendUrl}${path}`;
        return res.redirect(url);
    };

    try {
        const {provider} = req.params;
        const {code, state, error, error_description: errorDescription} = req.query;

        logger.debug(`[oauthController] 接收OAuth回调: provider=${provider}, code=${code?.substring(0, 10)}...`);

        if (!state) {
            logger.warn('[oauthController] 无效的OAuth回调请求: 缺少state');
            return redirectTo('/app/account/oauth/login/error', '无效的请求参数');
        }

        if (error) {
            const reason = String(errorDescription || error || 'OAuth授权失败');
            const syncState = provider === 'bluesky' ? memoryCache.get(`bluesky_sync_state:${state}`) : null;
            const cachedStateForError = memoryCache.get(`oauth_state:${state}`);

            if (syncState) {
                memoryCache.delete(`bluesky_sync_state:${state}`);
                logger.warn(`[oauthController] Bluesky同步授权被拒绝: ${reason}`);
                return redirectTo('/app/account/social/sync/bluesky/error', reason);
            }

            if (cachedStateForError) {
                memoryCache.delete(`oauth_state:${state}`);
                const path = cachedStateForError.type === 'bind'
                    ? '/app/account/oauth/bind/error'
                    : '/app/account/oauth/login/error';
                logger.warn(`[oauthController] OAuth授权被拒绝: provider=${provider}, type=${cachedStateForError.type}, reason=${reason}`);
                return redirectTo(path, reason);
            }

            logger.warn(`[oauthController] OAuth授权被拒绝且state未命中缓存: provider=${provider}, state=${state}, reason=${reason}`);
            return redirectTo('/app/account/oauth/login/error', reason);
        }

        if (!code) {
            logger.warn('[oauthController] 无效的OAuth回调请求: 缺少code');
            return redirectTo('/app/account/oauth/login/error', '无效的请求参数');
        }

        const cachedState = memoryCache.get(`oauth_state:${state}`);

        // 检查是否为 Bluesky 同步授权回调（独立 state key，与登录/绑定隔离）
        if (!cachedState && provider === 'bluesky') {
            const syncState = memoryCache.get(`bluesky_sync_state:${state}`);
            if (syncState) {
                const userIdToSync = syncState.userId;
                logger.info(`[oauthController] 处理Bluesky同步令牌回调: userId=${userIdToSync}`);
                memoryCache.delete(`bluesky_sync_state:${state}`);

                try {
                    const syncResult = await handleOAuthSyncBind(provider, code, userIdToSync, {
                        identifier: syncState.identifier || syncState.pds || '',
                        state: String(state),
                        iss: req.query?.iss,
                        callbackQuery: req.query,
                        scope: syncState.scope,
                    });

                    if (syncResult.success) {
                        logger.info(`[oauthController] Bluesky同步令牌绑定成功: userId=${userIdToSync}`);
                        return redirectTo('/app/account/social/sync/bluesky/success');
                    } else {
                        logger.warn(`[oauthController] Bluesky同步令牌绑定失败: ${syncResult.message}`);
                        return redirectTo('/app/account/social/sync/bluesky/error', syncResult.message);
                    }
                } catch (error) {
                    logger.error(`[oauthController] Bluesky同步令牌绑定异常:`, error);
                    return redirectTo('/app/account/social/sync/bluesky/error', 'Bluesky同步绑定失败: ' + error.message);
                }
            }
        }

        if (!cachedState) {
            logger.warn(`[oauthController] state验证失败: state=${state}`);
            return redirectTo('/app/account/oauth/login/error', '无效的state');
        }

        // 根据 state 的类型处理不同的逻辑
        if (cachedState.type === "bind") {
            // ---- 身份绑定（创建/更新 oauth 联系方式，保存 auth 令牌）----
            const userIdToBind = cachedState.userId;
            logger.info(`[oauthController] 处理OAuth身份绑定回调: provider=${provider}, userId=${userIdToBind}`);
            memoryCache.delete(`oauth_state:${state}`);

            try {
                const bindingResult = await handleOAuthCallback(
                    provider,
                    code,
                    userIdToBind,
                    {
                        ...(cachedState?.context || {}),
                        state: String(state),
                        iss: req.query?.iss,
                        callbackQuery: req.query,
                    }
                );

                if (bindingResult.success) {
                    logger.info(`[oauthController] OAuth身份绑定成功: provider=${provider}, userId=${userIdToBind}`);
                    return redirectTo('/app/account/oauth/bind/success');
                } else {
                    logger.warn(`[oauthController] OAuth身份绑定失败: ${bindingResult.message}`);
                    return redirectTo('/app/account/oauth/bind/error', bindingResult.message);
                }
            } catch (error) {
                logger.error(`[oauthController] OAuth身份绑定过程发生异常:`, error);
                return redirectTo('/app/account/oauth/bind/error', 'OAuth绑定失败: ' + error.message);
            }
        } else {
            // 登录/注册操作
            logger.info(`[oauthController] 处理OAuth登录/注册回调: provider=${provider}`);
            memoryCache.delete(`oauth_state:${state}`);

            try {
                const callbackResult = await handleOAuthCallback(
                    provider,
                    code,
                    null,
                    {
                        ...(cachedState?.context || {}),
                        state: String(state),
                        iss: req.query?.iss,
                        callbackQuery: req.query,
                    }
                );

                if (callbackResult && callbackResult.user && callbackResult.contact) {
                    const {user, contact} = callbackResult;

                    // contact 已经是主邮箱联系方式（由 handleOAuthCallback 返回）
                    const email = contact.contact_type === 'email' ? contact.contact_value : null;

                    // 准备要存储的用户数据
                    const userData = {
                        userid: parseInt(user.id),
                        username: user.username,
                        display_name: user.display_name,
                        avatar: user.avatar,
                        email: email
                    };

                    // 创建临时令牌，用途为oauth_login
                    let tempToken;
                    try {
                        const tokenResult = await createTemporaryToken(user.id, 'oauth_login', {userData});
                        if (!tokenResult.success) {
                            logger.error(`[oauthController] 创建临时令牌失败: ${tokenResult.message}`);
                            return redirectTo('/app/account/oauth/login/error', '创建会话令牌失败');
                        }
                        tempToken = tokenResult.token;
                    } catch (tokenError) {
                        logger.error(`[oauthController] 创建临时令牌异常:`, tokenError);
                        return redirectTo('/app/account/oauth/login/error', '会话创建失败');
                    }

                    logger.info(`[oauthController] OAuth登录/注册成功: userId=${user.id}, username=${user.username}, provider=${provider}`);

                    // 重定向到前端，并传递临时令牌
                    return res.redirect(
                        `${frontendUrl}/app/account/oauth/callback?temp_token=${tempToken}`
                    );
                } else {
                    logger.error(`[oauthController] OAuth回调结果无效:`, callbackResult);
                    return redirectTo('/app/account/oauth/login/error', '登录失败: 无效的OAuth响应');
                }
            } catch (error) {
                logger.error(`[oauthController] OAuth登录/注册过程发生异常:`, error);
                const errorMsg = error.message || '登录失败';
                return redirectTo('/app/account/oauth/login/error', 'OAuth登录失败: ' + errorMsg);
            }
        }
    } catch (error) {
        logger.error("[oauthController] OAuth 回调处理发生未预期的错误:", error);
        logger.error(`[oauthController] 错误堆栈: ${error.stack}`);
        try {
            return res.redirect(
                `${frontendUrl}/app/account/oauth/login/error?message=${encodeURIComponent('系统错误: OAuth处理失败')}`
            );
        } catch (redirectError) {
            res.status(500).json({
                status: "error",
                message: "OAuth处理失败"
            });
        }
    }
};

/**
 * 获取用户绑定的OAuth账号
 */
export const getBoundOAuthAccounts = async (req, res) => {
    try {
        const userId = res.locals.userid;

        // 查找用户的所有 OAuth 联系方式
        const oauthContacts = await prisma.ow_users_contacts.findMany({
            where: {
                user_id: userId,
                contact_type: {
                    in: [
                        "oauth_google",
                        "oauth_microsoft",
                        "oauth_github",
                        "oauth_linuxdo",
                        "oauth_40code",
                        "oauth_twitter",
                        "oauth_bluesky",
                    ], // 只查找 OAuth 联系方式
                },
            },
            select: {
                contact_id: true,
                contact_type: true,
                is_primary: true,
                verified: true,
                created_at: true,
                updated_at: true,
                metadata: true,
            },
        });

        return res.status(200).json({
            status: "success",
            data: oauthContacts,
        });
    } catch (error) {
        logger.error("获取绑定的 OAuth 账号时出错:", error);
        return res.status(500).json({
            status: "error",
            message: "获取绑定的 OAuth 账号失败",
        });
    }
};

/**
 * 解绑OAuth账号
 */
export const unlinkOAuth = async (req, res) => {
    try {
        const {provider} = req.body;

        if (!provider) {
            return res.status(200).json({
                status: "error",
                message: "OAuth 提供商是必需的",
            });
        }

        // 查找 OAuth 联系方式
        const contact = await prisma.ow_users_contacts.findFirst({
            where: {
                user_id: res.locals.userid,
                contact_type: provider,
            },
        });

        if (!contact) {
            return res.status(200).json({
                status: "error",
                message: "未找到此 OAuth 联系方式",
            });
        }

        // 删除 OAuth 联系方式
        await prisma.ow_users_contacts.delete({
            where: {contact_id: contact.contact_id},
        });

        return res.status(200).json({
            status: "success",
            message: "成功解绑 OAuth 账号",
        });
    } catch (error) {
        logger.error("解绑 OAuth 账号时出错:", error);
        return res.status(200).json({
            status: "error",
            message: error.message || "解绑失败",
        });
    }
};