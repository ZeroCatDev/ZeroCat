import logger from "../../services/logger.js";
import authUtils from "../../services/auth/auth.js";
import { prisma, checkhash, userpwTest, emailTest } from "../../services/global.js";
import { createEvent, TargetTypes } from "../events.js";
import redisClient from "../../services/redis.js";
import zcconfig from "../../services/config/zcconfig.js";
import {
  generateVerificationCode,
  verifyCode,
  checkRateLimit,
  VerificationType
} from "../../services/auth/verification.js";
import {
  generateMagicLinkForLogin,
  sendMagicLinkEmail,
  validateMagicLinkAndLogin as MagiclinkValidateMagicLinkAndLogin,
  markMagicLinkAsUsed,
  checkMagicLinkRateLimit
} from "../../services/auth/magiclink.js";
import { sendEmail } from "../../services/email/emailService.js";
import jsonwebtoken from "jsonwebtoken";
import { verifyContact } from "../email.js";

/**
 * 处理用户密码登录
 */
export const loginWithPassword = async (req, res, next) => {
  try {
    const loginId = req.body.un;

    // 检查登录尝试次数
    const attemptKey = `login_attempts:${loginId}`;
    const attempts = await redisClient.get(attemptKey) || 0;

    if (attempts >= 5) {
      return res.status(200).json({
        status: "error",
        message: "登录尝试次数过多，请15分钟后再试",
      });
    }

    if (!req.body.pw || !userpwTest(req.body.pw)) {
      await redisClient.set(attemptKey, attempts + 1, 900); // 15分钟过期
      return res.status(200).json({
        status: "error",
        message: "账户或密码错误",
      });
    }

    // 查找用户
    let user = null;

    if (emailTest(loginId)) {
      // 查找主邮箱或已验证的邮箱联系方式
      const contact = await prisma.ow_users_contacts.findFirst({
        where: {
          contact_value: loginId,
          contact_type: "email",
          OR: [
            { is_primary: true }, // 主邮箱
            { verified: true }, // 或已验证的邮箱
          ],
        },
      });

      if (contact) {
        user = await prisma.ow_users.findFirst({
          where: { id: contact.user_id },
        });
      }
    }

    // 如果通过邮箱没找到，尝试通过用户名查找
    if (!user) {
      user = await prisma.ow_users.findFirst({
        where: { username: loginId },
      });
    }

    if (!user) {
      await redisClient.set(attemptKey, attempts + 1, 900); // 15分钟过期
      return res.status(200).json({
        status: "error",
        message: "账户或密码错误",
      });
    }

    // 检查用户是否设置了密码
    if (!user.password) {
      return res.status(200).json({
        status: "error",
        message: "此账户未设置密码，请使用验证码或魔术链接登录",
        code: "NO_PASSWORD",
      });
    }

    // 检查密码是否正确
    if (!checkhash(req.body.pw, user.password)) {
      await redisClient.set(attemptKey, attempts + 1, 900); // 15分钟过期
      return res.status(200).json({
        status: "error",
        message: "账户或密码错误",
      });
    }

    // 检查账户状态
    if (user.status !== "active") {
      return res.status(200).json({
        status: "error",
        message: "账户状态异常 #1",
      });
    }

    // 获取用户的主要邮箱联系方式
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: "email",
        is_primary: true,
      },
    });

    // 如果没有主要邮箱，获取任何已验证的邮箱
    const verifiedEmail = !primaryEmail
      ? await prisma.ow_users_contacts.findFirst({
          where: {
            user_id: user.id,
            contact_type: "email",
            verified: true,
          },
        })
      : null;

    if (!primaryEmail && !verifiedEmail) {
      return res.status(200).json({
        status: "error",
        message: "请先验证邮箱",
      });
    }

    const userEmail = primaryEmail?.contact_value || verifiedEmail?.contact_value;

    // 使用用户信息创建令牌
    const userInfo = {
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
    };

    const tokenResult = await authUtils.createTokens(
      user.id,
      userInfo,
      req.ip,
      req.headers["user-agent"]
    );

    // 登录成功后清除尝试记录
    await redisClient.delete(attemptKey);

    // 记录登录事件
    await createEvent("user_login", user.id, TargetTypes.USER, user.id, {
      event_type: "user_login",
      actor_id: user.id,
      target_type: TargetTypes.USER,
      target_id: user.id,
      method: "password"
    });

    return res.status(200).json({
      status: "success",
      message: "登录成功",
      userid: parseInt(user.id),
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
      token: tokenResult.accessToken,
      refresh_token: tokenResult.refreshToken,
      expires_at: tokenResult.expiresAt,
      refresh_expires_at: tokenResult.refreshExpiresAt
    });
  } catch (err) {
    logger.error("密码登录失败:", err);
    return res.status(500).json({
      status: "error",
      message: "服务器内部错误，请稍后再试"
    });
  }
};

