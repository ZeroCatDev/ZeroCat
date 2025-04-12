import logger from "../../utils/logger.js";
import authUtils from "../../utils/auth.js";
import { prisma } from "../../utils/global.js";
import ipLocation from "../../utils/ipLocation.js";

/**
 * 刷新令牌
 */
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        status: "error",
        message: "刷新令牌是必需的"
      });
    }

    const result = await authUtils.refreshAccessToken(
      refresh_token,
      req.ip,
      req.headers["user-agent"]
    );

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "令牌已刷新",
        token: result.accessToken,
        expires_at: result.expiresAt
      });
    } else {
      return res.status(401).json({
        status: "error",
        message: result.message || "刷新令牌失败"
      });
    }
  } catch (error) {
    logger.error("刷新令牌时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "刷新令牌失败"
    });
  }
};

/**
 * 获取令牌详情
 */
export const getTokenDetails = async (req, res) => {
  try {
    const userId = res.locals.userid;
    const { tokenId } = req.params;
    const includeLocation = req.query.include_location === 'true';

    // 验证令牌ID格式
    const tokenIdNumber = parseInt(tokenId);
    if (isNaN(tokenIdNumber)) {
      return res.status(400).json({
        status: "error",
        message: "无效的令牌ID格式"
      });
    }

    // 获取令牌详情
    const token = await prisma.ow_auth_tokens.findFirst({
      where: {
        id: tokenIdNumber,
        user_id: userId
      },
    });

    if (!token) {
      return res.status(404).json({
        status: "error",
        message: "未找到令牌或无权查看"
      });
    }

    // 按需获取位置信息
    let ipLocationInfo = null;
    let lastUsedIpLocationInfo = null;

    if (includeLocation) {
      // 如果有IP地址，则获取其位置信息
      if (token.ip_address) {
        try {
          ipLocationInfo = await ipLocation.getIPLocation(token.ip_address);
        } catch (e) {
          logger.error(`获取IP ${token.ip_address} 位置信息时出错:`, e);
        }
      }

      // 如果有最后使用IP，且与创建IP不同，则获取其位置信息
      if (token.last_used_ip && token.last_used_ip !== token.ip_address) {
        try {
          lastUsedIpLocationInfo = await ipLocation.getIPLocation(token.last_used_ip);
        } catch (e) {
          logger.error(`获取IP ${token.last_used_ip} 位置信息时出错:`, e);
        }
      } else if (token.last_used_ip) {
        // 如果最后使用IP与创建IP相同，复用创建IP的位置信息
        lastUsedIpLocationInfo = ipLocationInfo;
      }
    }

    // 解析设备信息
    let deviceInfo = null;
    try {
      if (token.device_info) {
        deviceInfo = JSON.parse(token.device_info);
      }
    } catch (e) {
      logger.error(`解析设备信息时出错:`, e);
    }

    // 格式化响应数据
    const tokenDetails = {
      id: token.id,
      created_at: token.created_at,
      expires_at: token.expires_at,
      refresh_expires_at: token.refresh_expires_at,
      last_used_at: token.last_used_at,
      activity_count: token.activity_count,
      extended_at: token.extended_at,
      revoked: token.revoked,
      revoked_at: token.revoked_at,
      ip_address: token.ip_address,
      ip_location: ipLocationInfo,
      last_used_ip: token.last_used_ip,
      last_used_ip_location: lastUsedIpLocationInfo,
      device_info: deviceInfo,
      is_current: token.id === res.locals.tokenId
    };

    return res.status(200).json({
      status: "success",
      data: tokenDetails
    });
  } catch (error) {
    logger.error("获取令牌详情时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "获取令牌详情失败"
    });
  }
};

/**
 * 获取活跃令牌列表
 */
export const getActiveTokens = async (req, res) => {
  try {
    const userId = res.locals.userid;

    const tokens = await authUtils.getUserActiveTokens(userId);

    // 处理位置信息 - 默认不获取位置
    const includeLocation = req.query.include_location === 'true';

    // 打包令牌信息结果
    const formattedTokens = await Promise.all(tokens.map(async token => {
      let ipLocationInfo = null;
      let lastUsedIpLocationInfo = null;

      // 如果请求包含位置信息，则实时获取
      if (includeLocation) {
        if (token.ip_address) {
          try {
            ipLocationInfo = await ipLocation.getIPLocation(token.ip_address);
          } catch (e) {
            logger.error(`获取IP ${token.ip_address} 位置信息时出错:`, e);
          }
        }

        // 如果最后使用IP与创建IP不同，则获取其位置信息
        if (token.last_used_ip && token.last_used_ip !== token.ip_address) {
          try {
            lastUsedIpLocationInfo = await ipLocation.getIPLocation(token.last_used_ip);
          } catch (e) {
            logger.error(`获取IP ${token.last_used_ip} 位置信息时出错:`, e);
          }
        } else if (token.last_used_ip) {
          // 如果最后使用IP与创建IP相同，复用创建IP的位置信息
          lastUsedIpLocationInfo = ipLocationInfo;
        }
      }

      // 解析设备信息
      let deviceInfo = null;
      try {
        if (token.device_info) {
          deviceInfo = JSON.parse(token.device_info);
        }
      } catch (e) {
        logger.error(`解析设备信息时出错:`, e);
      }

      return {
        id: token.id,
        created_at: token.created_at,
        expires_at: token.expires_at,
        refresh_expires_at: token.refresh_expires_at,
        last_used_at: token.last_used_at,
        activity_count: token.activity_count,
        extended_at: token.extended_at,
        ip_address: token.ip_address,
        ip_location: ipLocationInfo,
        last_used_ip: token.last_used_ip,
        last_used_ip_location: lastUsedIpLocationInfo,
        device_info: deviceInfo,
        is_current: token.id === res.locals.tokenId
      };
    }));

    return res.status(200).json({
      status: "success",
      message: "获取成功",
      data: formattedTokens
    });
  } catch (error) {
    logger.error("获取活跃令牌列表时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "获取活跃令牌列表失败"
    });
  }
};

/**
 * 吊销特定令牌
 */
export const revokeToken = async (req, res) => {
  try {
    const { token_id } = req.body;
    const userId = res.locals.userid;

    if (!token_id) {
      return res.status(400).json({
        status: "error",
        message: "令牌ID是必需的"
      });
    }

    // 验证令牌是否属于当前用户
    const tokenRecord = await prisma.ow_auth_tokens.findFirst({
      where: {
        id: token_id,
        user_id: userId
      }
    });

    if (!tokenRecord) {
      return res.status(403).json({
        status: "error",
        message: "无权操作此令牌"
      });
    }

    const result = await authUtils.revokeToken(token_id);

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "令牌已成功吊销"
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: result.message || "吊销令牌失败"
      });
    }
  } catch (error) {
    logger.error("吊销令牌时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "吊销令牌失败"
    });
  }
};