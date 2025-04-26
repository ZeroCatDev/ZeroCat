import express from 'express';
import expressWinston from 'express-winston';
import cors from 'cors';
import bodyParser from 'body-parser';
import compress from 'compression';
import { parseToken } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';
import configManager from '../../utils/configManager.js';

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
  const corslist = (await configManager.getConfig("cors")).split(",");
  const corsOptionsDelegate = (origin, callback) => {
    if (!origin || corslist.includes(new URL(origin).hostname)) {
      return callback(null, true);
    } else {
      logger.error("Not allowed by CORS");
      return callback(new Error("Not allowed by CORS"));
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

  // 认证中间件
  app.use(parseToken);
}