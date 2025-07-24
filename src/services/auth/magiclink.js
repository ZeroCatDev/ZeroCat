import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';
import zcconfig from '../config/zcconfig.js';
import redisClient from '../redis.js';
import logger from '../logger.js';
import {sendEmail} from '../email/emailService.js';
import {checkRateLimit, VerificationType} from './verification.js';
import {createJWT} from './tokenUtils.js';

// 生成魔术链接
export async function generateMagicLinkForLogin(userId, email, options = {}) {
    try {
        // 默认10分钟过期
        const expiresIn = options.expiresIn || 600;

        // 客户端ID用于区分不同客户端的魔术链接
        const clientId = options.clientId || crypto.randomBytes(16).toString('hex');

        // 使用统一的JWT创建函数
        const token = await createJWT({
            id: userId,
            email,
            type: 'magic_link',
            clientId
        }, expiresIn);

        // 存储到Redis
        const redisKey = `magic_link:${token}`;
        await redisClient.set(redisKey, {
            userId,
            email,
            clientId,
            used: false,
            createdAt: Date.now()
        }, expiresIn);

        // 生成链接
        const frontendUrl = await zcconfig.get('urls.frontend');
        const magicLink = `${frontendUrl}/app/account/magiclink/validate?token=${token}${options.redirect ? `&redirect=${encodeURIComponent(options.redirect)}` : ''}`;

        return {
            success: true,
            token,
            magicLink,
            expiresIn
        };
    } catch (error) {
        logger.error('生成魔术链接失败:', error);
        return {
            success: false,
            message: '生成魔术链接失败'
        };
    }
}

// 发送魔术链接邮件
export async function sendMagicLinkEmail(email, magicLink, options = {}) {
    try {
        const templateType = options.templateType || 'login';
        let subject, content;

        switch (templateType) {
            case 'register':
                subject = '完成您的账户注册';
                content = `
          <h2>完成您的账户注册</h2>
          <p>您好，感谢您注册我们的服务！</p>
          <p>请点击以下链接完成账户设置：</p>
          <p><a href="${magicLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">完成注册</a></p>
          <p>或者您可以复制以下链接到浏览器地址栏：</p>
          <p>${magicLink}</p>
          <p>此链接将在10分钟内有效。</p>
          <p>如果这不是您的操作，请忽略此邮件。</p>
        `;
                break;

            case 'password_reset':
                subject = '重置您的密码';
                content = `
          <h2>密码重置请求</h2>
          <p>您好，我们收到了重置您密码的请求。</p>
          <p>请点击以下链接设置新密码：</p>
          <p><a href="${magicLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">重置密码</a></p>
          <p>或者您可以复制以下链接到浏览器地址栏：</p>
          <p>${magicLink}</p>
          <p>此链接将在10分钟内有效。</p>
          <p>如果这不是您的操作，请忽略此邮件并考虑修改您的密码。</p>
        `;
                break;

            default: // login
                subject = '魔术链接登录';
                content = `
          <h2>魔术链接登录请求</h2>
          <p>您好，您请求了使用魔术链接登录。</p>
          <p>请点击以下链接登录：</p>
          <p><a href="${magicLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">登录</a></p>
          <p>或者您可以复制以下链接到浏览器地址栏：</p>
          <p>${magicLink}</p>
          <p>此链接将在10分钟内有效。</p>
          <p>如果这不是您的操作，请忽略此邮件并考虑修改您的密码。</p>
        `;
                break;
        }

        await sendEmail(email, subject, content);

        return {
            success: true
        };
    } catch (error) {
        logger.error('发送魔术链接邮件失败:', error);
        return {
            success: false,
            message: '发送魔术链接邮件失败'
        };
    }
}

// 验证魔术链接
export async function validateMagicLinkAndLogin(token) {
    try {
        // 检查Redis中的状态
        const redisKey = `magic_link:${token}`;
        const magicLinkData = await redisClient.get(redisKey);

        if (!magicLinkData) {
            return {
                success: false,
                message: '魔术链接不存在或已过期'
            };
        }

        if (magicLinkData.used) {
            return {
                success: false,
                message: '此魔术链接已被使用'
            };
        }

        // 验证JWT
        const jwtSecret = await zcconfig.get('security.jwttoken');
        let decoded;

        try {
            decoded = jsonwebtoken.verify(token, jwtSecret);
        } catch (err) {
            return {
                success: false,
                message: '魔术链接已过期或无效'
            };
        }

        return {
            success: true,
            userId: decoded.id,
            email: decoded.email,
            clientId: decoded.clientId,
            data: magicLinkData
        };
    } catch (error) {
        logger.error('验证魔术链接失败:', error);
        return {
            success: false,
            message: '验证魔术链接失败'
        };
    }
}

// 标记魔术链接为已使用
export async function markMagicLinkAsUsed(token) {
    try {
        const redisKey = `magic_link:${token}`;
        const magicLinkData = await redisClient.get(redisKey);

        if (!magicLinkData) {
            return {
                success: false,
                message: '魔术链接不存在或已过期'
            };
        }

        if (magicLinkData.used) {
            return {
                success: false,
                message: '此魔术链接已被使用'
            };
        }

        // 标记为已使用
        magicLinkData.used = true;
        magicLinkData.usedAt = Date.now();

        // 更新Redis，保持原过期时间
        const ttl = await redisClient.ttl(redisKey);
        if (ttl > 0) {
            await redisClient.set(redisKey, magicLinkData, ttl);
        }

        return {
            success: true
        };
    } catch (error) {
        logger.error('标记魔术链接为已使用失败:', error);
        return {
            success: false,
            message: '标记魔术链接为已使用失败'
        };
    }
}

// 检查魔术链接速率限制
export async function checkMagicLinkRateLimit(email) {
    return checkRateLimit(email, VerificationType.LOGIN);
}

// 向后兼容
export async function generateMagicLink(userId, email, options = {}) {
    logger.warn('generateMagicLink is deprecated, use generateMagicLinkForLogin instead');
    return await generateMagicLinkForLogin(userId, email, options);
}

// 向后兼容
export async function validateMagicLink(token) {
    logger.warn('validateMagicLink is deprecated, use validateMagicLinkAndLogin instead');
    return await validateMagicLinkAndLogin(token);
}