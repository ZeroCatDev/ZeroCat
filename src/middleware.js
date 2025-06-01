import express from 'express';
import expressWinston from 'express-winston';
import cors from 'cors';
import bodyParser from 'body-parser';
import compress from 'compression';
import logger from '../services/logger.js';
import zcconfig from '../services/config/zcconfig.js';

/**
 * 配置Express应用的中间件
 * @param {express.Application} app Express应用实例
 */
export async function configureMiddleware(app) {
  // 日志中间件 - 只记录HTTP请求，避免重复记录应用日志
  app.use(
    expressWinston.logger({
      winstonInstance: logger,
      meta: true,
      msg: "HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}} {{req.ip}}",
      colorize: false,
      ignoreRoute: (req, res) => false,
      level: "info",
      // 避免重复日志，只记录请求级别的元数据
      metaField: null, // 不要记录元数据的子对象
      expressFormat: false, // 不使用express默认格式避免重复
      dynamicMeta: (req, res) => {
        // 只记录必要的请求元数据，避免重复
        return {
          reqId: req.id,
          method: req.method,
          url: req.url
        };
      }
    })
  );

  // CORS配置
  const corslist = (await zcconfig.get("cors"));
  const corsOptionsDelegate = (origin, callback) => {
    if (!origin || corslist.includes(new URL(origin).hostname)) {
      return callback(null, true);
    } else {
      logger.error("CORS限制，请求来源：" + origin);
      return callback(new Error("CORS限制，请求来源可能存在风险"));
    }
  };

  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => corsOptionsDelegate(origin, callback),
    })
  );

  // 请求体解析
  app.use(bodyParser.urlencoded({ limit: "100mb", extended: false }));
  app.use(bodyParser.json({ limit: "100mb" }));
  app.use(bodyParser.text({ limit: "100mb" }));
  app.use(bodyParser.raw({ limit: "100mb" }));

  // 压缩中间件
  app.use(compress());

  // 认证中间件 - 使用动态导入避免循环依赖
  app.use(async (req, res, next) => {
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
      // 动态导入auth工具，避免循环依赖
      const authModule = await import('../services/auth/auth.js');
      const authUtils = authModule.default;

      // 使用令牌验证系统，传递IP地址用于追踪
      const { valid, user, message } = await authUtils.verifyToken(token, req.ip);

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
      logger.error("解析令牌时出错:", err);
    }

    next();
  });
}