import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../services/redis.js';
import logger from '../services/logger.js';

// 通用限速中间件工厂函数
export const createRateLimit = (options = {}) => {
  // 等待Redis连接初始化
  if (!redis.client || !redis.isConnected) {
    logger.warn('Redis未连接，使用内存存储进行限速');
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000,
      max: options.max || 100,
      message: options.message || {
        status: 'error',
        message: '请求过于频繁，请稍后再试'
      },
      skip: (req) => process.env.NODE_ENV === 'development'
    });
  }

  const store = new RedisStore({
    // 使用Redis客户端实例
    client: redis.client,
    prefix: options.prefix || 'rate_limit:',
    // 添加sendCommand代理以支持rate-limit-redis
    sendCommand: (...args) => redis.client.call(...args)
  });

  return rateLimit({
    store,
    windowMs: options.windowMs || 15 * 60 * 1000, // 默认15分钟
    max: options.max || 100, // 默认限制100次请求
    message: options.message || {
      status: 'error',
      message: '请求过于频繁，请稍后再试'
    },
    // 添加错误处理
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP ${req.ip}`);
      res.status(429).json(options.message || {
        status: 'error',
        message: '请求过于频繁，请稍后再试'
      });
    },
    // 添加跳过函数
    skip: (req) => {
      // 开发环境跳过限速
      return process.env.NODE_ENV === 'development';
    }
  });
};

// 敏感操作限速
export const sensitiveActionLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制5次请求
  prefix: 'rate_limit:sensitive:',
  message: {
    status: 'error',
    message: '敏感操作过于频繁，请稍后再试'
  }
});

// OAuth相关限速
export const oauthRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 限制10次请求
  prefix: 'rate_limit:oauth:',
  message: {
    status: 'error',
    message: 'OAuth请求过于频繁，请稍后再试'
  }
});

// 导出默认的rateLimit函数
export { rateLimit };