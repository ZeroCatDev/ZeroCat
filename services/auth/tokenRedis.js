import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';
import zcconfig from '../config/zcconfig.js';
import redisClient from '../redis.js';
import logger from '../logger.js';
import { prisma } from '../global.js';

// 生成随机令牌
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 解析设备信息
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

// 创建新的访问令牌和刷新令牌
async function createTokens(userId, userInfo, ipAddress, userAgent) {
  try {
    // 设置访问令牌有效期为15分钟，刷新令牌默认30天
    const accessTokenExpiry = 15 * 60; // 15分钟

    // 获取刷新令牌过期时间，如果无法解析则使用默认值
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

    // 生成随机令牌
    const accessToken = generateToken();
    const refreshToken = generateToken(40);
    const tokenId = crypto.randomBytes(16).toString('hex');

    // 计算过期时间
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + accessTokenExpiry * 1000);
    const refreshTokenExpiresAt = new Date(now + refreshTokenExpiry * 1000);

    logger.debug(`令牌过期时间: accessTokenExpiresAt=${accessTokenExpiresAt.toISOString()}, refreshTokenExpiresAt=${refreshTokenExpiresAt.toISOString()}`);

    // 存储令牌信息到Redis
    const tokenData = {
      id: tokenId,
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
    };

    // 访问令牌Redis键
    const accessTokenKey = `token:access:${accessToken}`;
    await redisClient.set(accessTokenKey, {
      token_id: tokenId,
      user_id: userId
    }, accessTokenExpiry);

    // 刷新令牌Redis键
    const refreshTokenKey = `token:refresh:${refreshToken}`;
    await redisClient.set(refreshTokenKey, {
      token_id: tokenId,
      user_id: userId
    }, refreshTokenExpiry);

    // 令牌详情Redis键
    const tokenKey = `token:details:${tokenId}`;
    await redisClient.set(tokenKey, tokenData, refreshTokenExpiry);

    // 用户令牌列表Redis键
    const userTokensKey = `user:tokens:${userId}`;
    const userTokens = await redisClient.get(userTokensKey) || [];
    userTokens.push(tokenId);
    await redisClient.set(userTokensKey, userTokens);

    // 同时存储到数据库（可选，用于持久化）
    try {
      await prisma.ow_auth_tokens.create({
        data: {
          id: tokenId,
          user_id: userId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: accessTokenExpiresAt,
          refresh_expires_at: refreshTokenExpiresAt,
          ip_address: ipAddress,
          user_agent: userAgent?.substring(0, 255) || null,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          created_at: new Date(),
          last_used_at: new Date(),
          last_used_ip: ipAddress,
          activity_count: 0
        }
      });
    } catch (dbError) {
      logger.error("将令牌存储到数据库时出错:", dbError);
      // 继续使用Redis中的令牌，不中断流程
    }

    // 创建JWT
    const jwtPayload = {
      ...userInfo,
      token_id: tokenId,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
    };

    const jwtSecret = await zcconfig.get("security.jwttoken");
    const jwt = jsonwebtoken.sign(jwtPayload, jwtSecret);

    // 检查并确保返回对象中的所有字段都有值
    const result = {
      accessToken: jwt,
      refreshToken,
      expiresAt: accessTokenExpiresAt,
      refreshExpiresAt: refreshTokenExpiresAt
    };

    // 日志记录返回数据的可用性
    logger.debug(`创建令牌结果: accessToken=${!!result.accessToken}, refreshToken=${!!result.refreshToken}, expiresAt=${!!result.expiresAt}, refreshExpiresAt=${!!result.refreshExpiresAt}`);

    return result;
  } catch (error) {
    logger.error("创建令牌时出错:", error);
    logger.error(`错误堆栈: ${error.stack}`);
    throw error;
  }
}

// 验证令牌
async function verifyToken(token) {
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

    // 从Redis获取令牌详情
    const tokenKey = `token:details:${tokenId}`;
    const tokenData = await redisClient.get(tokenKey);

    if (!tokenData) {
      return {
        valid: false,
        message: "令牌不存在或已过期 #2"
      };
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

    return {
      valid: true,
      userId,
      tokenId,
      tokenData
    };
  } catch (error) {
    logger.error("验证令牌时出错:", error);
    return {
      valid: false,
      message: "验证令牌时出错"
    };
  }
}

