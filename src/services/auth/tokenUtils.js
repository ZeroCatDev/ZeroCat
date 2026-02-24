import logger from '../logger.js';
import {prisma} from '../prisma.js';
import jsonwebtoken from 'jsonwebtoken';
import zcconfig from '../config/zcconfig.js';
import crypto from 'crypto';
import {createEvent} from '../../controllers/events.js';
import redisClient from '../redis.js';

/**
 * 生成随机令牌
 * @param {number} length 令牌长度
 * @returns {string} 生成的随机令牌
 */
export function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * 创建JWT令牌
 * @param {object} payload JWT payload
 * @param {null} expiresIn 过期时间（秒）
 * @returns {Promise<string>} 签名后的JWT令牌
 */
export async function createJWT(payload, expiresIn = null) {
    try {
        const jwtSecret = await zcconfig.get("security.jwttoken");

        // 如果提供了过期时间，创建exp字段
        const finalPayload = {...payload};
        if (expiresIn) {
            finalPayload.exp = Math.floor(Date.now() / 1000) + parseInt(expiresIn);
        }

        return jsonwebtoken.sign(finalPayload, jwtSecret);
    } catch (error) {
        logger.error(`创建JWT令牌失败: ${error.message}`);
        throw error;
    }
}

/**
 * 创建访问令牌的JWT
 * @param {object} userInfo 用户信息
 * @param {string} tokenId 令牌ID
 * @param {Date} expiresAt 过期时间
 * @returns {Promise<string>} JWT令牌
 */
export async function createAccessTokenJWT(userInfo, tokenId, expiresAt) {
    try {
        const jwtPayload = {
            ...userInfo,
            token_id: tokenId,
            exp: Math.floor(expiresAt.getTime() / 1000)
        };

        const jwtSecret = await zcconfig.get("security.jwttoken");
        return jsonwebtoken.sign(jwtPayload, jwtSecret);
    } catch (error) {
        logger.error(`创建访问令牌JWT失败: ${error.message}`);
        throw error;
    }
}

/**
 * 创建特定类型的JWT令牌
 * @param {string} type 令牌类型
 * @param {object} data 令牌数据
 * @param {number} expiresIn 过期时间（秒）
 * @returns {Promise<string>} JWT令牌
 */
export async function createTypedJWT(type, data, expiresIn = 300) {
    try {
        const payload = {
            exp: Math.floor(Date.now() / 1000) + expiresIn,
            type,
            data
        };

        const jwtSecret = await zcconfig.get("security.jwttoken");
        return jsonwebtoken.sign(payload, jwtSecret);
    } catch (error) {
        logger.error(`创建${type}类型JWT令牌失败: ${error.message}`);
        throw error;
    }
}

/**
 * 解析设备信息
 * @param {string} userAgent 用户代理字符串
 * @returns {object} 解析后的设备信息
 */
export function parseDeviceInfo(userAgent) {
    if (!userAgent) {
        return {
            browser: 'Unknown',
            os: 'Unknown',
            device: 'Unknown'
        };
    }

    // 简化的用户代理解析
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Unknown';

    // 解析浏览器
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
        browser = 'Edge';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
        browser = 'Internet Explorer';
    }

    // 解析操作系统
    if (userAgent.includes('Windows')) {
        os = 'Windows';
    } else if (userAgent.includes('Macintosh')) {
        os = 'macOS';
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
    } else if (userAgent.includes('Android')) {
        os = 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        os = 'iOS';
    }

    // 解析设备类型
    if (userAgent.includes('Mobile')) {
        device = 'Mobile';
    } else if (userAgent.includes('Tablet')) {
        device = 'Tablet';
    } else {
        device = 'Desktop';
    }

    return {
        browser,
        os,
        device,
        userAgent: userAgent.substring(0, 255) // 截断过长的用户代理字符串
    };
}

/**
 * 为用户创建登录令牌
 * 统一的用户登录令牌生成功能，保留与数据库的交互方式
 *
 * @param {number} userId 用户ID
 * @param {object} userInfo 用户信息对象，包含userid, username, display_name, avatar, email等字段
 * @param {string} ipAddress 用户IP地址
 * @param {string} userAgent 用户代理字符串
 * @param {object} options 其他选项
 * @returns {Promise<object>} 包含令牌信息的对象
 */
