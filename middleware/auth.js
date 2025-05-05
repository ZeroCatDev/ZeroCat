import jsonwebtoken from "jsonwebtoken";
import zcconfig from "../services/config/zcconfig.js";
import logger from "../services/logger.js";
import { verifyToken, updateTokenActivity } from "../services/auth/tokenUtils.js";
import { prisma } from "../services/global.js";

/**
 * 验证令牌在数据库中的有效性
 * @param {string} tokenId 令牌ID
 * @param {string} ipAddress 请求IP地址
 * @returns {Promise<{valid: boolean, message: string, tokenRecord: object|null}>} 验证结果
 */
const validateTokenInDatabase = async (tokenId, ipAddress = null) => {
  try {
    // 检查令牌是否已被吊销
    const tokenRecord = await prisma.ow_auth_tokens.findFirst({
      where: {
        id: tokenId,
        revoked: false,
      },
    });

    if (!tokenRecord) {
      return {
        valid: false,
        message: "令牌已被吊销或不存在",
        tokenRecord: null,
      };
    }

    // 检查令牌是否过期
    if (tokenRecord.expires_at < new Date()) {
      return {
        valid: false,
        message: "令牌已过期",
        tokenRecord: null,
      };
    }

    // 如果提供了IP地址，更新令牌的活动记录
    if (ipAddress) {
      // 使用单独的变量避免影响函数返回
      updateTokenActivity(tokenId, ipAddress)
        .catch((err) => logger.error("更新令牌活动记录时出错:", err));
    }

    return {
      valid: true,
      message: "令牌有效",
      tokenRecord,
    };
  } catch (error) {
    logger.error("验证令牌在数据库中的状态时出错:", error);
    return {
      valid: false,
      message: "验证令牌时发生错误",
      tokenRecord: null,
    };
  }
};

/**
 * 解析token中间件
 * 从请求中提取token并验证
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const parseToken = async (req, res, next) => {
  // 尝试从多种来源获取token：
  // 1. Authorization header (Bearer token)
  // 2. Query parameter 'token'
  // 3. Cookie 'token'
  let token = null;

  // 检查Authorization header
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    // 支持"Bearer token"格式或直接提供token
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1];
    } else {
      token = authHeader;
    }
  }

  // 如果header中没有token，检查query参数
  if (!token && req.query.token) {
    token = req.query.token;
  }

  // 如果query中没有token，检查cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    // 没有令牌，继续处理请求但不设置用户信息
    return next();
  }

  try {
    // 使用新的令牌验证系统，传递IP地址用于追踪
    const { valid, user, message } = await verifyToken(token, req.ip);

    if (valid && user) {
      // 设置用户信息
      res.locals.userid = user.userid;
      res.locals.username = user.username;
      res.locals.display_name = user.display_name;
      res.locals.email = user.email;
      res.locals.tokenId = user.token_id;
    } else {
      logger.debug(`令牌验证失败: ${message}`);
    }
  } catch (err) {
    logger.debug("解析令牌时出错:", err);
  }

  next();
};

/**
 * 严格模式token中间件
 * 确保用户已登录，并且令牌有效（未被吊销）
 * 在请求处理前同步验证令牌有效性
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const strictTokenCheck = async (req, res, next) => {
  // 由于 parseToken 已经处理了获取令牌和基本验证的工作，
  // 我们只需要检查用户是否已登录和令牌是否有效

  if (!res.locals.userid || !res.locals.tokenId) {
    return res.status(401).json({
      status: "error",
      message: "未提供有效的授权令牌",
      code: 401,
    });
  }

  try {
    // 重新验证令牌有效性
    const token = req.headers["authorization"]?.split(" ")[1] ||
                 req.query.token ||
                 req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "未提供授权令牌",
        code: 401,
      });
    }

    const { valid, message } = await verifyToken(token, req.ip);

    if (!valid) {
      return res.status(401).json({
        status: "error",
        message: message,
        code: 401,
      });
    }

    next();
  } catch (err) {
    logger.error("验证令牌吊销状态时出错:", err);
    return res.status(500).json({
      status: "error",
      message: "服务器错误",
      code: 500,
    });
  }
};

/**
 * 需要登录的中间件
 * 检查用户是否已登录，但异步验证令牌有效性
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const needLogin = async (req, res, next) => {
  if (!res.locals.userid) {
    if (req.headers["accept"]?.includes("application/json")) {
      return res.status(401).send({
        status: "error",
        message: "需要登录",
        code: 'ZC_ERROR_NEED_LOGIN',
      });
    } else {
      return res.redirect("/login");
    }
  }

  // 异步验证令牌在数据库中的状态
  // 这不会阻塞请求继续处理
  if (res.locals.tokenId) {
    // 获取令牌
    const token = req.headers["authorization"]?.split(" ")[1] ||
                 req.query.token ||
                 req.cookies?.token;

    if (token) {
      verifyToken(token, req.ip)
        .then(({ valid, message }) => {
          if (!valid) {
            logger.debug(`用户 ${res.locals.userid} 使用无效令牌: ${message}`);
          }
        })
        .catch((err) => {
          logger.debug("异步验证令牌时出错:", err);
        });
    }
  }

  next();
};

/**
 * 需要管理员权限的中间件
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const needAdmin = async (req, res, next) => {
  if (!res.locals.userid) {
    if (req.headers["accept"]?.includes("application/json")) {
      return res.status(401).send({
        status: "error",
        message: "需要登录",
        code: 'ZC_ERROR_NEED_LOGIN',
      });
    } else {
      return res.redirect("/login");
    }
  }

  try {
    const adminConfig = await zcconfig.get(
      "security.adminusers",
      ""
    );
    const adminUsers = adminConfig.split(",").map((id) => id.trim());

    if (!adminUsers.includes(res.locals.userid.toString())) {
      return res.status(403).json({
        status: "error",
        message: "需要管理员权限",
        code: 403,
      });
    }

    next();
  } catch (err) {
    logger.error("验证管理员权限时出错:", err);
    return res.status(500).json({
      status: "error",
      message: "服务器错误",
      code: 500,
    });
  }
};
