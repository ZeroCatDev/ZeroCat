/**
 * 统一令牌服务
 *
 * 替代旧的会话令牌(JWT) + 账户令牌(zc_) + OAuth 令牌的分散实现。
 * 所有令牌均为不透明随机串, 仅在数据库中存储 SHA-256 哈希, 并携带 scope 列表用于精细化鉴权。
 *
 * 令牌类型 (ow_tokens.type):
 *   - session  : 用户登录会话 (默认 scope=["*"], 带刷新令牌)
 *   - personal : 用户自建的个人 API 令牌 (自定义 scope, 无刷新令牌)
 *   - oauth    : 第三方应用授权令牌 (用户授予的 scope 子集, 带刷新令牌)
 */

import crypto from "crypto";
import logger from "../logger.js";
import { prisma } from "../prisma.js";
import redisClient from "../redis.js";
import zcconfig from "../config/zcconfig.js";
import { parseDeviceInfo } from "./tokenUtils.js";
import { normalizeScopes, validateUserGrantableScopes } from "./scopes.js";

const TOKEN_PREFIX = "zc_";
const CACHE_PREFIX = "token:cache:";
const REFRESH_GRACE_PREFIX = "refresh:grace:";
const REFRESH_GRACE_TTL_SEC = 120;
const TOKEN_CACHE_MAX_TTL = 5 * 60;

// 默认有效期 (秒)
const DEFAULT_SESSION_ACCESS_EXPIRY = 60 * 60 * 24; // 24 小时
const DEFAULT_SESSION_REFRESH_EXPIRY = 60 * 60 * 24 * 30; // 30 天
const DEFAULT_OAUTH_ACCESS_EXPIRY = 60 * 60; // 1 小时
const DEFAULT_OAUTH_REFRESH_EXPIRY = 60 * 60 * 24 * 30; // 30 天

/**
 * 生成不透明令牌明文
 * @returns {string} 形如 zc_<96 hex>
 */
function generateRawToken() {
    return TOKEN_PREFIX + crypto.randomBytes(48).toString("hex");
}

/**
 * 计算令牌哈希 (SHA-256 hex)
 * @param {string} rawToken
 * @returns {string}
 */
export function hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * 令牌展示用前缀 (前 12 个字符)
 */
function tokenDisplayPrefix(rawToken) {
    return rawToken.substring(0, 12);
}

async function getSessionAccessExpiry() {
    try {
        const v = parseInt(await zcconfig.get("security.accessTokenExpiry"), 10);
        if (!isNaN(v) && v > 0) return v;
    } catch (_) { /* ignore */ }
    return DEFAULT_SESSION_ACCESS_EXPIRY;
}

async function getSessionRefreshExpiry() {
    try {
        const v = parseInt(await zcconfig.get("security.refreshTokenExpiry"), 10);
        if (!isNaN(v) && v > 0) return v;
    } catch (_) { /* ignore */ }
    return DEFAULT_SESSION_REFRESH_EXPIRY;
}

/**
 * 签发令牌
 * @param {object} params
 * @param {number} params.userId 用户ID
 * @param {"session"|"personal"|"oauth"} params.type 令牌类型
 * @param {string[]} params.scopes 授予的 scope 列表
 * @param {string} [params.name] 令牌名称 (personal/oauth)
 * @param {number} [params.applicationId] OAuth 应用ID
 * @param {number} [params.authorizationId] OAuth 授权记录ID
 * @param {number|null} [params.accessTokenExpiry] 访问令牌有效期(秒), null=永不过期(personal)
 * @param {number} [params.refreshTokenExpiry] 刷新令牌有效期(秒)
 * @param {boolean} [params.withRefreshToken] 是否签发刷新令牌
 * @param {string} [params.ip] 客户端IP
 * @param {string} [params.userAgent] UA
 * @param {boolean} [params.recordLoginEvent] 是否记录登录事件
 * @returns {Promise<object>} { success, accessToken, refreshToken?, expiresAt?, refreshExpiresAt?, tokenId, scopes }
 */
