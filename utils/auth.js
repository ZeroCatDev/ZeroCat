import jsonwebtoken from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "./global.js";
import configManager from "./configManager.js";
import logger from "./logger.js";
import { UAParser } from "ua-parser-js";
import ipLocation from "./ipLocation.js";

// 生成随机令牌
const generateToken = (length = 64) => {
  return crypto.randomBytes(length).toString("hex");
};

// 解析设备信息
const parseDeviceInfo = (userAgent) => {
  if (!userAgent)
    return { deviceType: "unknown", os: "unknown", browser: "unknown" };

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    deviceType: result.device.type || "desktop",
    os: `${result.os.name || "unknown"} ${result.os.version || ""}`.trim(),
    browser: `${result.browser.name || "unknown"} ${
      result.browser.version || ""
    }`.trim(),
  };
};

// 创建新的访问令牌和刷新令牌
const createTokens = async (userId, userInfo, ipAddress, userAgent) => {
  try {
    // 设置访问令牌有效期为15分钟，刷新令牌默认30天
    const accessTokenExpiry = 15 * 60; // 15分钟
    const refreshTokenExpiry = await configManager.getConfig(
      "security.jwttoken",
      60 * 60 * 24 * 30 // 默认30天
    );

    // 确保刷新令牌过期时间是数字
    const refreshTokenExpirySeconds = parseInt(refreshTokenExpiry, 10) || 60 * 60 * 24 * 30; // 如果解析失败，使用默认值30天

    // 解析设备信息并序列化为JSON
    const deviceInfo = userAgent ? parseDeviceInfo(userAgent) : null;
    const deviceInfoJson = deviceInfo ? JSON.stringify(deviceInfo) : null;

    // 生成随机令牌
    const accessToken = generateToken();
    const refreshToken = generateToken();

    // 计算过期时间
    const accessTokenExpiresAt = new Date(
      Date.now() + accessTokenExpiry * 1000
    );
    const refreshTokenExpiresAt = new Date(
      Date.now() + refreshTokenExpirySeconds * 1000
    );

    // 存储令牌信息
    const tokenRecord = await prisma.ow_auth_tokens.create({
      data: {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
        refresh_expires_at: refreshTokenExpiresAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfoJson,
        last_used_at: new Date(),
        last_used_ip: ipAddress,
        activity_count: 0,
      },
    });

    // 创建JWT
    const jwtPayload = {
      ...userInfo,
      token_id: tokenRecord.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000),
    };

    const jwtSecret = await configManager.getConfig("security.jwttoken");
    const jwt = jsonwebtoken.sign(jwtPayload, jwtSecret);

    return {
      accessToken: jwt,
      refreshToken: refreshToken,
      expiresAt: accessTokenExpiresAt,
      refreshExpiresAt: refreshTokenExpiresAt,
    };
  } catch (error) {
    logger.error("创建令牌时出错:", error);
    throw error;
  }
};

