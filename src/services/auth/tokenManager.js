import jwt from "jsonwebtoken";
import zcconfig from "../config/zcconfig.js";
import {createTypedJWT} from "./tokenUtils.js";
import logger from "../logger.js";
import {prisma} from "../global.js";
import crypto from "crypto";

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

// OAuth令牌生成
export async function generateOAuthTokens(userId, applicationId, authorizationId, scopes) {
    try {
        const accessToken = crypto.randomBytes(32).toString("hex");
        const refreshToken = crypto.randomBytes(32).toString("hex");
        const expiresIn = 3600; // 访问令牌1小时有效期

        if (!accessToken || !refreshToken) {
            throw new Error("Failed to generate tokens");
        }

        // 创建访问令牌记录
        await prisma.ow_oauth_access_tokens.create({
            data: {
                application_id: applicationId,
                authorization_id: authorizationId,
                user_id: userId,
                access_token: accessToken,
                refresh_token: refreshToken,
                scopes: scopes || [],
                expires_at: new Date(Date.now() + expiresIn * 1000),
                refresh_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    } catch (error) {
        logger.error("Error generating OAuth tokens:", error);
        throw new Error("Failed to generate tokens");
    }
}

// 验证OAuth访问令牌
export async function verifyOAuthAccessToken(accessToken) {
    const token = await prisma.ow_oauth_access_tokens.findFirst({
        where: {
            access_token: accessToken,
            expires_at: {gt: new Date()},
            is_revoked: false,
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

    if (!token) {
        throw new Error("Invalid or expired access token");
    }

    // 更新最后使用时间
    await prisma.ow_oauth_access_tokens.update({
        where: {id: token.id},
        data: {
            last_used_at: new Date(),
        },
    });

    return token;
}

// 刷新OAuth令牌
export async function refreshOAuthTokens(refreshToken, applicationId) {
    try {
        const oldToken = await prisma.ow_oauth_access_tokens.findFirst({
            where: {
                refresh_token: refreshToken,
                application_id: applicationId,
                refresh_token_expires_at: {gt: new Date()},
                is_revoked: false,
            },
        });

        if (!oldToken) {
            throw new Error("Invalid or expired refresh token");
        }

        // 生成新的令牌
        const newTokens = await generateOAuthTokens(
            oldToken.user_id,
            oldToken.application_id,
            oldToken.authorization_id,
            oldToken.scopes
        );

        if (!newTokens || !newTokens.accessToken) {
            throw new Error("Failed to generate new tokens");
        }

        // 撤销旧令牌
        await prisma.ow_oauth_access_tokens.update({
            where: {id: oldToken.id},
            data: {
                is_revoked: true,
                updated_at: new Date()
            },
        });

        return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresIn: newTokens.expiresIn
        };
    } catch (error) {
        logger.error("Error refreshing OAuth tokens:", error);
        throw error;
    }
}

// 撤销OAuth令牌
export async function revokeOAuthToken(token, tokenType = "access_token") {
    const tokenField = tokenType === "refresh_token" ? "refresh_token" : "access_token";

    const result = await prisma.ow_oauth_access_tokens.updateMany({
        where: {
            [tokenField]: token,
            is_revoked: false,
        },
        data: {
            is_revoked: true,
        },
    });

    return result.count > 0;
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