export async function issueToken(params) {
    const {
        userId,
        type = "session",
        scopes = ["*"],
        name = null,
        applicationId = null,
        authorizationId = null,
        ip = null,
        userAgent = null,
        recordLoginEvent = false,
    } = params;

    try {
        // 解析有效期
        let accessTokenExpiry = params.accessTokenExpiry;
        let refreshTokenExpiry = params.refreshTokenExpiry;
        let withRefreshToken = params.withRefreshToken;

        if (type === "session") {
            if (accessTokenExpiry === undefined) accessTokenExpiry = await getSessionAccessExpiry();
            if (refreshTokenExpiry === undefined) refreshTokenExpiry = await getSessionRefreshExpiry();
            if (withRefreshToken === undefined) withRefreshToken = true;
        } else if (type === "oauth") {
            if (accessTokenExpiry === undefined) accessTokenExpiry = DEFAULT_OAUTH_ACCESS_EXPIRY;
            if (refreshTokenExpiry === undefined) refreshTokenExpiry = DEFAULT_OAUTH_REFRESH_EXPIRY;
            if (withRefreshToken === undefined) withRefreshToken = true;
        } else {
            // personal: 默认永不过期, 无刷新令牌
            if (accessTokenExpiry === undefined) accessTokenExpiry = null;
            withRefreshToken = false;
        }

        const normalizedScopes = normalizeScopes(scopes);
        if (type !== "session") {
            const grantCheck = await validateUserGrantableScopes(userId, normalizedScopes);
            if (!grantCheck.allowed) {
                return {
                    success: false,
                    message: "请求的权限范围超过用户本身权限",
                    code: "ZC_ERROR_SCOPE_ESCALATION",
                    deniedScopes: grantCheck.denied,
                };
            }
        }

        const now = Date.now();
        const rawAccess = generateRawToken();
        const accessHash = hashToken(rawAccess);
        const accessExpiresAt = accessTokenExpiry ? new Date(now + accessTokenExpiry * 1000) : null;

        let rawRefresh = null;
        let refreshHash = null;
        let refreshExpiresAt = null;
        if (withRefreshToken) {
            rawRefresh = generateRawToken();
            refreshHash = hashToken(rawRefresh);
            refreshExpiresAt = new Date(now + (refreshTokenExpiry || DEFAULT_SESSION_REFRESH_EXPIRY) * 1000);
        }

        const deviceInfo = userAgent ? parseDeviceInfo(userAgent) : null;

        const record = await prisma.ow_tokens.create({
            data: {
                user_id: userId,
                type,
                name,
                token_hash: accessHash,
                token_prefix: tokenDisplayPrefix(rawAccess),
                refresh_token_hash: refreshHash,
                scopes: normalizedScopes,
                application_id: applicationId,
                authorization_id: authorizationId,
                expires_at: accessExpiresAt,
                refresh_expires_at: refreshExpiresAt,
                ip_address: ip,
                user_agent: userAgent?.substring(0, 255) || null,
                device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
                last_used_at: new Date(now),
                last_used_ip: ip,
                activity_count: 0,
            },
        });

        if (recordLoginEvent) {
            try {
                const { createEvent } = await import("../../controllers/events.js");
                await createEvent("user_login", userId, "user", userId, {
                    event_type: "user_login",
                    device_info: deviceInfo,
                    ip_address: ip,
                });
            } catch (eventError) {
                logger.error(`记录登录事件失败: ${eventError.message}`);
            }
        }

        return {
            success: true,
            accessToken: rawAccess,
            refreshToken: rawRefresh,
            expiresAt: accessExpiresAt,
            refreshExpiresAt,
            tokenId: record.id,
            scopes: normalizedScopes,
            type,
        };
    } catch (error) {
        logger.error(`签发令牌失败: ${error.message}`);
        logger.error(error.stack);
        return { success: false, message: "签发令牌失败", error: error.message };
    }
}

/**
 * 验证令牌
 * @param {string} rawToken 令牌明文
 * @param {string} [ipAddress] 客户端IP
 * @returns {Promise<{valid:boolean, user?:object, scopes?:string[], tokenType?:string, tokenId?:number, applicationId?:number, message?:string}>}
 */