export async function createUserLoginTokens(userId, userInfo, ipAddress, userAgent, options = {}) {
    try {
        logger.debug(`开始为用户${userId}创建登录令牌`);

        // 设置访问令牌有效期为15分钟，刷新令牌默认30天
        const accessTokenExpiry = options.accessTokenExpiry || 15 * 60; // 15分钟

        // 获取刷新令牌过期时间配置
        let refreshTokenExpiry;
        try {
            refreshTokenExpiry = parseInt(await zcconfig.get("security.refreshTokenExpiry"), 10);
            if (isNaN(refreshTokenExpiry) || refreshTokenExpiry <= 0) {
                logger.warn(`无效的刷新令牌过期时间配置: ${await zcconfig.get("security.refreshTokenExpiry")}, 使用默认值30天`);
                refreshTokenExpiry = 60 * 60 * 24 * 30; // 默认30天
            }
        } catch (configError) {
            logger.error(`获取令牌过期配置出错: ${configError.message}, 使用默认值30天`);
            refreshTokenExpiry = 60 * 60 * 24 * 30; // 默认30天
        }

        logger.debug(`令牌过期设置: accessTokenExpiry=${accessTokenExpiry}秒, refreshTokenExpiry=${refreshTokenExpiry}秒`);

        // 解析设备信息
        const deviceInfo = userAgent ? parseDeviceInfo(userAgent) : null;
        const deviceInfoJson = deviceInfo ? JSON.stringify(deviceInfo) : null;

        // 生成随机令牌
        const accessToken = generateToken();
        const refreshToken = generateToken(40);

        // 计算过期时间
        const now = Date.now();
        const accessTokenExpiresAt = new Date(now + accessTokenExpiry * 1000);
        const refreshTokenExpiresAt = new Date(now + refreshTokenExpiry * 1000);

        logger.debug(`令牌过期时间: accessTokenExpiresAt=${accessTokenExpiresAt.toISOString()}, refreshTokenExpiresAt=${refreshTokenExpiresAt.toISOString()}`);

        // 存储令牌信息到数据库
        const tokenRecord = await prisma.ow_auth_tokens.create({
            data: {
                user_id: userId,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: accessTokenExpiresAt,
                refresh_expires_at: refreshTokenExpiresAt,
                ip_address: ipAddress,
                user_agent: userAgent?.substring(0, 255) || null,
                device_info: deviceInfoJson,
                created_at: new Date(now),
                last_used_at: new Date(now),
                last_used_ip: ipAddress,
                activity_count: 0
            }
        });

        // 使用统一的JWT创建函数
        const jwt = await createAccessTokenJWT(userInfo, tokenRecord.id, accessTokenExpiresAt);

        // 将刷新令牌存储到Redis
        const refreshTokenKey = `token:refresh:${refreshToken}`;
        await redisClient.set(refreshTokenKey, {
            token_id: tokenRecord.id,
            user_id: userId
        }, refreshTokenExpiry);

        // 将令牌详情存储到Redis
        const tokenDetailsKey = `token:details:${tokenRecord.id}`;
        await redisClient.set(tokenDetailsKey, {
            id: tokenRecord.id,
            user_id: userId,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: accessTokenExpiresAt.getTime(),
            refresh_expires_at: refreshTokenExpiresAt.getTime(),
            ip_address: ipAddress,
            user_agent: userAgent?.substring(0, 255) || null,
            device_info: deviceInfo,
            created_at: now,
            last_used_at: now,
            last_used_ip: ipAddress,
            activity_count: 0,
            revoked: false
        }, refreshTokenExpiry);

        if (options.recordLoginEvent) {
            try {
                await createEvent("user_login", userId, "user", userId, {
                    event_type: "user_login",
                    device_info: deviceInfo,
                    ip_address: ipAddress
                });
                logger.debug(`为用户${userId}创建登录事件成功`);
            } catch (eventError) {
                logger.error(`记录登录事件失败: ${eventError.message}`);
                // 继续执行，不影响登录流程
            }
        }

        // 构建返回对象
        const result = {
            accessToken: jwt,
            refreshToken,
            expiresAt: accessTokenExpiresAt,
            refreshExpiresAt: refreshTokenExpiresAt,
            tokenId: tokenRecord.id,
            success: true
        };

        logger.debug(`创建令牌成功: tokenId=${tokenRecord.id}, userId=${userId}`);
        return result;
    } catch (error) {
        logger.error(`创建登录令牌失败: ${error.message}`);
        logger.error(`错误堆栈: ${error.stack}`);
        return {
            success: false,
            message: "创建登录令牌失败",
            error: error.message
        };
    }
}