// 撤销令牌
async function revokeToken(tokenId) {
  try {
    // 从Redis获取令牌详情
    const tokenKey = `token:details:${tokenId}`;
    const tokenData = await redisClient.get(tokenKey);

    if (!tokenData) {
      return {
        success: false,
        message: "令牌不存在或已过期 #1"
      };
    }

    if (tokenData.revoked) {
      return {
        success: true,
        message: "令牌已被撤销"
      };
    }

    // 撤销令牌
    tokenData.revoked = true;
    tokenData.revoked_at = Date.now();
    tokenData.revoked_reason = "user_logout";

    // 更新Redis
    await redisClient.set(tokenKey, tokenData, Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000));

    // 删除访问令牌和刷新令牌的引用
    await redisClient.delete(`token:access:${tokenData.access_token}`);
    await redisClient.delete(`token:refresh:${tokenData.refresh_token}`);

    // 更新数据库（可选，用于持久化）
    try {
      await prisma.ow_auth_tokens.update({
        where: { id: tokenId },
        data: {
          revoked: true,
          revoked_at: new Date(),
          revoked_reason: "user_logout"
        }
      });
    } catch (dbError) {
      logger.error("更新数据库中的令牌时出错:", dbError);
      // 继续使用Redis中的更新，不中断流程
    }

    return {
      success: true,
      message: "令牌已成功撤销"
    };
  } catch (error) {
    logger.error("撤销令牌时出错:", error);
    return {
      success: false,
      message: "撤销令牌时出错"
    };
  }
}

// 撤销用户的所有令牌（可选排除当前令牌）
async function logout(userId, excludeTokenId = null) {
  try {
    // 获取用户的所有令牌
    const userTokensKey = `user:tokens:${userId}`;
    const tokenIds = await redisClient.get(userTokensKey) || [];

    // 筛选需要撤销的令牌（排除当前令牌）
    const tokensToRevoke = excludeTokenId
      ? tokenIds.filter(id => id !== excludeTokenId)
      : tokenIds;

    // 记录撤销的令牌数量
    let revokedCount = 0;

    // 撤销每个令牌
    for (const tokenId of tokensToRevoke) {
      const tokenKey = `token:details:${tokenId}`;
      const tokenData = await redisClient.get(tokenKey);

      if (tokenData && !tokenData.revoked) {
        // 撤销令牌
        tokenData.revoked = true;
        tokenData.revoked_at = Date.now();
        tokenData.revoked_reason = "user_logout_all";

        // 更新Redis
        await redisClient.set(tokenKey, tokenData, Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000));

        // 删除访问令牌和刷新令牌的引用
        await redisClient.delete(`token:access:${tokenData.access_token}`);
        await redisClient.delete(`token:refresh:${tokenData.refresh_token}`);

        revokedCount++;
      }
    }

    // 更新数据库（可选，用于持久化）
    try {
      await prisma.ow_auth_tokens.updateMany({
        where: {
          user_id: userId,
          revoked: false,
          ...(excludeTokenId ? { id: { not: excludeTokenId } } : {})
        },
        data: {
          revoked: true,
          revoked_at: new Date(),
          revoked_reason: "user_logout_all"
        }
      });
    } catch (dbError) {
      logger.error("更新数据库中的令牌时出错:", dbError);
      // 继续使用Redis中的更新，不中断流程
    }

    return {
      success: true,
      message: "已成功登出所有设备",
      count: revokedCount
    };
  } catch (error) {
    logger.error("登出所有设备时出错:", error);
    return {
      success: false,
      message: "登出所有设备时出错"
    };
  }
}

