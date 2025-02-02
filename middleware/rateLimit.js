import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const sensitiveActionLimiter = rateLimit({
  store: new RedisStore({
    client: redis
  }),
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制5次请求
  message: {
    status: 'error',
    message: '请求过于频繁，请稍后再试'
  }
}); 