/**
 * 检查指定令牌的刷新令牌是否仍然有效
 * @param {string} tokenId 令牌ID
 * @returns {Promise<boolean>} 刷新令牌是否有效
 */
async function checkRefreshTokenValid(tokenId) {
    try {
        // 检查令牌是否在黑名单中（已被显式撤销）
        const blacklistKey = `token:blacklist:${tokenId}`;
        const blacklistData = await redisClient.get(blacklistKey);
        if (blacklistData) return false;

        // 尝试从Redis获取令牌详情
        const tokenKey = `token:details:${tokenId}`;
        const tokenData = await redisClient.get(tokenKey);

        if (tokenData) {
            return !tokenData.revoked && tokenData.refresh_expires_at > Date.now();
        }

        // 回退到数据库查询
        const tokenRecord = await prisma.ow_auth_tokens.findFirst({
            where: {
                id: tokenId,
                revoked: false,
                refresh_expires_at: {gt: new Date()}
            }
        });
        return !!tokenRecord;
    } catch (error) {
        logger.error(`检查刷新令牌有效性时出错: ${error.message}`);
        return false;
    }
}

/**
 * 验证令牌
 * @param {string} token JWT令牌
 * @param {string} ipAddress 用户IP地址
 * @returns {Promise<object>} 验证结果
 */
export async function verifyToken(token, ipAddress) {
    try {
        // 解析JWT
        const jwtSecret = await zcconfig.get("security.jwttoken");
        let decoded;

        try {
            decoded = jsonwebtoken.verify(token, jwtSecret);
        } catch (jwtError) {
            return {
                valid: false,
                message: "无效的令牌"
            };
        }

        const tokenId = decoded.token_id;
        const userId = decoded.userid;

        if (!tokenId || !userId) {
            return {
                valid: false,
                message: "令牌缺少必要信息"
            };
        }

        // 检查令牌是否在黑名单中
        const blacklistKey = `token:blacklist:${tokenId}`;
        const blacklistData = await redisClient.get(blacklistKey);
        if (blacklistData) {
            return {
                valid: false,
                message: "令牌已被吊销",
                reason: blacklistData.reason || "unknown"
            };
        }

        // 从Redis获取令牌详情
        const tokenKey = `token:details:${tokenId}`;
        let tokenData = await redisClient.get(tokenKey);

        // 如果Redis中没有令牌详情，从数据库获取
        if (!tokenData) {
            const tokenRecord = await prisma.ow_auth_tokens.findFirst({
                where: {
                    id: tokenId,
                    revoked: false
                }
            });

            if (!tokenRecord) {
                return {
                    valid: false,
                    message: "令牌不存在或已被撤销"
                };
            }

            if (tokenRecord.expires_at < new Date()) {
                return {
                    valid: false,
                    message: "令牌已过期"
                };
            }

            // 构建令牌数据并缓存到Redis
            tokenData = {
                id: tokenRecord.id,
                user_id: tokenRecord.user_id,
                access_token: tokenRecord.access_token,
                expires_at: tokenRecord.expires_at.getTime(),
                refresh_expires_at: tokenRecord.refresh_expires_at.getTime(),
                created_at: tokenRecord.created_at.getTime(),
                last_used_at: tokenRecord.last_used_at.getTime(),
                last_used_ip: tokenRecord.last_used_ip,
                activity_count: tokenRecord.activity_count,
                revoked: false
            };

            // 计算剩余过期时间
            const refreshExpiry = Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000);
            if (refreshExpiry > 0) {
                await redisClient.set(tokenKey, tokenData, refreshExpiry);
            }
        }

        if (tokenData.revoked) {
            return {
                valid: false,
                message: "令牌已被撤销"
            };
        }

        if (tokenData.user_id !== userId) {
            return {
                valid: false,
                message: "令牌与用户不匹配"
            };
        }

        // 检查访问令牌是否过期
        if (tokenData.expires_at < Date.now()) {
            return {
                valid: false,
                message: "令牌已过期"
            };
        }

        // 异步更新令牌活动记录
        updateTokenActivity(tokenId, ipAddress).catch(err => {
            logger.error(`更新令牌活动记录出错: ${err.message}`);
        });

        return {
            valid: true,
            userId,
            tokenId,
            tokenData,
            user: decoded
        };
    } catch (error) {
        logger.debug(`验证令牌时出错: ${error.message}`);
        return {
            valid: false,
            message: "验证令牌时出错"
        };
    }
}

