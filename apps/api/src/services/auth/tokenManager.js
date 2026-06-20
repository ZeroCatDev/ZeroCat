import jwt from "jsonwebtoken";
import zcconfig from "../config/zcconfig.js";
import {createTypedJWT} from "./tokenUtils.js";
import logger from "../logger.js";
import {prisma} from "../prisma.js";
import crypto from "crypto";
import {issueToken, hashToken, refreshAccessToken, revokeTokensWhere} from "./tokenService.js";
import { normalizeScopes as normalizeScopeCatalog } from "./scopes.js";

/**
 * 将 scope 规范化为字符串数组
 * @param {string|string[]} scopes
 * @returns {string[]}
 */
function normalizeScopes(scopes) {
    return normalizeScopeCatalog(scopes);
}

export async function generateFileAccessToken(sha256, userid) {
    return createTypedJWT("file", {
        action: "read",
        issuer: await zcconfig.get("site.domain"),
        sha256: sha256,
        userid: userid,
    }, 5 * 60); // 5分钟
}

export async function verifyFileAccessToken(token, userid) {
    const decoded = jwt.verify(token, await zcconfig.get("security.jwttoken"));
    if (!decoded) {
        throw new Error("Invalid token");
    }
    const {sha256, action, userid: tokenUserid} = decoded.data;
    const type = decoded.type;
    if (type !== "file" || action !== "read" || (tokenUserid !== userid && tokenUserid !== 0)) {
        throw new Error("Invalid token");
    }
    return sha256;
}

// OAuth令牌生成 (统一写入 ow_tokens, type=oauth)
export async function generateOAuthTokens(userId, applicationId, authorizationId, scopes) {
    try {
        const scopeArray = normalizeScopes(scopes);
        const result = await issueToken({
            userId,
            type: "oauth",
            scopes: scopeArray,
            applicationId,
            authorizationId,
            accessTokenExpiry: 3600, // 1小时
            withRefreshToken: true,
        });

        if (!result.success || !result.accessToken) {
            throw new Error("Failed to generate tokens");
        }

        return {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: 3600,
        };
    } catch (error) {
        logger.error("Error generating OAuth tokens:", error);
        throw new Error("Failed to generate tokens");
    }
}

// 验证OAuth访问令牌 (从 ow_tokens 读取)
export async function verifyOAuthAccessToken(accessToken) {
    const token = await prisma.ow_tokens.findFirst({
        where: {
            token_hash: hashToken(accessToken),
            type: "oauth",
            revoked: false,
        },
        include: {
            application: true,
            authorization: true,
            user: {
                select: {
                    id: true,
                    username: true,
                    display_name: true,
                },
            },
        },
    });

    if (!token || (token.expires_at && token.expires_at < new Date())) {
        throw new Error("Invalid or expired access token");
    }

    await prisma.ow_tokens.update({
        where: { id: token.id },
        data: { last_used_at: new Date() },
    });

    return token;
}

// 刷新OAuth令牌 (基于 ow_tokens)
export async function refreshOAuthTokens(refreshToken, applicationId) {
    try {
        // 校验刷新令牌属于该应用
        const existing = await prisma.ow_tokens.findFirst({
            where: {
                refresh_token_hash: hashToken(refreshToken),
                type: "oauth",
                application_id: applicationId,
                revoked: false,
            },
        });

        if (!existing) {
            throw new Error("Invalid or expired refresh token");
        }
        if (existing.refresh_expires_at && existing.refresh_expires_at < new Date()) {
            throw new Error("Invalid or expired refresh token");
        }

        // 轮换访问令牌
        const result = await refreshAccessToken(refreshToken);
        if (!result.success || !result.accessToken) {
            throw new Error("Failed to generate new tokens");
        }

        return {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: 3600,
            scope: Array.isArray(existing.scopes) ? existing.scopes.join(" ") : existing.scopes,
        };
    } catch (error) {
        logger.error("Error refreshing OAuth tokens:", error);
        throw error;
    }
}

// 撤销OAuth令牌
export async function revokeOAuthToken(token, tokenType = "access_token") {
    const tokenField = tokenType === "refresh_token" ? "refresh_token_hash" : "token_hash";

    const result = await revokeTokensWhere({
        [tokenField]: hashToken(token),
        type: "oauth",
    });

    return Boolean(result.success && result.count > 0);
}

// 验证OAuth应用凭证
export async function verifyOAuthClientCredentials(clientId, clientSecret) {
    const application = await prisma.ow_oauth_applications.findFirst({
        where: {
            client_id: clientId,
            client_secret: clientSecret,
            status: "active",
        },
    });

    return application;
}
