import { prisma } from "../global.js";
import logger from "../logger.js";

/**
 * 验证账户令牌
 * 这个函数可以被其他中间件调用
 */
export async function verifyAccountToken(token) {
    try {
        if (!token || typeof token !== "string") {
            return {
                valid: false,
                message: "无效的令牌格式"
            };
        }

        // 查找令牌记录
        const tokenRecord = await prisma.ow_account_tokens.findFirst({
            where: {
                token: token,
                is_revoked: false
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                        status: true
                    }
                }
            }
        });

        if (!tokenRecord) {
            return {
                valid: false,
                message: "令牌不存在或已被吊销"
            };
        }

        // 检查用户状态
        if (tokenRecord.user.status !== "active") {
            return {
                valid: false,
                message: "用户账户状态异常"
            };
        }

        // 检查是否过期
        if (tokenRecord.expires_at && tokenRecord.expires_at < new Date()) {
            // 自动吊销过期令牌
            await prisma.ow_account_tokens.update({
                where: {
                    id: tokenRecord.id
                },
                data: {
                    is_revoked: true,
                    revoked_at: new Date()
                }
            });

            return {
                valid: false,
                message: "令牌已过期"
            };
        }

        return {
            valid: true,
            user: {
                userid: tokenRecord.user.id,
                username: tokenRecord.user.username,
                display_name: tokenRecord.user.display_name,
                email: tokenRecord.user.email,
                token_id: tokenRecord.id,
                token_type: "account"
            },
            tokenRecord: tokenRecord
        };
    } catch (error) {
        logger.error("验证账户令牌时出错:", error);
        return {
            valid: false,
            message: "验证令牌时发生错误"
        };
    }
}

/**
 * 更新令牌使用记录
 */
export async function updateAccountTokenUsage(tokenId, ipAddress) {
    try {
        await prisma.ow_account_tokens.update({
            where: {
                id: tokenId
            },
            data: {
                last_used_at: new Date(),
                last_used_ip: ipAddress
            }
        });
    } catch (error) {
        logger.error("更新账户令牌使用记录时出错:", error);
    }
}