/**
 * 更新令牌活动记录
 * @param {string} tokenId 令牌ID
 * @param {string} ipAddress 用户IP地址
 * @returns {Promise<boolean>} 是否更新成功
 */
export async function updateTokenActivity(tokenId, ipAddress) {
    try {
        // 从Redis获取令牌详情
        const tokenKey = `token:details:${tokenId}`;
        const tokenData = await redisClient.get(tokenKey);

        // 如果Redis中有令牌详情，更新活动记录
        if (tokenData) {
            tokenData.last_used_at = Date.now();
            tokenData.last_used_ip = ipAddress;
            tokenData.activity_count += 1;

            // 计算剩余过期时间
            const refreshExpiry = Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000);
            if (refreshExpiry > 0) {
                await redisClient.set(tokenKey, tokenData, refreshExpiry);
            }
        }

        // 同时更新数据库记录
        await prisma.ow_auth_tokens.update({
            where: {id: tokenId},
            data: {
                last_used_at: new Date(),
                last_used_ip: ipAddress,
                activity_count: {
                    increment: 1
                }
            },
        });

        return true;
    } catch (error) {
        logger.error(`更新令牌活动记录出错: ${error.message}`);
        return false;
    }
}

/**
 * 撤销单个令牌
 * @param {string} tokenId 令牌ID
 * @param {string} reason 撤销原因
 * @returns {Promise<object>} 撤销结果
 */
export async function revokeToken(tokenId, reason = "user_logout") {
    try {
        // 从数据库获取令牌记录
        const tokenRecord = await prisma.ow_auth_tokens.findUnique({
            where: {id: tokenId}
        });

        if (!tokenRecord) {
            return {
                success: false,
                message: "令牌不存在"
            };
        }

        if (tokenRecord.revoked) {
            return {
                success: true,
                message: "令牌已被撤销"
            };
        }

        // 获取访问令牌过期时间设置
        const accessTokenExpiry = 15 * 60; // 默认15分钟

        // 将令牌ID添加到黑名单（包含撤销原因）
        const blacklistKey = `token:blacklist:${tokenId}`;
        await redisClient.set(blacklistKey, {
            reason,
            revokedAt: Date.now()
        }, accessTokenExpiry);

        // 从Redis中删除令牌详情和刷新令牌
        const tokenKey = `token:details:${tokenId}`;
        await redisClient.delete(tokenKey);

        const refreshTokenKey = `token:refresh:${tokenRecord.refresh_token}`;
        await redisClient.delete(refreshTokenKey);

        // 更新数据库记录
        await prisma.ow_auth_tokens.update({
            where: {id: tokenId},
            data: {
                revoked: true,
                revoked_at: new Date()
            }
        });

        return {
            success: true,
            message: "令牌已成功撤销"
        };
    } catch (error) {
        logger.error(`撤销令牌出错: ${error.message}`);
        return {
            success: false,
            message: "撤销令牌时出错"
        };
    }
}

/**
 * 撤销用户的所有令牌
 * @param {number} userId 用户ID
 * @param {null} excludeTokenId 排除的令牌ID
 * @param {string} reason 撤销原因
 * @returns {Promise<object>} 撤销结果
 */
export async function revokeAllUserTokens(userId, excludeTokenId = null, reason = "user_logout_all") {
    try {
        // 获取用户的所有活跃令牌
        const tokens = await prisma.ow_auth_tokens.findMany({
            where: {
                user_id: userId,
                revoked: false,
                ...(excludeTokenId ? {id: {not: excludeTokenId}} : {})
            }
        });

        // 获取访问令牌过期时间设置
        const accessTokenExpiry = 15 * 60; // 默认15分钟

        // 遍历撤销所有令牌
        let revokedCount = 0;
        for (const token of tokens) {
            // 将令牌ID添加到黑名单
            const blacklistKey = `token:blacklist:${token.id}`;
            await redisClient.set(blacklistKey, {
                reason,
                revokedAt: Date.now()
            }, accessTokenExpiry);

            // 从Redis中删除令牌详情和刷新令牌
            const tokenKey = `token:details:${token.id}`;
            await redisClient.delete(tokenKey);

            const refreshTokenKey = `token:refresh:${token.refresh_token}`;
            await redisClient.delete(refreshTokenKey);

            revokedCount++;
        }

        // 批量更新数据库记录
        await prisma.ow_auth_tokens.updateMany({
            where: {
                user_id: userId,
                revoked: false,
                ...(excludeTokenId ? {id: {not: excludeTokenId}} : {})
            },
            data: {
                revoked: true,
                revoked_at: new Date()
            }
        });

        return {
            success: true,
            message: "已成功撤销所有令牌",
            count: revokedCount
        };
    } catch (error) {
        logger.error(`撤销用户所有令牌出错: ${error.message}`);
        return {
            success: false,
            message: "撤销用户所有令牌时出错"
        };
    }
}

