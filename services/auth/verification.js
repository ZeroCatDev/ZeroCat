import crypto from 'crypto';
import { TOTP } from 'otpauth';
import redisClient from '../redis.js';
import logger from '../logger.js';

// 验证码类型
export const VerificationType = {
  REGISTER: 'register',      // 注册
  LOGIN: 'login',            // 登录
  RESET_PASSWORD: 'reset',   // 重置密码
  ADD_EMAIL: 'add_email',    // 添加邮箱
  VERIFY_EMAIL: 'verify',    // 验证邮箱
  BIND_ACCOUNT: 'bind',      // 绑定账号
  PASSWORD_RESET: 'password_reset', // 找回密码
  CHANGE_EMAIL: 'change_email',     // 更改邮箱
};

// 创建TOTP实例
function createTotpInstance(secret) {
  return new TOTP({
    issuer: 'ZeroCat',
    label: '验证码',
    algorithm: 'SHA256',
    digits: 6,
    period: 300, // 5分钟有效期
    secret: secret // 确保传入的secret是有效的base32编码
  });
}

// 生成随机密钥 - 生成有效的Base32编码密钥
function generateSecret() {
  // Base32字符集只包含A-Z和2-7
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  // 生成32个字符的base32编码字符串
  for (let i = 0; i < 32; i++) {
    result += base32Chars.charAt(Math.floor(Math.random() * base32Chars.length));
  }
  return result;
}

// 生成验证码
export async function generateVerificationCode(identifier, type) {
  try {
    // 检查是否存在有效的验证码
    const existingKey = `verification:${type}:${identifier}`;
    const existing = await redisClient.get(existingKey);

    if (existing && existing.expiry > Date.now()) {
      return {
        success: true,
        code: existing.code,
        expiry: existing.expiry,
        isExisting: true
      };
    }

    // 生成新的验证码
    const secret = generateSecret();
    const totp = createTotpInstance(secret);
    const code = totp.generate();

    // 验证码过期时间 (5分钟)
    const expiry = Date.now() + (5 * 60 * 1000);

    // 存储到Redis
    await redisClient.set(existingKey, {
      code,
      secret,
      expiry,
      attempts: 0
    }, 300); // 5分钟过期

    return {
      success: true,
      code,
      expiry,
      isExisting: false
    };
  } catch (error) {
    logger.error(`生成验证码失败 [${identifier}:${type}]:`, error);
    return {
      success: false,
      message: '生成验证码失败'
    };
  }
}

// 验证验证码
export async function verifyCode(identifier, code, type) {
  try {
    const key = `verification:${type}:${identifier}`;
    const verification = await redisClient.get(key);

    if (!verification) {
      return {
        success: false,
        message: '验证码不存在或已过期'
      };
    }

    // 检查尝试次数
    if (verification.attempts >= 5) {
      await redisClient.delete(key);
      return {
        success: false,
        message: '验证码尝试次数过多，请重新获取'
      };
    }

    // 检查过期时间
    if (verification.expiry < Date.now()) {
      await redisClient.delete(key);
      return {
        success: false,
        message: '验证码已过期'
      };
    }

    // 验证码是否匹配
    if (verification.code !== code) {
      // 增加尝试次数
      verification.attempts += 1;
      await redisClient.set(key, verification, Math.ceil((verification.expiry - Date.now()) / 1000));

      return {
        success: false,
        message: '验证码错误',
        attemptsLeft: 5 - verification.attempts
      };
    }

    // 一次性使用，验证成功后删除
    await redisClient.delete(key);

    return {
      success: true
    };
  } catch (error) {
    logger.error(`验证码验证失败 [${identifier}:${type}]:`, error);
    return {
      success: false,
      message: '验证码验证失败'
    };
  }
}

// 检查验证码速率限制
export async function checkRateLimit(identifier, type = 'default') {
  try {
    const key = `rate_limit:${type}:${identifier}`;
    const count = await redisClient.get(key) || 0;

    if (count >= 5) {
      return {
        success: false,
        message: '发送验证码过于频繁，请稍后再试'
      };
    }

    // 增加计数并设置1小时过期
    await redisClient.set(key, count + 1, 3600);

    return {
      success: true,
      remaining: 5 - (count + 1)
    };
  } catch (error) {
    logger.error(`检查验证码速率限制失败 [${identifier}:${type}]:`, error);
    return {
      success: true, // 出错时放行
      remaining: 0
    };
  }
}