export async function verifyToken(rawToken, ipAddress = null) {
    try {
        if (!rawToken || typeof rawToken !== "string") {
            return { valid: false, message: "无效的令牌格式" };
        }

        const hash = hashToken(rawToken);
        const cacheKey = CACHE_PREFIX + hash;

        // 1. 尝试 Redis 缓存
        let cached = await redisClient.get(cacheKey);
        if (cached) {
            if (cached.expires_at && cached.expires_at < Date.now()) {
                await redisClient.delete(cacheKey);
            } else {
                updateTokenActivity(cached.tokenId, ipAddress).catch((e) =>
                    logger.error(`更新令牌活动失败: ${e.message}`)
                );
                return {
                    valid: true,
                    user: cached.user,
                    scopes: cached.scopes,
                    tokenType: cached.type,
                    tokenId: cached.tokenId,
                    applicationId: cached.applicationId || null,
                };
            }
        }

        // 2. 回落数据库
        const record = await prisma.ow_tokens.findFirst({
            where: { token_hash: hash, revoked: false },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });

        if (!record) {
            return { valid: false, message: "令牌不存在或已被吊销" };
        }

        // 过期检查
        if (record.expires_at && record.expires_at < new Date()) {
            return { valid: false, message: "令牌已过期" };
        }

        // 用户状态检查
        if (!record.user || record.user.status !== "active") {
            return { valid: false, message: "用户账户状态异常" };
        }

        const user = {
            userid: record.user.id,
            username: record.user.username,
            display_name: record.user.display_name,
            email: record.user.email,
            token_id: record.id,
        };
        const scopes = normalizeScopes(record.scopes);

        // 写入缓存 (TTL = 剩余有效期, 上限 1 小时)
        const remainingMs = record.expires_at
            ? record.expires_at.getTime() - Date.now()
            : TOKEN_CACHE_MAX_TTL * 1000;
        const ttl = Math.min(TOKEN_CACHE_MAX_TTL, Math.max(1, Math.floor(remainingMs / 1000)));
        await redisClient.set(
            cacheKey,
            {
                tokenId: record.id,
                user,
                scopes,
                type: record.type,
                applicationId: record.application_id || null,
                expires_at: record.expires_at ? record.expires_at.getTime() : null,
            },
            ttl
        );

        updateTokenActivity(record.id, ipAddress).catch((e) =>
            logger.error(`更新令牌活动失败: ${e.message}`)
        );

        return {
            valid: true,
            user,
            scopes,
            tokenType: record.type,
            tokenId: record.id,
            applicationId: record.application_id || null,
        };
    } catch (error) {
        logger.error(`验证令牌时出错: ${error.message}`);
        return { valid: false, message: "验证令牌时发生错误" };
    }
}

/**
 * 异步更新令牌活动记录
 */
export async function updateTokenActivity(tokenId, ipAddress) {
    try {
        await prisma.ow_tokens.update({
            where: { id: tokenId },
            data: {
                last_used_at: new Date(),
                last_used_ip: ipAddress,
                activity_count: { increment: 1 },
            },
        });
        return true;
    } catch (error) {
        logger.error(`更新令牌活动记录出错: ${error.message}`);
        return false;
    }
}

function serializeGracePayload(payload) {
    return {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        expiresAt: payload.expiresAt instanceof Date
            ? payload.expiresAt.toISOString()
            : payload.expiresAt,
        refreshExpiresAt: payload.refreshExpiresAt instanceof Date
            ? payload.refreshExpiresAt.toISOString()
            : payload.refreshExpiresAt,
        tokenId: payload.tokenId,
        scopes: payload.scopes,
    };
}

async function readGraceRefreshResult(refreshHash) {
    try {
        const cached = await redisClient.get(REFRESH_GRACE_PREFIX + refreshHash);
        if (!cached?.accessToken) return null;
        return {
            success: true,
            accessToken: cached.accessToken,
            refreshToken: cached.refreshToken,
            expiresAt: cached.expiresAt ? new Date(cached.expiresAt) : null,
            refreshExpiresAt: cached.refreshExpiresAt ? new Date(cached.refreshExpiresAt) : null,
            tokenId: cached.tokenId,
            scopes: normalizeScopes(cached.scopes),
            fromGrace: true,
        };
    } catch {
        return null;
    }
}

async function storeGraceRefreshResult(refreshHash, payload) {
    if (!refreshHash) return;
    try {
        await redisClient.set(
            REFRESH_GRACE_PREFIX + refreshHash,
            serializeGracePayload(payload),
            REFRESH_GRACE_TTL_SEC
        );
    } catch (error) {
        logger.warn(`[token] 写入刷新宽限期缓存失败: ${error.message}`);
    }
}

