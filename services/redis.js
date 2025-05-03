import Redis from 'ioredis';
import logger from './logger.js';
import zcconfig from './config/zcconfig.js';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.initConnection();
  }

  async initConnection() {
    try {
      const host = await zcconfig.get('redis.host')||'localhost';
      const port = await zcconfig.get('redis.port')||6379;
      const password = await zcconfig.get('redis.password')||'';
      const db = 0;

      const options = {
        host,
        port,
        db: parseInt(db),
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      };

      if (password) {
        options.password = password;
      }

      this.client = new Redis(options);

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis连接成功');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('Redis连接错误:', err);
      });

      this.client.on('reconnecting', () => {
        logger.info('正在重新连接Redis...');
      });
    } catch (error) {
      logger.error('初始化Redis连接失败:', error);
    }
  }

  // 设置键值，支持过期时间（秒）
  async set(key, value, ttlSeconds = null) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error(`Redis set错误 [${key}]:`, error);
      return false;
    }
  }

  // 获取键值
  async get(key) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch (e) {
        return value; // 如果不是JSON则返回原始值
      }
    } catch (error) {
      logger.error(`Redis get错误 [${key}]:`, error);
      return null;
    }
  }

  // 删除键
  async delete(key) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete错误 [${key}]:`, error);
      return false;
    }
  }

  // 检查键是否存在
  async exists(key) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Redis exists错误 [${key}]:`, error);
      return false;
    }
  }

  // 设置键的过期时间
  async expire(key, ttlSeconds) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      logger.error(`Redis expire错误 [${key}]:`, error);
      return false;
    }
  }

  // 获取键的过期时间
  async ttl(key) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis ttl错误 [${key}]:`, error);
      return -2; // -2表示键不存在
    }
  }

  // 递增
  async incr(key) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis incr错误 [${key}]:`, error);
      return null;
    }
  }

  // 递增指定值
  async incrby(key, increment) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis未连接');
      }

      return await this.client.incrby(key, increment);
    } catch (error) {
      logger.error(`Redis incrby错误 [${key}]:`, error);
      return null;
    }
  }
}

// 创建单例实例
const redisClient = new RedisService();

export default redisClient;