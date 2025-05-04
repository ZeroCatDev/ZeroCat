import logger from '../logger.js';
import { prisma } from '../global.js';
import jsonwebtoken from 'jsonwebtoken';
import zcconfig from '../config/zcconfig.js';
import crypto from 'crypto';
import { createEvent, TargetTypes } from '../../controllers/events.js';

/**
 * 生成随机令牌
 * @param {number} length 令牌长度
 * @returns {string} 生成的随机令牌
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 解析设备信息
 * @param {string} userAgent 用户代理字符串
 * @returns {object} 解析后的设备信息
 */
function parseDeviceInfo(userAgent) {
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
      refreshTokenExpiry = parseInt(await zcconfig.get("security.refresh_token_expiry"), 10);
      if (isNaN(refreshTokenExpiry) || refreshTokenExpiry <= 0) {
        logger.warn(`无效的刷新令牌过期时间配置: ${await zcconfig.get("security.refresh_token_expiry")}, 使用默认值30天`);
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

    // 创建JWT
    const jwtPayload = {
      ...userInfo,
      token_id: tokenRecord.id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    };

    const jwtSecret = await zcconfig.get("security.jwttoken");
    const jwt = jsonwebtoken.sign(jwtPayload, jwtSecret);

    // 可选: 记录登录事件
    if (options.recordLoginEvent) {
      try {
        await createEvent("user_login", userId, TargetTypes.USER, userId, {
          event_type: "user_login",
          actor_id: userId,
          target_type: TargetTypes.USER,
          target_id: userId,
          method: options.loginMethod || "token",
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
 * 获取并标准化用户信息，用于创建令牌
 * @param {object} user 用户对象
 * @param {string} email 用户邮箱
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
      avatar: user.images,
      email: email
    };
  } catch (error) {
    logger.error(`获取用户标准信息失败: ${error.message}`);
    // 返回基础信息，忽略邮箱
    return {
      userid: parseInt(user.id),
      username: user.username,
      display_name: user.display_name || user.username,
      avatar: user.images
    };
  }
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
    avatar: user.images,
    email: email,
    token: tokenResult.accessToken,
    refresh_token: tokenResult.refreshToken,
    expires_at: tokenResult.expiresAt,
    refresh_expires_at: tokenResult.refreshExpiresAt,
    ...additionalData
  };
}

export default {
  createUserLoginTokens,
  getUserInfoForToken,
  generateLoginResponse,
  parseDeviceInfo,
  generateToken
};