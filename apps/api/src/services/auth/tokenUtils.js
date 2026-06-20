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
 * 为用户创建登录令牌 (会话令牌)
 *
 * 已迁移到统一令牌服务: 签发不透明 scope 令牌 (type=session, scope=["*"]).
 * 保留此函数签名以兼容现有登录控制器, 返回结构保持不变 (accessToken 现为不透明串)。
 *
 * @param {number} userId 用户ID
 * @param {object} userInfo 用户信息对象 (兼容保留, scope 令牌不再嵌入用户信息)
 * @param {string} ipAddress 用户IP地址
 * @param {string} userAgent 用户代理字符串
 * @param {object} options 其他选项 (accessTokenExpiry, recordLoginEvent)
 * @returns {Promise<object>} 包含令牌信息的对象
 */
export async function createUserLoginTokens(userId, userInfo, ipAddress, userAgent, options = {}) {
    try {
        const { issueToken } = await import("./tokenService.js");
        const result = await issueToken({
            userId,
            type: "session",
            scopes: ["*"],
            accessTokenExpiry: options.accessTokenExpiry,
            ip: ipAddress,
            userAgent,
            recordLoginEvent: options.recordLoginEvent,
        });

        if (!result.success) {
            return {
                success: false,
                message: result.message || "创建登录令牌失败",
                error: result.error,
            };
        }

        return {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt,
            refreshExpiresAt: result.refreshExpiresAt,
            tokenId: result.tokenId,
            success: true,
        };
    } catch (error) {
        logger.error(`创建登录令牌失败: ${error.message}`);
        return {
            success: false,
            message: "创建登录令牌失败",
            error: error.message,
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

function isLocalHostname(hostname) {
    if (!hostname) return true;
    const normalized = String(hostname).toLowerCase();
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
        return true;
    }
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(normalized);
}

function resolveRefreshCookieDomain(req) {
    const explicitDomain = process.env.REFRESH_TOKEN_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN;
    if (explicitDomain && String(explicitDomain).trim()) {
        const trimmed = String(explicitDomain).trim();
        return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
    }

    const hostFromReq = req?.hostname || req?.headers?.host?.split(':')[0] || '';
    const hostname = String(hostFromReq).toLowerCase();

    if (isLocalHostname(hostname)) {
        return undefined;
    }

    const parts = hostname.split('.').filter(Boolean);
    if (parts.length < 2) {
        return undefined;
    }

    // 兜底使用根域，满足常见 api.example.com / blog.example.com 场景。
    return `.${parts.slice(-2).join('.')}`;
}

function resolveRefreshCookieSecure(req) {
    const hostFromReq = req?.hostname || req?.headers?.host?.split(':')[0] || '';
    if (isLocalHostname(hostFromReq)) {
        return false;
    }

    const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    if (forwardedProto) {
        return forwardedProto === 'https';
    }

    return Boolean(req?.secure) || process.env.NODE_ENV === 'production';
}

function buildRefreshCookieSharedOptions(res) {
    return {
        httpOnly: true,
        secure: resolveRefreshCookieSecure(res?.req),
        sameSite: 'lax',
        path: '/account',
    };
}

/** 列出 refresh_token 可能存在的 cookie 作用域（host-only + 根域），用于清除遗留重复 cookie */
function buildRefreshCookieClearVariants(res) {
    const shared = buildRefreshCookieSharedOptions(res);
    const domain = resolveRefreshCookieDomain(res?.req);
    const variants = [{ ...shared }];
    if (domain) {
        variants.push({ ...shared, domain });
    }
    return variants;
}

function buildRefreshCookieBaseOptions(res) {
    const shared = buildRefreshCookieSharedOptions(res);
    const domain = resolveRefreshCookieDomain(res?.req);
    return {
        ...shared,
        ...(domain ? { domain } : {}),
    };
}

/**
 * 清除所有可能作用域下的 refresh_token cookie（host-only 与根域）
 * @param {object} res Express response 对象
 */
export function clearAllRefreshTokenCookies(res) {
    for (const options of buildRefreshCookieClearVariants(res)) {
        res.clearCookie('refresh_token', options);
    }
}

/**
 * 从请求 Cookie 头解析 refresh_token；存在多个同名 cookie 时优先 zc_ 新格式
 * @param {object} req Express request 对象
 * @returns {{ fromCookie: boolean, refresh_token: string | undefined, duplicateCount: number }}
 */
export function extractRefreshTokenFromRequest(req) {
    const raw = req.headers?.cookie || '';
    const values = [];
    for (const part of raw.split(';')) {
        const trimmed = part.trim();
        if (!trimmed.startsWith('refresh_token=')) continue;
        try {
            const value = decodeURIComponent(trimmed.slice('refresh_token='.length));
            if (value) values.push(value);
        } catch {
            // ignore malformed value
        }
    }

    if (values.length > 0) {
        const preferred = values.find((v) => v.startsWith('zc_')) || values[values.length - 1];
        return { fromCookie: true, refresh_token: preferred, duplicateCount: values.length };
    }

    const fromParser = req.cookies?.refresh_token;
    if (fromParser) {
        return { fromCookie: true, refresh_token: fromParser, duplicateCount: 1 };
    }

    return { fromCookie: false, refresh_token: req.body?.refresh_token, duplicateCount: 0 };
}

/**
 * 设置 refresh token cookie
 * @param {object} res Express response 对象
 * @param {string} refreshToken 刷新令牌
 * @param {Date} refreshExpiresAt 刷新令牌过期时间
 */
export function setRefreshTokenCookie(res, refreshToken, refreshExpiresAt) {
    const maxAge = new Date(refreshExpiresAt).getTime() - Date.now();
    const baseOptions = buildRefreshCookieBaseOptions(res);
    // 清除 host-only / 根域遗留 cookie，避免浏览器携带两个 refresh_token
    clearAllRefreshTokenCookies(res);
    res.cookie('refresh_token', refreshToken, {
        ...baseOptions,
        maxAge: Math.max(0, maxAge),
    });
}

/**
 * 清除 refresh token cookie
 * @param {object} res Express response 对象
 */
export function clearRefreshTokenCookie(res) {
    clearAllRefreshTokenCookies(res);
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
    clearAllRefreshTokenCookies,
    extractRefreshTokenFromRequest,
    parseDeviceInfo,
    generateToken,
};