// 更新令牌活动记录
const updateTokenActivity = async (tokenId, ipAddress) => {
  try {
    await prisma.ow_auth_tokens.update({
      where: { id: tokenId },
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
    logger.error("更新令牌活动记录时出错:", error);
    return false;
  }
};

// 验证令牌
const verifyToken = async (token, ipAddress) => {
  try {
    const jwtSecret = await configManager.getConfig("security.jwttoken");
    const decoded = jsonwebtoken.verify(token, jwtSecret);

    // 查找数据库中的令牌记录
    const tokenRecord = await prisma.ow_auth_tokens.findFirst({
      where: {
        id: decoded.token_id,
        revoked: false,
      },
    });

    if (!tokenRecord) {
      return { valid: false, message: "令牌已失效或已被吊销" };
    }

    // 检查令牌是否过期
    if (tokenRecord.expires_at < new Date()) {
      return { valid: false, message: "令牌已过期" };
    }

    // 更新令牌活动记录
    if (ipAddress) {
      await updateTokenActivity(tokenRecord.id, ipAddress);
    }

    return { valid: true, user: decoded, tokenRecord };
  } catch (error) {
    logger.error("验证令牌时出错:", error);
    return { valid: false, message: "无效的令牌" };
  }
};

// 检查是否可以延长刷新令牌有效期
const canExtendRefreshToken = async (tokenRecord) => {
  try {
    // 检查是否启用了刷新令牌扩展功能
    const extensionEnabled = await configManager.getConfig(
      "security.refreshTokenExtensionEnabled",
      "true"
    );

    if (extensionEnabled !== "true") {
      return { canExtend: false, reason: "禁用了扩展功能" };
    }

    // 如果已经被延长过期限，检查是否在最大延长期限内
    if (tokenRecord.extended_at) {
      const maxExtensionDays = await configManager.getConfig(
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
    const refreshTokenExpiry = await configManager.getConfig(
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

// 使用刷新令牌生成新的访问令牌
const refreshAccessToken = async (refreshToken, ipAddress, userAgent) => {
  try {
    // 查找刷新令牌
    const tokenRecord = await prisma.ow_auth_tokens.findFirst({
      where: {
        refresh_token: refreshToken,
        revoked: false,
      },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      return { success: false, message: "无效的刷新令牌" };
    }

    // 检查刷新令牌是否过期
    if (tokenRecord.refresh_expires_at < new Date()) {
      return { success: false, message: "刷新令牌已过期" };
    }

    // 检查是否可以延长刷新令牌有效期
    const extensionCheck = await canExtendRefreshToken(tokenRecord);
    let refreshTokenExtended = false;

    // 如果可以延长，则延长刷新令牌有效期
    if (extensionCheck.canExtend) {
      const extension = await extendRefreshToken(tokenRecord.id);
      refreshTokenExtended = extension.success;
    }

    // 设置访问令牌有效期为15分钟
    const accessTokenExpiry = 15 * 60; // 15分钟

    // 生成新的访问令牌
    const newAccessToken = generateToken();
    const accessTokenExpiresAt = new Date(
      Date.now() + accessTokenExpiry * 1000
    );

    // 更新令牌记录 - 只更新访问令牌和使用记录，不更新刷新令牌
    await prisma.ow_auth_tokens.update({
      where: { id: tokenRecord.id },
      data: {
        access_token: newAccessToken,
        expires_at: accessTokenExpiresAt,
        updated_at: new Date(),
        last_used_at: new Date(),
        last_used_ip: ipAddress,
        activity_count: {
          increment: 1
        }
      },
    });

    // 获取用户信息
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: tokenRecord.user_id,
        contact_type: "email",
        is_primary: true,
      },
    });

    // 创建JWT
    const userInfo = {
      userid: tokenRecord.user.id,
      username: tokenRecord.user.username,
      display_name: tokenRecord.user.display_name,
      avatar: tokenRecord.user.images,
      email: primaryEmail?.contact_value,
    };

    const jwtPayload = {
      ...userInfo,
      token_id: tokenRecord.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000),
    };

    const jwtSecret = await configManager.getConfig("security.jwttoken");
    const jwt = jsonwebtoken.sign(jwtPayload, jwtSecret);

    return {
      success: true,
      accessToken: jwt,
      expiresAt: accessTokenExpiresAt,
      refreshTokenExtended: refreshTokenExtended,
      canExtendRefreshToken: extensionCheck.canExtend
    };
  } catch (error) {
    logger.error("刷新令牌时出错:", error);
    return { success: false, message: "刷新令牌失败" };
  }
};

// 吊销令牌
const revokeToken = async (tokenId, allSessions = false) => {
  try {
    const tokenRecord = await prisma.ow_auth_tokens.findUnique({
      where: { id: tokenId },
    });

    if (!tokenRecord) {
      return { success: false, message: "令牌不存在" };
    }

    if (allSessions) {
      // 吊销用户所有会话的令牌
      await prisma.ow_auth_tokens.updateMany({
        where: { user_id: tokenRecord.user_id, revoked: false },
        data: { revoked: true, revoked_at: new Date() },
      });
    } else {
      // 仅吊销特定令牌
      await prisma.ow_auth_tokens.update({
        where: { id: tokenId },
        data: { revoked: true, revoked_at: new Date() },
      });
    }

    return { success: true };
  } catch (error) {
    logger.error("吊销令牌时出错:", error);
    return { success: false, message: "吊销令牌失败" };
  }
};

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
    const result = await prisma.ow_auth_tokens.updateMany({
      where: {
        revoked: false,
        refresh_expires_at: { lt: new Date() },
      },
      data: {
        revoked: true,
        revoked_at: new Date(),
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
  createTokens,
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
  extendRefreshToken
};
