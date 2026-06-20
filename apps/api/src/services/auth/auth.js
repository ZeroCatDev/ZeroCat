import {prisma} from "../prisma.js";
import logger from "../logger.js";
import ipLocation from "../ip/ipLocation.js";
import {
    createUserLoginTokens,
    parseDeviceInfo,
} from "./tokenUtils.js";
import {
    verifyToken,
    refreshAccessToken,
    revokeToken,
    revokeAllUserTokens,
    updateTokenActivity,
} from "./tokenService.js";


// 用户退出登录
const logout = async (tokenId) => {
    return await revokeToken(tokenId);
};


// 获取用户所有活跃会话令牌
const getUserActiveTokens = async (userId) => {
    try {
        const tokens = await prisma.ow_tokens.findMany({
            where: {
                user_id: userId,
                type: "session",
                revoked: false,
                OR: [
                    {refresh_expires_at: {gt: new Date()}},
                    {refresh_expires_at: null},
                ],
            },
            orderBy: [{last_used_at: "desc"}, {created_at: "desc"}],
        });

        return tokens;
    } catch (error) {
        logger.error("获取用户活跃令牌时出错:", error);
        throw error;
    }
};

// 获取令牌详细信息，包括IP位置 - 实时获取位置信息
const getTokenDetails = async (tokenId) => {
    try {
        const token = await prisma.ow_tokens.findUnique({
            where: {id: tokenId},
        });

        if (!token) {
            return {success: false, message: "令牌不存在"};
        }

        // 实时获取IP位置信息，而不是从数据库读取
        let ipLocationInfo = null;
        let lastUsedIpLocationInfo = null;

        // 如果有IP地址，则获取其位置信息
        if (token.ip_address) {
            ipLocationInfo = await ipLocation.getIPLocation(token.ip_address);
        }

        // 如果有最后使用IP，且与创建IP不同，则获取其位置信息
        if (token.last_used_ip && token.last_used_ip !== token.ip_address) {
            lastUsedIpLocationInfo = await ipLocation.getIPLocation(
                token.last_used_ip
            );
        } else if (token.last_used_ip) {
            // 如果最后使用IP与创建IP相同，复用创建IP的位置信息
            lastUsedIpLocationInfo = ipLocationInfo;
        }

        // 解析设备信息
        let deviceInfo = null;
        if (token.device_info) {
            try {
                deviceInfo = JSON.parse(token.device_info);
            } catch (e) {
                logger.error("解析设备信息时出错:", e);
            }
        }

        return {
            success: true,
            data: {
                ...token,
                ip_location: ipLocationInfo,
                last_used_ip_location: lastUsedIpLocationInfo,
                device_info: deviceInfo
            },
        };
    } catch (error) {
        logger.error("获取令牌详情时出错:", error);
        return {success: false, message: "获取令牌详情失败"};
    }
};

// 清理过期令牌 (吊销刷新令牌已过期的会话/OAuth 令牌)
const cleanupExpiredTokens = async () => {
    try {
        const result = await prisma.ow_tokens.updateMany({
            where: {
                revoked: false,
                refresh_expires_at: {lt: new Date()},
            },
            data: {
                revoked: true,
                revoked_at: new Date()
            },
        });

        logger.info(`已清理 ${result.count} 个过期令牌`);
        return result.count;
    } catch (error) {
        logger.error("清理过期令牌时出错:", error);
        throw error;
    }
};

export default {
    createTokens: createUserLoginTokens,
    verifyToken,
    refreshAccessToken,
    revokeToken,
    logout,
    getUserActiveTokens,
    getTokenDetails,
    cleanupExpiredTokens,
    parseDeviceInfo,
    updateTokenActivity,
    revokeAllUserTokens
};
