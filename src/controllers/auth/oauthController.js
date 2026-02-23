import logger from "../../services/logger.js";
import {prisma} from "../../services/prisma.js";
import crypto from "crypto";
import memoryCache from "../../services/memoryCache.js";
import {generateAuthUrl, handleOAuthCallback, OAUTH_PROVIDERS,} from "../oauth.js";
import zcconfig from "../../services/config/zcconfig.js";
import {createTemporaryToken} from "../../services/auth/verification.js";

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
        if (!OAUTH_PROVIDERS[provider]) {
            return res.status(400).json({
                status: "error",
                message: "不支持的 OAuth 提供商",
            });
        }

        const state =
            crypto.randomBytes(16).toString("hex") + `:bind:${res.locals.userid}`;
        const authUrl = await generateAuthUrl(provider, state);

        // 存储 state 与用户 ID 的映射，用于回调时识别绑定操作
        memoryCache.set(
            `oauth_state:${state}`,
            {type: "bind", userId: res.locals.userid},
            600
        ); // 10分钟有效期

        res.redirect(authUrl);
    } catch (error) {
        logger.error("OAuth 绑定请求错误:", error);
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
        if (!OAUTH_PROVIDERS[provider]) {
            logger.error("不支持的 OAuth 提供商:", provider);
            return res.status(400).json({
                status: "error",
                message: "不支持的 OAuth 提供商",
            });
        }

        const state = crypto.randomBytes(16).toString("hex");
        const authUrl = await generateAuthUrl(provider, state);

        // 存储 state 用于验证回调
        memoryCache.set(`oauth_state:${state}`, true, 600); // 10分钟有效期

        res.redirect(authUrl);
    } catch (error) {
        logger.error("OAuth authorization error:", error);
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
    try {
        const {provider} = req.params;
        const {code, state} = req.query;

        logger.debug(`[oauthController] 接收OAuth回调: provider=${provider}, code=${code?.substring(0, 10)}...`);

        if (!code || !state) {
            logger.warn(`[oauthController] 无效的OAuth回调请求: 缺少code或state`);
            return res.redirect(
                `${await zcconfig.get(
                    "urls.frontend"
                )}/app/account/oauth/login/error?message=${encodeURIComponent('无效的请求参数')}`
            );
        }

        const cachedState = memoryCache.get(`oauth_state:${state}`);
        if (!cachedState) {
            logger.warn(`[oauthController] state验证失败: state=${state}`);
            return res.redirect(
                `${await zcconfig.get(
                    "urls.frontend"
                )}/app/account/oauth/login/error?message=${encodeURIComponent('无效的state')}`
            );
        }

        // 根据 state 的类型处理不同的逻辑
        if (cachedState.type === "bind") {
            const userIdToBind = cachedState.userId;
            logger.info(`[oauthController] 处理OAuth绑定回调: provider=${provider}, userId=${userIdToBind}`);

            // 清除 state
            memoryCache.delete(`oauth_state:${state}`);

            try {
                const bindingResult = await handleOAuthCallback(
                    provider,
                    code,
                    userIdToBind
                );

                // 处理绑定结果
                if (bindingResult.success) {
                    logger.info(`[oauthController] OAuth绑定成功: provider=${provider}, userId=${userIdToBind}`);
                    return res.redirect(
                        `${await zcconfig.get(
                            "urls.frontend"
                        )}/app/account/oauth/bind/success`
                    );
                } else {
                    logger.warn(`[oauthController] OAuth绑定失败: ${bindingResult.message}`);
                    return res.redirect(
                        `${await zcconfig.get(
                            "urls.frontend"
                        )}/app/account/oauth/bind/error?message=${encodeURIComponent(bindingResult.message)}`
                    );
                }
            } catch (error) {
                logger.error(`[oauthController] OAuth绑定过程发生异常:`, error);
                return res.redirect(
                    `${await zcconfig.get(
                        "urls.frontend"
                    )}/app/account/oauth/bind/error?message=${encodeURIComponent('OAuth绑定失败: ' + error.message)}`
                );
            }
        } else {
            // 登录/注册操作
            logger.info(`[oauthController] 处理OAuth登录/注册回调: provider=${provider}`);
            memoryCache.delete(`oauth_state:${state}`);

            try {
                const callbackResult = await handleOAuthCallback(provider, code);

                if (callbackResult && callbackResult.user && callbackResult.contact) {
                    const {user, contact} = callbackResult;

                    // 查询用户主邮箱
                    const userEmail = await prisma.ow_users_contacts.findFirst({
                        where: {
                            user_id: user.id,
                            contact_type: 'email',
                            is_primary: true
                        }
                    });

                    const email = userEmail ? userEmail.contact_value : null;

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
                            return res.redirect(
                                `${await zcconfig.get(
                                    "urls.frontend"
                                )}/app/account/oauth/login/error?message=${encodeURIComponent('创建会话令牌失败')}`
                            );
                        }
                        tempToken = tokenResult.token;
                    } catch (tokenError) {
                        logger.error(`[oauthController] 创建临时令牌异常:`, tokenError);
                        return res.redirect(
                            `${await zcconfig.get(
                                "urls.frontend"
                            )}/app/account/oauth/login/error?message=${encodeURIComponent('会话创建失败')}`
                        );
                    }

                    logger.info(`[oauthController] OAuth登录/注册成功: userId=${user.id}, username=${user.username}, provider=${provider}`);

                    // 重定向到前端，并传递临时令牌
                    return res.redirect(
                        `${await zcconfig.get(
                            "urls.frontend"
                        )}/app/account/oauth/callback?temp_token=${tempToken}`
                    );
                } else {
                    logger.error(`[oauthController] OAuth回调结果无效:`, callbackResult);
                    return res.redirect(
                        `${await zcconfig.get(
                            "urls.frontend"
                        )}/app/account/oauth/login/error?message=${encodeURIComponent('登录失败: 无效的OAuth响应')}`
                    );
                }
            } catch (error) {
                logger.error(`[oauthController] OAuth登录/注册过程发生异常:`, error);
                const errorMsg = error.message || '登录失败';
                return res.redirect(
                    `${await zcconfig.get(
                        "urls.frontend"
                    )}/app/account/oauth/login/error?message=${encodeURIComponent('OAuth登录失败: ' + errorMsg)}`
                );
            }
        }
    } catch (error) {
        logger.error("[oauthController] OAuth 回调处理发生未预期的错误:", error);
        logger.error(`[oauthController] 错误堆栈: ${error.stack}`);
        try {
            return res.redirect(
                `${await zcconfig.get(
                    "urls.frontend"
                )}/app/account/oauth/login/error?message=${encodeURIComponent('系统错误: OAuth处理失败')}`
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
        const userId = req.body.userid; // 假设用户 ID 存储在请求的用户信息中

        // 查找用户的所有 OAuth 联系方式
        const oauthContacts = await prisma.ow_users_contacts.findMany({
            where: {
                user_id: userId,
                contact_type: {
                    in: ["oauth_google", "oauth_microsoft", "oauth_github", "oauth_linuxdo", "oauth_40code"], // 只查找 OAuth 联系方式
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