// 为用户创建临时令牌
export async function createTemporaryToken(userId, purpose = 'resend_email', additionalData = {}) {
  try {
    if (!userId) {
      logger.error('创建临时令牌失败: 未提供用户ID');
      return {
        success: false,
        message: '创建临时令牌失败: 未提供用户ID'
      };
    }

    // 生成一个随机令牌
    const token = crypto.randomBytes(32).toString('hex');

    // 令牌有效期为24小时
    const expiresIn = 86400; // 24小时 = 86400秒
    const expiry = Date.now() + expiresIn * 1000;
    const createdAt = Date.now();

    // 构建标准化的令牌数据结构
    const tokenData = {
      // 使用统一的字段名userId
      userId: userId,
      // 同时保留user_id以兼容可能使用该字段的代码
      user_id: userId,
      purpose,
      createdAt,
      expiry,
      ...additionalData // 合并附加数据
    };

    // 在Redis中存储令牌
    const key = `temp_token:${token}`;
    await redisClient.set(key, tokenData, expiresIn);

    // 记录创建的令牌信息
    logger.debug(`创建临时令牌成功 [${token.substring(0, 8)}...], userId=${userId}, purpose=${purpose}`);

    return {
      success: true,
      token,
      expiry,
      expiresIn
    };
  } catch (error) {
    logger.error(`创建临时令牌失败 [userId=${userId}, purpose=${purpose}]:`, error);
    logger.error(`错误堆栈: ${error.stack}`);
    return {
      success: false,
      message: '创建临时令牌失败',
      error: error.message
    };
  }
}

// 验证临时令牌
export async function validateTemporaryToken(token, purpose = 'resend_email') {
  if (!token) {
    logger.warn('尝试验证空令牌');
    return {
      success: false,
      message: '无效的令牌'
    };
  }

  const key = `temp_token:${token}`;

  try {
    // 从Redis获取令牌数据
    const tokenData = await redisClient.get(key);

    // 详细记录验证过程
    logger.debug(`验证临时令牌 [${token.substring(0, 8)}...], purpose=${purpose}, 数据存在=${!!tokenData}`);

    // 令牌不存在
    if (!tokenData) {
      return {
        success: false,
        message: '令牌不存在或已过期'
      };
    }

    // 记录令牌数据结构，帮助调试
    logger.debug(`令牌数据结构: ${JSON.stringify(Object.keys(tokenData))}`);

    // 检查令牌用途 - 允许用途为null的临时令牌
    if (tokenData.purpose && tokenData.purpose !== purpose) {
      logger.warn(`令牌用途不匹配: 期望=${purpose}, 实际=${tokenData.purpose}`);
      return {
        success: false,
        message: '无效的令牌用途'
      };
    }

    // 检查是否过期
    if (tokenData.expiry && tokenData.expiry < Date.now()) {
      await redisClient.delete(key);
      logger.warn(`令牌已过期: ${new Date(tokenData.expiry).toISOString()}`);
      return {
        success: false,
        message: '令牌已过期'
      };
    }

    // 统一返回格式，确保userId字段存在
    const userId = tokenData.userId || tokenData.user_id;
    if (!userId) {
      logger.warn('令牌数据中没有用户ID');
      return {
        success: false,
        message: '无效的令牌数据'
      };
    }

    // 返回成功结果
    return {
      success: true,
      userId: userId,
      data: tokenData
    };
  } catch (error) {
    // 详细记录错误
    logger.error(`验证临时令牌失败 [${token.substring(0, 8)}...]:`, error);
    logger.error(`错误堆栈: ${error.stack}`);

    // 尝试获取Redis键信息以帮助调试
    try {
      const exists = await redisClient.exists(key);
      logger.debug(`令牌键是否存在: ${exists}`);

      const ttl = await redisClient.ttl(key);
      logger.debug(`令牌剩余生存时间: ${ttl}秒`);
    } catch (redisError) {
      logger.error(`检查令牌Redis状态失败:`, redisError);
    }

    return {
      success: false,
      message: '令牌验证失败',
      error: error.message // 添加错误详情，辅助调试
    };
  }
}

// 标记临时令牌为已使用
export async function invalidateTemporaryToken(token) {
  try {
    const key = `temp_token:${token}`;
    await redisClient.delete(key);
    return {
      success: true
    };
  } catch (error) {
    logger.error(`标记临时令牌为已使用失败 [${token}]:`, error);
    return {
      success: false,
      message: '标记临时令牌为已使用失败'
    };
  }
}