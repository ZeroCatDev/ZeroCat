import crypto from 'crypto';
import jsonwebtoken from 'jsonwebtoken';
import zcconfig from '../config/zcconfig.js';
import redisClient from '../redis.js';
import logger from '../logger.js';
import {checkRateLimit, VerificationType} from './verification.js';
import {createJWT} from './tokenUtils.js';
import { createNotification } from '../../controllers/notifications.js';

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
        const userId = options.userId || null;
        
        // 需要userId才能发送通知
        if (!userId) {
            // 如果没有userId，先根据email查找用户
            const { prisma } = await import('../global.js');
            const contact = await prisma.ow_users_contacts.findFirst({
                where: {
                    contact_value: email,
                    contact_type: 'email'
                }
            });
            
            if (!contact) {
                throw new Error('无法发送魔术链接邮件：未找到用户');
            }
            
            options.userId = contact.user_id;
        }
        
        const titleMap = {
            login: '魔术链接登录',
            register: '完成账户注册',
            password_reset: '密码重置'
        };
        
        const contentMap = {
            login: '点击下方链接快速登录您的账户',
            register: '点击下方链接完成您的账户注册',
            password_reset: '点击下方链接重置您的密码'
        };
        
        // 使用createNotification发送魔术链接通知
        await createNotification({
            userId: options.userId,
            title: titleMap[templateType] || '魔术链接',
            content: `${contentMap[templateType] || '点击下方链接继续操作'}：\n\n${magicLink}\n\n链接将在30分钟后失效，请及时使用。`,
            notificationType: 'magic_link_email',
            hidden: true,
            pushChannels: ['email'],
            data: {
                email_to: email,
                email_username: email.split('@')[0],
                email_link: magicLink,
                email_buttons: null,
                type: 'magic_link',
                template_type: templateType,
                magic_link: magicLink
            }
        });

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