// 使用刷新令牌生成新的访问令牌
async function refreshAccessToken(refreshToken, ipAddress, userAgent) {
  try {
    // 从Redis获取刷新令牌
    const refreshTokenKey = `token:refresh:${refreshToken}`;
    const refreshTokenData = await redisClient.get(refreshTokenKey);

    if (!refreshTokenData) {
      logger.warn(`刷新令牌不存在: ${refreshToken.substring(0, 8)}...`);
      return {
        success: false,
        message: "无效的刷新令牌"
      };
    }

    const { token_id, user_id } = refreshTokenData;

    // 获取令牌详情
    const tokenKey = `token:details:${token_id}`;
    const tokenData = await redisClient.get(tokenKey);

    if (!tokenData || tokenData.revoked) {
      logger.warn(`刷新令牌已被撤销: ${refreshToken.substring(0, 8)}...`);
      return {
        success: false,
        message: "刷新令牌已被撤销"
      };
    }

    // 检查刷新令牌是否过期
    if (tokenData.refresh_expires_at < Date.now()) {
      logger.warn(`刷新令牌已过期: ${refreshToken.substring(0, 8)}...`);
      return {
        success: false,
        message: "刷新令牌已过期"
      };
    }

    // 设置访问令牌有效期为15分钟
    const accessTokenExpiry = 15 * 60; // 15分钟

    // 生成新的访问令牌
    const newAccessToken = generateToken();
    const accessTokenExpiresAt = new Date(Date.now() + accessTokenExpiry * 1000);

    // 更新令牌数据
    tokenData.access_token = newAccessToken;
    tokenData.expires_at = accessTokenExpiresAt.getTime();
    tokenData.last_used_at = Date.now();
    tokenData.last_used_ip = ipAddress;
    tokenData.activity_count += 1;

    // 更新Redis中的令牌详情
    await redisClient.set(tokenKey, tokenData, Math.floor((tokenData.refresh_expires_at - Date.now()) / 1000));

    // 创建新的访问令牌引用
    const accessTokenKey = `token:access:${newAccessToken}`;
    await redisClient.set(accessTokenKey, {
      token_id,
      user_id
    }, accessTokenExpiry);

    // 获取用户信息
    const user = await prisma.ow_users.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      logger.error(`刷新令牌对应的用户不存在: ${user_id}`);
      return {
        success: false,
        message: "用户不存在"
      };
    }

    // 获取用户的主要邮箱
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: "email",
        is_primary: true,
      },
    });

    // 构建用户信息对象
    const userInfo = {
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: primaryEmail?.contact_value,
    };

    // 创建JWT
    const jwtPayload = {
      ...userInfo,
      token_id,
      exp: Math.floor(accessTokenExpiresAt.getTime() / 1000),
    };

    const jwtSecret = await zcconfig.get("security.jwttoken");
    const jwt = jsonwebtoken.sign(jwtPayload, jwtSecret);

    // 更新数据库（可选，用于持久化）
    try {
      await prisma.ow_auth_tokens.update({
        where: { id: token_id },
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
    } catch (dbError) {
      logger.error("更新数据库中的令牌时出错:", dbError);
      // 继续使用Redis中的更新，不中断流程
    }

    // 确保包含刷新令牌过期时间
    const refreshExpiresAt = new Date(tokenData.refresh_expires_at);

    logger.debug(`刷新令牌成功: 用户=${user_id}, 新令牌=${newAccessToken.substring(0, 8)}..., 访问令牌过期=${accessTokenExpiresAt.toISOString()}, 刷新令牌过期=${refreshExpiresAt.toISOString()}`);

    return {
      success: true,
      accessToken: jwt,
      expiresAt: accessTokenExpiresAt,
      refreshExpiresAt: refreshExpiresAt
    };
  } catch (error) {
    logger.error("刷新令牌时出错:", error);
    logger.error(`错误堆栈: ${error.stack}`);
    return {
      success: false,
      message: "刷新令牌时出错"
    };
  }
}

// 获取用户的所有活跃令牌
async function getUserActiveTokens(userId) {
  try {
    // 获取用户的所有令牌ID
    const userTokensKey = `user:tokens:${userId}`;
    const tokenIds = await redisClient.get(userTokensKey) || [];

    // 获取所有令牌详情
    const tokens = [];
    for (const tokenId of tokenIds) {
      const tokenKey = `token:details:${tokenId}`;
      const tokenData = await redisClient.get(tokenKey);

      // 过滤有效的令牌（未撤销且未过期）
      if (tokenData && !tokenData.revoked && tokenData.refresh_expires_at > Date.now()) {
        tokens.push(tokenData);
      }
    }

    // 按最后使用时间排序
    tokens.sort((a, b) => b.last_used_at - a.last_used_at);

    return tokens;
  } catch (error) {
    logger.error("获取用户活跃令牌时出错:", error);
    throw error;
  }
}

// 获取令牌详情
async function getTokenDetails(tokenId) {
  try {
    const tokenKey = `token:details:${tokenId}`;
    const tokenData = await redisClient.get(tokenKey);

    if (!tokenData) {
      return null;
    }

    return tokenData;
  } catch (error) {
    logger.error("获取令牌详情时出错:", error);
    return null;
  }
}

// 清理过期的令牌
async function cleanupExpiredTokens() {
  // 注意：Redis会自动过期键，所以不需要额外的清理逻辑
  // 但可以同步清理数据库中的过期令牌
  try {
    const now = new Date();
    const result = await prisma.ow_auth_tokens.updateMany({
      where: {
        revoked: false,
        refresh_expires_at: { lt: now }
      },
      data: {
        revoked: true,
        revoked_at: now,
        revoked_reason: "expired"
      }
    });

    return {
      success: true,
      count: result.count
    };
  } catch (error) {
    logger.error("清理过期令牌时出错:", error);
    return {
      success: false,
      message: "清理过期令牌时出错"
    };
  }
}

export default {
  createTokens,
  verifyToken,
  refreshAccessToken,
  revokeToken,
  logout,
  getUserActiveTokens,
  getTokenDetails,
  cleanupExpiredTokens,
  parseDeviceInfo
};