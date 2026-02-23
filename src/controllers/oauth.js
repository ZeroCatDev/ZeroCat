import {prisma} from "../services/prisma.js";
import logger from '../services/logger.js';
import zcconfig from "../services/config/zcconfig.js";
import crypto from 'crypto';

import base32Encode from 'base32-encode';
import {fetchWithProxy, isOAuthProxyEnabled} from '../services/proxy/proxyManager.js';

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
        redirectUri: null
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
        redirectUri: null
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
        redirectUri: null
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
        redirectUri: null
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
        redirectUri: null
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

            logger.debug(`OAuth 提供商 ${provider.name} 加载完成, 启用状态: ${provider.enabled}`);
        }
    } catch (error) {
        logger.error('[oauth] 初始化OAuth提供商失败:', error);
    }
}

// 生成 OAuth 授权 URL
export async function generateAuthUrl(provider, state) {
    const config = OAUTH_PROVIDERS[provider];
    if (!config) throw new Error('[oauth] 不支持的 OAuth 提供商');
    if (!config.enabled) throw new Error('[oauth] 此 OAuth 提供商未启用');

    if (provider === '40code') {
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: config.scope,
            state: state
        });
        return `${config.authUrl}&${params.toString()}`;
    }

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state: state
    });

    return `${config.authUrl}?${params.toString()}`;
}

// 获取 OAuth 访问令牌
async function getAccessToken(provider, code) {
    const config = OAUTH_PROVIDERS[provider];
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
    });

    try {
        const useProxy = await isOAuthProxyEnabled();
        const response = await fetchWithProxy(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
            useProxy: useProxy
        });

        return await response.json();
    } catch (error) {
        logger.error(`[oauth] 获取${provider}访问令牌失败:`, error);
        throw error;
    }
}

// 获取用户信息的函数映射
const getUserInfoFunctions = {
    google: async (accessToken) => {
        try {
            const useProxy = await isOAuthProxyEnabled();
            const response = await fetchWithProxy(OAUTH_PROVIDERS.google.userInfoUrl, {
                headers: {'Authorization': `Bearer ${accessToken}`},
                useProxy: useProxy
            });
            const data = await response.json();
            return {
                id: data.sub,
                email: data.email,
                name: data.name
            };
        } catch (error) {
            logger.error('[oauth] 获取Google用户信息失败:', error);
            throw error;
        }
    },

    microsoft: async (accessToken) => {
        try {
            const useProxy = await isOAuthProxyEnabled();
            const response = await fetchWithProxy(OAUTH_PROVIDERS.microsoft.userInfoUrl, {
                headers: {'Authorization': `Bearer ${accessToken}`},
                useProxy: useProxy
            });
            const data = await response.json();
            return {
                id: data.id,
                email: data.mail || data.userPrincipalName,
                name: data.displayName
            };
        } catch (error) {
            logger.error('[oauth] 获取Microsoft用户信息失败:', error);
            throw error;
        }
    },

    github: async (accessToken) => {
        try {
            const useProxy = await isOAuthProxyEnabled();
            const [userResponse, emailsResponse] = await Promise.all([
                fetchWithProxy(OAUTH_PROVIDERS.github.userInfoUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    useProxy: useProxy
                }),
                fetchWithProxy('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    useProxy: useProxy
                })
            ]);

            const userData = await userResponse.json();
            const emailsData = await emailsResponse.json();
            const primaryEmail = emailsData.find(email => email.primary)?.email || emailsData[0]?.email;

            return {
                id: userData.id.toString(),
                email: primaryEmail,
                name: userData.name || userData.login
            };
        } catch (error) {
            logger.error('[oauth] 获取GitHub用户信息失败:', error);
            throw error;
        }
    },

    "40code": async (accessToken) => {
        try {
            const useProxy = await isOAuthProxyEnabled();
            const response = await fetchWithProxy(OAUTH_PROVIDERS["40code"].userInfoUrl, {
                headers: {'Authorization': `Bearer ${accessToken}`},
                useProxy: useProxy
            });
            const data = await response.json();
            return {
                id: data.id.toString(),
                email: data.email,
                name: data.nickname,
            };
        } catch (error) {
            logger.error('[oauth] 获取40code用户信息失败:', error);
            throw error;
        }
    },

    linuxdo: async (accessToken) => {
        try {
            const useProxy = await isOAuthProxyEnabled();
            const response = await fetchWithProxy(OAUTH_PROVIDERS.linuxdo.userInfoUrl, {
                headers: {'Authorization': `Bearer ${accessToken}`},
                useProxy: useProxy
            });
            const data = await response.json();
            return {
                id: data.id.toString(),
                email: data.email,
                name: data.name || data.username
            };
        } catch (error) {
            logger.error('[oauth] 获取Linux.do用户信息失败:', error);
            throw error;
        }
    }
};

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