/**
 * 发送登录验证码
 */
export const sendLoginCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(200).json({
        status: "error",
        message: "邮箱是必需的",
      });
    }

    // 检查发送频率限制
    const rateCheck = await checkRateLimit(email, VerificationType.LOGIN);
    if (!rateCheck.success) {
      return res.status(200).json({
        status: "error",
        message: rateCheck.message,
      });
    }

    if (!email || !emailTest(email)) {
      return res.status(200).json({
        status: "error",
        message: "请提供有效的邮箱地址",
      });
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: "email",
        OR: [
          { is_primary: true }, // 主邮箱
          { verified: true }, // 或已验证的邮箱
        ],
      },
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此邮箱",
      });
    }

    // 生成验证码
    const verificationResult = await generateVerificationCode(email, VerificationType.LOGIN);

    if (!verificationResult.success) {
      return res.status(200).json({
        status: "error",
        message: verificationResult.message || "生成验证码失败",
      });
    }

    // 发送验证码邮件
    const code = verificationResult.code;
    const frontendUrl = await zcconfig.get("urls.frontend");

    // 构建邮件内容
    const emailSubject = "登录验证码";
    const emailContent = `
      <h2>登录验证码</h2>
      <p>您好，您的登录验证码是：</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${code}</p>
      <p>此验证码将在5分钟内有效。</p>
      <p>如果这不是您的操作，请忽略此邮件。</p>
    `;

    // 发送邮件
    await sendEmail(email, emailSubject, emailContent);

    return res.status(200).json({
      status: "success",
      message: "验证码已发送",
      email: email,
      expiresIn: 300, // 5分钟过期
    });
  } catch (error) {
    logger.error("发送登录验证码时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "发送验证码失败",
    });
  }
};

/**
 * 使用验证码登录
 */
export const loginWithCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(200).json({
        status: "error",
        message: "邮箱和验证码都是必需的",
      });
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: "email",
        OR: [
          { is_primary: true }, // 主邮箱
          { verified: true }, // 或已验证的邮箱
        ],
      },
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此邮箱",
      });
    }

    // 验证验证码
    const verifyResult = await verifyCode(email, code, VerificationType.LOGIN);

    if (!verifyResult.success) {
      return res.status(200).json({
        status: "error",
        message: verifyResult.message,
        attemptsLeft: verifyResult.attemptsLeft,
      });
    }

    // 获取用户信息
    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id },
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在",
      });
    }

    if (user.status !== "active") {
      return res.status(200).json({
        status: "error",
        message: "账户状态异常 #2",
      });
    }

    // 使用令牌创建函数
    const userInfo = {
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: email,
    };

    const tokenResult = await authUtils.createTokens(
      user.id,
      userInfo,
      req.ip,
      req.headers["user-agent"]
    );

    // 记录登录事件
    await createEvent("user_login", user.id, TargetTypes.USER, user.id, {
      event_type: "user_login",
      actor_id: user.id,
      target_type: TargetTypes.USER,
      target_id: user.id,
      method: "code"
    });

    return res.status(200).json({
      status: "success",
      message: "登录成功",
      userid: parseInt(user.id),
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: email,
      token: tokenResult.accessToken,
      refresh_token: tokenResult.refreshToken,
      expires_at: tokenResult.expiresAt,
      refresh_expires_at: tokenResult.refreshExpiresAt
    });
  } catch (error) {
    logger.error("验证码登录时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "登录失败",
    });
  }
};

/**
 * 生成魔术链接
 */
export const sendMagicLinkForLogin = async (req, res) => {
  try {
    const { email, redirect } = req.body;

    if (!email || !emailTest(email)) {
      return res.status(200).json({
        status: "error",
        message: "无效的邮箱地址",
      });
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: "email",
        OR: [
          { is_primary: true }, // 主邮箱
          { verified: true }, // 或已验证的邮箱
        ],
      },
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此邮箱地址",
      });
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id },
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在",
      });
    }

    // 检查速率限制
    const rateCheck = await checkRateLimit(email, VerificationType.LOGIN);
    if (!rateCheck.success) {
      return res.status(200).json({
        status: "error",
        message: rateCheck.message,
      });
    }

    // 生成魔术链接
    const clientId = req.headers["user-agent"] ? req.headers["user-agent"].substring(0, 50) : undefined;
    const options = {
      expiresIn: 600, // 10分钟
      clientId,
      redirect
    };

    const magicLinkResult = await generateMagicLinkForLogin(user.id, email, options);

    if (!magicLinkResult.success) {
      return res.status(200).json({
        status: "error",
        message: magicLinkResult.message || "生成魔术链接失败",
      });
    }

    // 发送魔术链接邮件
    await sendMagicLinkEmail(email, magicLinkResult.magicLink, { templateType: 'login' });

    return res.status(200).json({
      status: "success",
      message: "魔术链接已发送到您的邮箱",
      expiresIn: magicLinkResult.expiresIn,
    });
  } catch (error) {
    logger.error("生成魔术链接时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "生成魔术链接失败",
    });
  }
};