/**
 * 使用刷新令牌换取新的访问令牌 (会话 / OAuth)
 * 轮换访问令牌与刷新令牌；旧刷新令牌在宽限期内仍可换取同一组最新令牌（并发/多标签页安全）。
 * @param {string} rawRefreshToken 刷新令牌明文
 * @param {string} [ipAddress]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
export async function refreshAccessToken(rawRefreshToken, ipAddress = null, userAgent = null) {
    try {
        if (!rawRefreshToken) {
            return { success: false, message: "缺少刷新令牌" };
        }
        const refreshHash = hashToken(rawRefreshToken);

        const graceResult = await readGraceRefreshResult(refreshHash);
        if (graceResult) {
            return graceResult;
        }

        const record = await prisma.ow_tokens.findFirst({
            where: { refresh_token_hash: refreshHash, revoked: false },
            include: {
                user: {
                    select: { id: true, status: true },
                },
            },
        });

        if (!record) {
            return { success: false, message: "无效的刷新令牌" };
        }
        if (!record.user || record.user.status !== "active") {
            return { success: false, message: "用户账户状态异常" };
        }
        if (record.refresh_expires_at && record.refresh_expires_at < new Date()) {
            return { success: false, message: "刷新令牌已过期" };
        }

        const previousAccessHash = record.token_hash;
        const previousRefreshHash = refreshHash;

        // 失效旧访问令牌缓存
        await redisClient.delete(CACHE_PREFIX + previousAccessHash);

        const accessTokenExpiry =
            record.type === "oauth" ? DEFAULT_OAUTH_ACCESS_EXPIRY : await getSessionAccessExpiry();
        const now = Date.now();
        const rawAccess = generateRawToken();
        const rawRefresh = generateRawToken();
        const accessHash = hashToken(rawAccess);
        const newRefreshHash = hashToken(rawRefresh);
        const accessExpiresAt = new Date(now + accessTokenExpiry * 1000);

        await prisma.ow_tokens.update({
            where: { id: record.id },
            data: {
                token_hash: accessHash,
                token_prefix: tokenDisplayPrefix(rawAccess),
                refresh_token_hash: newRefreshHash,
                expires_at: accessExpiresAt,
                last_used_at: new Date(now),
                last_used_ip: ipAddress,
                user_agent: userAgent?.substring(0, 255) || record.user_agent,
                device_info: userAgent ? JSON.stringify(parseDeviceInfo(userAgent)) : record.device_info,
                activity_count: { increment: 1 },
            },
        });

        const result = {
            success: true,
            accessToken: rawAccess,
            refreshToken: rawRefresh,
            expiresAt: accessExpiresAt,
            refreshExpiresAt: record.refresh_expires_at,
            tokenId: record.id,
            scopes: normalizeScopes(record.scopes),
        };

        // 旧刷新令牌宽限期：并发请求仍可拿到同一组最新令牌
        await storeGraceRefreshResult(previousRefreshHash, result);

        return result;
    } catch (error) {
        logger.error(`刷新令牌时出错: ${error.message}`);
        return { success: false, message: "刷新令牌时出错" };
    }
}

/**
 * 吊销单个令牌
 * @param {number} tokenId
 * @returns {Promise<object>}
 */
export async function revokeToken(tokenId) {
    try {
        const record = await prisma.ow_tokens.findUnique({ where: { id: tokenId } });
        if (!record) return { success: false, message: "令牌不存在" };
        if (record.revoked) return { success: true, message: "令牌已被吊销" };

        await prisma.ow_tokens.update({
            where: { id: tokenId },
            data: { revoked: true, revoked_at: new Date() },
        });
        await redisClient.delete(CACHE_PREFIX + record.token_hash);
        return { success: true, message: "令牌已吊销" };
    } catch (error) {
        logger.error(`吊销令牌出错: ${error.message}`);
        return { success: false, message: "吊销令牌时出错" };
    }
}

/**
 * 吊销某用户的全部令牌 (可排除当前令牌)
 * @param {number} userId
 * @param {number|null} [excludeTokenId]
 * @returns {Promise<object>}
 */