export async function handleOAuthCallback(provider, code, userIdToBind = null) {
    logger.info(`[oauth] handleOAuthCallback: ${provider}, code: ${code.substring(0, 10)}..., userIdToBind: ${userIdToBind}`);
    try {
        // 获取访问令牌
        let tokenData;
        try {
            tokenData = await getAccessToken(provider, code);
        } catch (error) {
            logger.error(`[oauth] 获取${provider}的访问令牌失败:`, error.message);
            throw new Error(`获取${provider}访问令牌失败: ${error.message}`);
        }

        if (!tokenData.access_token) {
            logger.error(`[oauth] ${provider}未返回access_token`, tokenData);
            throw new Error(`${provider}未返回有效的访问令牌`);
        }

        const accessToken = tokenData.access_token;

        // 获取用户信息
        let userInfo;
        try {
            userInfo = await getUserInfoFunctions[provider](accessToken);
        } catch (error) {
            logger.error(`[oauth] 获取${provider}用户信息失败:`, error.message);
            throw new Error(`获取${provider}用户信息失败: ${error.message}`);
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

            if (existingOAuthContact && existingOAuthContact.user_id !== userIdToBind) {
                logger.warn(`[oauth] OAuth账号已被其他用户绑定: provider=${provider}, oauthId=${userInfo.id}, existingUserId=${existingOAuthContact.user_id}`);
                return {success: false, message: "[oauth] 该OAuth账号已被其他用户绑定"};
            }

            // 绑定 OAuth 账号到指定用户
            try {
                if (!existingOAuthContact) {
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
                logger.debug(`[oauth] OAuth账号未绑定，检查邮箱是否存在...`);

                // 检查邮箱是否已与其他用户关联
                const emailContact = await prisma.ow_users_contacts.findFirst({
                    where: {
                        contact_value: userInfo.email,
                        contact_type: 'email'
                    }
                });

                let userId;
                if (emailContact) {
                    // 邮箱已存在，关联该用户
                    userId = emailContact.user_id;
                    logger.info(`[oauth] OAuth邮箱已关联现有用户: userId=${userId}, provider=${provider}`);
                } else {
                    // 创建新用户
                    logger.info(`[oauth] 创建新用户: provider=${provider}`);
                    const username = await generateUniqueUsername(userInfo.name || 'user');

                    try {
                        const newUser = await prisma.ow_users.create({
                            data: {
                                username: username,
                                password: null,  // OAuth 用户不需要密码
                                display_name: userInfo.name || username,
                                type: 'user',  // 设置为普通用户
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
                        // 尝试删除刚创建的用户
                        logger.error(`[oauth] 为新用户添加邮箱失败，尝试删除用户:`, error);
                        try {
                            await prisma.ow_users.delete({
                                where: {id: userId}
                            });
                            logger.info(`[oauth] 已删除创建失败的用户: userId=${userId}`);
                        } catch (deleteError) {
                            logger.error(`[oauth] 删除用户失败:`, deleteError);
                        }
                        throw new Error(`添加用户邮箱失败: ${error.message}`);
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