/**
 * 使用刷新令牌生成新的访问令牌
 * @param {string} refreshToken 刷新令牌
 * @param {string} ipAddress 用户IP地址
 * @param {string} userAgent 用户代理字符串
 * @returns {Promise<object>} 刷新结果
 */
export async function refreshAccessToken(refreshToken, ipAddress, userAgent) {
    try {
        // 首先从Redis中查找刷新令牌
        const refreshTokenKey = `token:refresh:${refreshToken}`;
        let refreshData = await redisClient.get(refreshTokenKey);
        let tokenId, userId;

        // 如果Redis中没有刷新令牌数据，从数据库查找
        if (!refreshData) {
            const tokenRecord = await prisma.ow_auth_tokens.findFirst({
                where: {
                    refresh_token: refreshToken,
                    revoked: false,
                    refresh_expires_at: {gt: new Date()}
                }
            });

            if (!tokenRecord) {
                return {
                    success: false,
                    message: "无效的刷新令牌"
                };
            }

            tokenId = tokenRecord.id;
            userId = tokenRecord.user_id;

            // 检查令牌是否在黑名单中
            const blacklistKey = `token:blacklist:${tokenId}`;
            const blacklistData = await redisClient.get(blacklistKey);
            if (blacklistData) {
                return {
                    success: false,
                    message: "令牌已被吊销",
                    reason: blacklistData.reason
                };
            }
        } else {
            tokenId = refreshData.token_id;
            userId = refreshData.user_id;

            // 检查令牌是否在黑名单中
            const blacklistKey = `token:blacklist:${tokenId}`;
            const blacklistData = await redisClient.get(blacklistKey);
            if (blacklistData) {
                return {
                    success: false,
                    message: "令牌已被吊销",
                    reason: blacklistData.reason
                };
            }
        }

        // 获取令牌详情
        const tokenKey = `token:details:${tokenId}`;
        let tokenData = await redisClient.get(tokenKey);

        // 如果Redis中没有令牌详情，从数据库获取
        if (!tokenData) {
            const tokenRecord = await prisma.ow_auth_tokens.findUnique({
                where: {id: tokenId}
            });

            if (!tokenRecord || tokenRecord.revoked) {
                return {
                    success: false,
                    message: "令牌已被撤销"
                };
            }

            if (tokenRecord.refresh_expires_at < new Date()) {
                return {
                    success: false,
                    message: "刷新令牌已过期"
                };
            }

            // 构建令牌数据
            tokenData = {
                id: tokenRecord.id,
                user_id: tokenRecord.user_id,
                access_token: tokenRecord.access_token,
                refresh_token: tokenRecord.refresh_token,
                expires_at: tokenRecord.expires_at.getTime(),
                refresh_expires_at: tokenRecord.refresh_expires_at.getTime(),
                created_at: tokenRecord.created_at.getTime(),
                last_used_at: tokenRecord.last_used_at.getTime(),
                last_used_ip: tokenRecord.last_used_ip,
                activity_count: tokenRecord.activity_count,
                revoked: false
            };
        } else if (tokenData.refresh_expires_at < Date.now()) {
            return {
                success: false,
                message: "刷新令牌已过期"
            };
        }

        // 生成新的访问令牌
        const accessTokenExpiry = await zcconfig.get("security.accessTokenExpiry") || 15 * 60; // 15分钟
        const newAccessToken = generateToken();
        const accessTokenExpiresAt = new Date(Date.now() + accessTokenExpiry * 1000);

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: {id: userId}
        });

        if (!user) {
            return {
                success: false,
                message: "用户不存在"
            };
        }

        // 获取用户主要邮箱
        const primaryEmail = await prisma.ow_users_contacts.findFirst({
            where: {
                user_id: userId,
                contact_type: "email",
                is_primary: true
            }
        });

        // 构建用户信息对象
        const userInfo = {
            userid: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar: user.avatar,
            email: primaryEmail?.contact_value
        };

        // 使用统一的JWT创建函数
        const jwt = await createAccessTokenJWT(userInfo, tokenId, accessTokenExpiresAt);

        // 更新数据库
        await prisma.ow_auth_tokens.update({
            where: {id: tokenId},
            data: {
                access_token: newAccessToken,
                expires_at: accessTokenExpiresAt,
                last_used_at: new Date(),
                last_used_ip: ipAddress,
                activity_count: {
                    increment: 1
                }
            }
        });

        // 更新Redis中的令牌详情
        tokenData.access_token = newAccessToken;
        tokenData.expires_at = accessTokenExpiresAt.getTime();
        tokenData.last_used_at = Date.now();
        tokenData.last_used_ip = ipAddress;
        tokenData.activity_count += 1;

        // 计算剩余过期时间
        const refreshExpiry = Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000);
        if (refreshExpiry > 0) {
            await redisClient.set(tokenKey, tokenData, refreshExpiry);
        }

        logger.debug(`刷新令牌成功: 用户=${userId}, 新令牌=${newAccessToken.substring(0, 8)}...`);

        return {
            success: true,
            accessToken: jwt,
            expiresAt: accessTokenExpiresAt,
            refreshExpiresAt: new Date(tokenData.refresh_expires_at)
        };
    } catch (error) {
        logger.error(`刷新令牌时出错: ${error.message}`);
        logger.error(`错误堆栈: ${error.stack}`);
        return {
            success: false,
            message: "刷新令牌时出错"
        };
    }
}

