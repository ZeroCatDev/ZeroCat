import jsonwebtoken from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../global.js";
import zcconfig from "../config/zcconfig.js";
import logger from "../logger.js";
import { UAParser } from "ua-parser-js";
import ipLocation from "../ip/ipLocation.js";
import {
  createUserLoginTokens,
  verifyToken,
  updateTokenActivity,
  revokeToken,
  revokeAllUserTokens,
  refreshAccessToken,
  parseDeviceInfo
} from "./tokenUtils.js";
import redisClient from "../redis.js";


// 用户退出登录
const logout = async (tokenId) => {
  return await revokeToken(tokenId);
};


// 获取用户所有活跃令牌
const getUserActiveTokens = async (userId) => {
  try {
    const tokens = await prisma.ow_auth_tokens.findMany({
      where: {
        user_id: userId,
        revoked: false,
        refresh_expires_at: { gt: new Date() }, // 使用refresh_expires_at作为活跃判断标准
      },
      orderBy: [{ last_used_at: "desc" }, { created_at: "desc" }],
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
    const token = await prisma.ow_auth_tokens.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      return { success: false, message: "令牌不存在" };
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
    return { success: false, message: "获取令牌详情失败" };
  }
};

// 清理过期令牌
const cleanupExpiredTokens = async () => {
  try {
    // 首先获取所有过期但未被撤销的令牌
    const expiredTokens = await prisma.ow_auth_tokens.findMany({
      where: {
        revoked: false,
        refresh_expires_at: { lt: new Date() },
      },
      select: {
        id: true,
        refresh_token: true
      }
    });

    // 获取访问令牌过期时间设置
    const accessTokenExpiry = 15 * 60; // 默认15分钟

    // 对每个过期令牌进行Redis处理
    for (const token of expiredTokens) {
      // 将令牌ID添加到黑名单
      const blacklistKey = `token:blacklist:${token.id}`;
      await redisClient.set(blacklistKey, {
        reason: "token_expired",
        revokedAt: Date.now()
      }, accessTokenExpiry);

      // 从Redis中删除令牌详情和刷新令牌
      const tokenKey = `token:details:${token.id}`;
      await redisClient.delete(tokenKey);

      const refreshTokenKey = `token:refresh:${token.refresh_token}`;
      await redisClient.delete(refreshTokenKey);
    }

    // 批量更新数据库记录
    const result = await prisma.ow_auth_tokens.updateMany({
      where: {
        revoked: false,
        refresh_expires_at: { lt: new Date() },
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

// 检查是否可以延长刷新令牌有效期
const canExtendRefreshToken = async (tokenRecord) => {
  try {
    // 检查是否启用了刷新令牌扩展功能
    const extensionEnabled = await zcconfig.get(
      "security.refreshTokenExtensionEnabled",
      "true"
    );

    if (extensionEnabled !== "true") {
      return { canExtend: false, reason: "禁用了扩展功能" };
    }

    // 如果已经被延长过期限，检查是否在最大延长期限内
    if (tokenRecord.extended_at) {
      const maxExtensionDays = await zcconfig.get(
        "security.refreshTokenMaxExtensionDays",
        90
      );

      const createdAtTimestamp = tokenRecord.created_at.getTime();
      const maxExtendedDate = new Date(
        createdAtTimestamp + (maxExtensionDays * 24 * 60 * 60 * 1000)
      );

      // 如果当前时间已经超过最大延长期限，不再延长
      if (new Date() > maxExtendedDate) {
        return { canExtend: false, reason: "已达到最大延长期限" };
      }
    }

    // 如果活动计数足够并且上次使用时间是近期的（比如7天内）
    const minActivityCount = 5; // 最小活动次数
    const recentActivityDays = 7; // 最近活动天数

    const recentActivityDate = new Date();
    recentActivityDate.setDate(recentActivityDate.getDate() - recentActivityDays);

    if (tokenRecord.activity_count >= minActivityCount &&
        tokenRecord.last_used_at >= recentActivityDate) {
      return { canExtend: true };
    }

    return { canExtend: false, reason: "活动不足或近期未使用" };
  } catch (error) {
    logger.error("检查刷新令牌延长时出错:", error);
    return { canExtend: false, reason: "内部错误" };
  }
};

// 延长刷新令牌有效期
const extendRefreshToken = async (tokenId) => {
  try {
    // 获取默认的刷新令牌有效期（30天）
    const refreshTokenExpiry = await zcconfig.get(
      "security.refreshTokenExpiry",
      60 * 60 * 24 * 30
    );

    // 计算新的过期时间
    const newRefreshExpiry = new Date(
      Date.now() + refreshTokenExpiry * 1000
    );

    // 更新令牌记录
    await prisma.ow_auth_tokens.update({
      where: { id: tokenId },
      data: {
        refresh_expires_at: newRefreshExpiry,
        extended_at: new Date()
      }
    });

    return { success: true, newExpiryDate: newRefreshExpiry };
  } catch (error) {
    logger.error("延长刷新令牌时出错:", error);
    return { success: false, message: "延长刷新令牌失败" };
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
  canExtendRefreshToken,
  extendRefreshToken,
  revokeAllUserTokens
};