export async function revokeAllUserTokens(userId, excludeTokenId = null) {
    try {
        const normalizedUserId = Number(userId);
        if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
            return { success: false, message: "无效的用户ID" };
        }

        const tokens = await prisma.ow_tokens.findMany({
            where: {
                user_id: normalizedUserId,
                revoked: false,
                ...(excludeTokenId ? { id: { not: excludeTokenId } } : {}),
            },
            select: { id: true, token_hash: true },
        });

        for (const t of tokens) {
            await redisClient.delete(CACHE_PREFIX + t.token_hash);
        }

        const result = await prisma.ow_tokens.updateMany({
            where: {
                user_id: normalizedUserId,
                revoked: false,
                ...(excludeTokenId ? { id: { not: excludeTokenId } } : {}),
            },
            data: { revoked: true, revoked_at: new Date() },
        });

        return { success: true, count: result.count };
    } catch (error) {
        logger.error(`吊销用户全部令牌出错: ${error.message}`);
        return { success: false, message: "吊销失败" };
    }
}

/**
 * 按条件吊销一批令牌并清理缓存。调用方必须传入收窄后的 where 条件。
 * @param {object} where Prisma ow_tokens where 条件
 * @returns {Promise<object>}
 */
export async function revokeTokensWhere(where) {
    try {
        if (!where || typeof where !== "object" || Object.keys(where).length === 0) {
            return { success: false, message: "缺少吊销条件" };
        }

        const narrowedWhere = { ...where, revoked: false };
        const tokens = await prisma.ow_tokens.findMany({
            where: narrowedWhere,
            select: { token_hash: true },
        });

        for (const token of tokens) {
            await redisClient.delete(CACHE_PREFIX + token.token_hash);
        }

        const result = await prisma.ow_tokens.updateMany({
            where: narrowedWhere,
            data: { revoked: true, revoked_at: new Date() },
        });

        return { success: true, count: result.count };
    } catch (error) {
        logger.error(`批量吊销令牌出错: ${error.message}`);
        return { success: false, message: "批量吊销令牌失败" };
    }
}

/**
 * 列出用户的令牌 (不含敏感哈希)
 * @param {number} userId
 * @param {object} [filter] 如 { type: "personal" }
 * @returns {Promise<Array>}
 */
export async function listUserTokens(userId, filter = {}) {
    const tokens = await prisma.ow_tokens.findMany({
        where: { user_id: userId, ...filter },
        select: {
            id: true,
            type: true,
            name: true,
            token_prefix: true,
            scopes: true,
            application_id: true,
            expires_at: true,
            last_used_at: true,
            last_used_ip: true,
            activity_count: true,
            revoked: true,
            revoked_at: true,
            created_at: true,
            updated_at: true,
        },
        orderBy: { created_at: "desc" },
    });
    return tokens.map((token) => ({
        ...token,
        scopes: normalizeScopes(token.scopes),
    }));
}

/**
 * 内省令牌: 根据明文令牌返回其归属与元数据 (不含哈希/明文)。
 * 用于调试工具。返回 null 表示不存在。
 * @param {string} rawToken 令牌明文
 * @returns {Promise<object|null>}
 */
export async function introspectToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return null;
    const record = await prisma.ow_tokens.findFirst({
        where: { token_hash: hashToken(rawToken) },
        include: {
            user: {
                select: { id: true, username: true, display_name: true, status: true },
            },
            application: {
                select: { id: true, name: true, client_id: true },
            },
        },
    });
    if (!record) return null;

    const now = Date.now();
    const expired = record.expires_at ? record.expires_at.getTime() < now : false;
    const active = !record.revoked && !expired && record.user?.status === "active";

    return {
        active,
        revoked: record.revoked,
        expired,
        token_id: record.id,
        type: record.type,
        name: record.name,
        token_prefix: record.token_prefix,
        scopes: normalizeScopes(record.scopes),
        user_id: record.user_id,
        user: record.user
            ? {
                  id: record.user.id,
                  username: record.user.username,
                  display_name: record.user.display_name,
                  status: record.user.status,
              }
            : null,
        application: record.application || null,
        expires_at: record.expires_at,
        last_used_at: record.last_used_at,
        last_used_ip: record.last_used_ip,
        ip_address: record.ip_address,
        device_info: record.device_info,
        activity_count: record.activity_count,
        created_at: record.created_at,
    };
}

export default {
    issueToken,
    verifyToken,
    refreshAccessToken,
    revokeToken,
    revokeTokensWhere,
    revokeAllUserTokens,
    listUserTokens,
    introspectToken,
    updateTokenActivity,
    hashToken,
};