/**
 * 获取并标准化用户信息，用于创建令牌
 * @param {object} user 用户对象
 * @param {null} email 用户邮箱
 * @returns {object} 标准化的用户信息
 */
export async function getUserInfoForToken(user, email = null) {
    try {
        // 如果未提供邮箱，尝试获取用户的主要邮箱
        if (!email) {
            // 获取用户的主要邮箱联系方式
            const primaryEmail = await prisma.ow_users_contacts.findFirst({
                where: {
                    user_id: user.id,
                    contact_type: "email",
                    is_primary: true,
                }
            });

            // 如果没有主要邮箱，获取任何已验证的邮箱
            const verifiedEmail = !primaryEmail
                ? await prisma.ow_users_contacts.findFirst({
                    where: {
                        user_id: user.id,
                        contact_type: "email",
                        verified: true,
                    }
                })
                : null;

            email = primaryEmail?.contact_value || verifiedEmail?.contact_value || null;
        }

        return {
            userid: parseInt(user.id),
            username: user.username,
            display_name: user.display_name,
            avatar: user.avatar,
            email: email
        };
    } catch (error) {
        logger.error(`获取用户标准信息失败: ${error.message}`);
        // 返回基础信息，忽略邮箱
        return {
            userid: parseInt(user.id),
            username: user.username,
            display_name: user.display_name || user.username,
            avatar: user.avatar
        };
    }
}

/**
 * 设置 refresh token cookie
 * @param {object} res Express response 对象
 * @param {string} refreshToken 刷新令牌
 * @param {Date} refreshExpiresAt 刷新令牌过期时间
 */
export function setRefreshTokenCookie(res, refreshToken, refreshExpiresAt) {
    const maxAge = new Date(refreshExpiresAt).getTime() - Date.now();
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/account',
        maxAge: Math.max(0, maxAge),
    });
}

/**
 * 清除 refresh token cookie
 * @param {object} res Express response 对象
 */
export function clearRefreshTokenCookie(res) {
    res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/account',
    });
}

/**
 * 生成登录响应对象
 * @param {object} user 用户对象
 * @param {object} tokenResult 令牌结果
 * @param {string} email 用户邮箱
 * @param {object} additionalData 附加数据
 * @returns {object} 登录响应对象
 */
export function generateLoginResponse(user, tokenResult, email, additionalData = {}) {
    return {
        status: "success",
        message: "登录成功",
        userid: parseInt(user.id),
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
        email: email,
        token: tokenResult.accessToken,
        expires_at: tokenResult.expiresAt,
        refresh_expires_at: tokenResult.refreshExpiresAt,
        ...additionalData
    };
}

export default {
    createUserLoginTokens,
    getUserInfoForToken,
    generateLoginResponse,
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    parseDeviceInfo,
    generateToken,
    verifyToken,
    updateTokenActivity,
    revokeToken,
    revokeAllUserTokens,
    refreshAccessToken
};