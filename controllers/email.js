import crypto from 'crypto';
import base32Encode from 'base32-encode';
import { prisma } from "../services/global.js";
import { sendEmail } from "../services/email/emailService.js";
import { TOTP } from "otpauth";
import logger from '../services/logger.js';
import memoryCache from '../services/memoryCache.js';
import zcconfig from "../services/config/zcconfig.js";

// 创建TOTP实例的通用函数
function createTotpInstance(secret) {
  return new TOTP({
    secret: secret,
    algorithm: "SHA256",
    digits: 6,
    period: 300, // 5分钟有效期
    issuer: "ZeroCat",
    label: "邮箱验证"
  });
}

// 生成验证码
function generateEmailToken(secret) {
  const totp = createTotpInstance(secret);
  return totp.generate();
}

// 验证验证码
function validateEmailToken(secret, token) {
  try {
    const totp = createTotpInstance(secret);
    // window: 1 表示允许前后一个时间窗口的验证码
    return totp.validate({ token, window: 1 }) !== null;
  } catch (error) {
    logger.error('验证码验证失败:', error);
    return false;
  }
}

// Generate a Base32 hash for TOTP
const generateContactHash = () => {
    // 生成16字节的随机数据
    const buffer = crypto.randomBytes(16);
    // 使用 base32-encode 库将随机字节转换为 Base32 格式
    return base32Encode(buffer, 'RFC4648', { padding: false });
};

// Add a contact for a user
const addUserContact = async (userId, contactValue, contactType, isPrimary = false) => {
    const contactHash = generateContactHash();

    try {
        const contact = await prisma.ow_users_contacts.create({
            data: {
                user_id: userId,
                contact_value: contactValue,
                contact_hash: contactHash,
                contact_type: contactType,
                is_primary: isPrimary,
                verified: false
            }
        });

        return contact;
    } catch (error) {
        if (error.code === 'P2002') {
            throw new Error('Contact already exists');
        }
        throw error;
    }
};

// 添加速率限制
const rateLimitEmailVerification = async (email) => {
  const key = `email_verification:${email}`;
  const count = memoryCache.get(key) || 0;

  if (count >= 3) {
    throw new Error('发送验证码过于频繁，请稍后再试');
  }

  memoryCache.set(key, count + 1, 3600); // 1小时过期
};

// 定义不同场景的邮件模板
const EMAIL_TEMPLATES = {
  // 验证邮箱模板
  VERIFY: (code, verifyUrl) => `
验证您的邮箱

您的验证码是: ${code}
此验证码将在5分钟内有效。

您也可以点击以下链接完成验证：
${verifyUrl}

如果这不是您的操作，请忽略此邮件。
  `,

  // 重置密码模板
  RESET_PASSWORD: (code, verifyUrl) => `
重置密码验证

您正在重置密码，验证码是: ${code}
此验证码将在5分钟内有效。

如果这不是您的操作，请忽略此邮件并考虑修改您的密码。
  `,

  // 添加邮箱模板
  ADD_EMAIL: (code, verifyUrl) => `
验证新邮箱

您正在添加新的邮箱地址，验证码是: ${code}
此验证码将在5分钟内有效。

您也可以点击以下链接完成验证：
${verifyUrl}

如果这不是您的操作，请忽略此邮件。
  `,

  // 默认模板
  DEFAULT: (code, verifyUrl) => `
验证码

您的验证码是: ${code}
此验证码将在5分钟内有效。

如果这不是您的操作，请忽略此邮件。
  `,

  // 登录验证模板
  LOGIN: (code) => `
登录验证

您正在使用邮箱验证码登录，验证码是: ${code}
此验证码将在5分钟内有效。

如果这不是您的操作，请忽略此邮件并考虑修改您的密码。
  `,

  // 解绑 OAuth 验证模板
  UNLINK_OAUTH: (code) => `
解绑 OAuth 验证

您正在请求解绑 OAuth 账号，验证码是: ${code}
此验证码将在5分钟内有效。

如果这不是您的操作，请忽略此邮件并考虑修改您的密码。
  `
};

// 邮件主题映射
const EMAIL_SUBJECTS = {
  VERIFY: '验证您的邮箱',
  RESET_PASSWORD: '重置密码验证',
  ADD_EMAIL: '验证新邮箱',
  DEFAULT: '验证码',
  LOGIN: '登录验证码'
};

// Send verification email
const sendVerificationEmail = async (contactValue, contactHash, template = 'DEFAULT') => {
    await rateLimitEmailVerification(contactValue);

    const token = generateEmailToken(contactHash);
    const verifyUrl = `${await zcconfig.get("urls.frontend")}/app/account/email/verify?email=${encodeURIComponent(contactValue)}&token=${encodeURIComponent(token)}`;

    // 获取对应的邮件模板和主题
    const emailTemplate = EMAIL_TEMPLATES[template] || EMAIL_TEMPLATES.DEFAULT;
    const emailSubject = EMAIL_SUBJECTS[template] || EMAIL_SUBJECTS.DEFAULT;

    // 生成邮件内容
    const emailContent = emailTemplate(token, verifyUrl);

    await sendEmail(contactValue, emailSubject, emailContent);
};

// Verify contact
const verifyContact = async (contactValue, token) => {
    const contact = await prisma.ow_users_contacts.findFirst({
        where: {
            contact_value: contactValue
        }
    });

    if (!contact) {
        logger.debug('未找到邮箱联系方式');
        return false;
    }

    const isValid = validateEmailToken(contact.contact_hash, token);
    logger.debug('验证结果:', isValid);

    if (!isValid) {
        logger.debug('验证码错误');
        return false;
    }

    await prisma.ow_users_contacts.update({
        where: {
            contact_id: contact.contact_id
        },
        data: {
            verified: true
        }
    });

    return true;
};

export {
    addUserContact,
    sendVerificationEmail,
    verifyContact
};