/**
 * 验证魔术链接并登录
 */
export const validateMagicLinkAndLogin = async (req, res) => {
  try {
    const { token, redirect } = req.query;

    if (!token) {
      return res.status(200).json({
        status: "error",
        message: "无效的魔术链接",
      });
    }

    // 验证魔术链接
    const validateResult = await MagiclinkValidateMagicLinkAndLogin(token);

    if (!validateResult.success) {
      return res.status(200).json({
        status: "error",
        message: validateResult.message,
      });
    }

    // 获取用户信息
    const user = await prisma.ow_users.findUnique({
      where: { id: validateResult.userId },
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在",
      });
    }
    logger.debug(validateResult);
    // 检查用户状态，如果不是激活状态且魔术链接的目的是激活账户，则激活账户
    if (user.status !== "active") {
      if (user.status === "pending") {
        // 激活用户账户
        await prisma.ow_users.update({
          where: { id: user.id },
          data: { status: "active" },
        });
        logger.debug("激活用户账户");
        //激活这个邮箱
        await prisma.ow_users_contacts.update({
          where: { user_id: user.id, contact_value: validateResult.email, contact_type: "email" },
          data: { verified: true },
        });
        // 更新用户对象以反映新状态
        user.status = "active";
      } else {
        // 如果不是激活用户的魔术链接，则返回错误
        return res.status(200).json({
          status: "error",
          message: "账户状态异常 #3",
        });
      }
    }

    // 获取用户的主要邮箱联系方式
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: "email",
        is_primary: true,
        verified: true,
      },
    });

    // 如果没有已验证的主要邮箱，尝试获取任何已验证的邮箱
    const verifiedEmail = !primaryEmail
      ? await prisma.ow_users_contacts.findFirst({
          where: {
            user_id: user.id,
            contact_type: "email",
            verified: true,
          },
        })
      : null;

    if (!primaryEmail && !verifiedEmail) {
      return res.status(200).json({
        status: "error",
        message: "请先验证邮箱",
      });
    }

    const userEmail = primaryEmail?.contact_value || verifiedEmail?.contact_value || validateResult.email;

    // 使用用户信息创建令牌
    const userInfo = {
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
    };

    const tokenResult = await authUtils.createTokens(
      user.id,
      userInfo,
      req.ip,
      req.headers["user-agent"]
    );

    // 标记魔术链接为已使用
    await markMagicLinkAsUsed(token);

    // 记录登录事件
    await createEvent("user_login", user.id, TargetTypes.USER, user.id, {
      event_type: "user_login",
      actor_id: user.id,
      target_type: TargetTypes.USER,
      target_id: user.id,
      method: "magic_link"
    });

    // 如果请求包含重定向URL，则构建回调数据
    const callbackData = redirect ? {
      redirect: decodeURIComponent(redirect),
      canUseCurrentPage: true // 允许在当前页面登录
    } : null;

    return res.status(200).json({
      status: "success",
      message: "登录成功",
      userid: parseInt(user.id),
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
      token: tokenResult.accessToken,
      refresh_token: tokenResult.refreshToken,
      expires_at: tokenResult.expiresAt,
      refresh_expires_at: tokenResult.refreshExpiresAt,
      callback: callbackData
    });
  } catch (error) {
    logger.error("验证魔术链接时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "验证魔术链接失败",
    });
  }
};

/**
 * 登出
 */
export const logout = async (req, res) => {
  try {
    const userId = res.locals.userid;
    const tokenId = res.locals.tokenid;

    if (!userId || !tokenId) {
      return res.status(200).json({
        status: "error",
        message: "未登录"
      });
    }

    // 撤销令牌
    const result = await authUtils.revokeToken(tokenId);

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "登出成功"
      });
    } else {
      return res.status(200).json({
        status: "error",
        message: result.message || "登出失败"
      });
    }
  } catch (error) {
    logger.error("登出时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "登出失败"
    });
  }
};

/**
 * 登出所有设备
 */
export const logoutAllDevices = async (req, res) => {
  try {
    const userId = res.locals.userid;
    const currentTokenId = res.locals.tokenid;

    if (!userId) {
      return res.status(200).json({
        status: "error",
        message: "未登录"
      });
    }

    // 撤销用户所有令牌(除了当前令牌)
    const result = await authUtils.logout(userId, currentTokenId);

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "已登出所有其他设备",
        count: result.count
      });
    } else {
      return res.status(200).json({
        status: "error",
        message: result.message || "登出失败"
      });
    }
  } catch (error) {
    logger.error("登出所有设备时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "登出失败"
    });
  }
};

/**
 * 发送验证码到指定邮箱
 */
export const sendVerificationEmail = async (email, contactHash, type) => {
  // 实现从email.js导入
};