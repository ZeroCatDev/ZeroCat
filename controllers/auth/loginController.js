import logger from "../../utils/logger.js";
import authUtils from "../../utils/auth.js";
import { prisma, checkhash, userpwTest, emailTest } from "../../utils/global.js";
import { createEvent, TargetTypes } from "../events.js";
import memoryCache from "../../utils/memoryCache.js";
import { sendEmail } from "../../utils/email/emailService.js";
import configManager from "../../utils/configManager.js";
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
    const attempts = memoryCache.get(attemptKey) || 0;

    if (attempts >= 5) {
      res.status(200).send({
        message: "登录尝试次数过多，请15分钟后再试",
        status: "error",
      });
      return;
    }

    if (!req.body.pw || !userpwTest(req.body.pw)) {
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    let user = null;

    // 修改通过邮箱查找的逻辑
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
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    // 检查用户是否设置了密码
    if (!user.password) {
      res.status(200).send({
        message: "此账户未设置密码，请使用魔术链接登录",
        status: "error",
        code: "NO_PASSWORD", // 添加特殊错误码
      });
      return;
    }

    if (!checkhash(req.body.pw, user.password)) {
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    if (user.status != "active") {
      res.status(200).send({ message: "账户状态异常", status: "error" });
      return;
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
      res.status(200).send({ message: "请先验证邮箱", status: "error" });
      return;
    }

    const userEmail =
      primaryEmail?.contact_value || verifiedEmail?.contact_value;

    // 使用新的令牌创建函数
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
    memoryCache.delete(attemptKey);

    // 添加登录事件（不记录到数据库）
    await createEvent("user_login", user.id, TargetTypes.USER, user.id, {
      event_type: "user_login",
      actor_id: user.id,
      target_type: TargetTypes.USER,
      target_id: user.id
    });

    res.status(200).send({
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
    next(err);
  }
};

/**
 * 发送登录验证码
 */
export const sendLoginCode = async (req, res) => {
  try {
    const { email } = req.body;

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

    // 发送验证码
    await sendVerificationEmail(email, contact.contact_hash, "LOGIN");

    return res.status(200).json({
      status: "success",
      message: "验证码已发送",
    });
  } catch (error) {
    logger.error("发送登录验证码时出错:", error);
    return res.status(200).json({
      status: "error",
      message: error.message || "发送验证码失败",
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
    const isValid = await verifyContact(email, code);
    if (!isValid) {
      return res.status(200).json({
        status: "error",
        message: "验证码无效",
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

    if (user.status != "active") {
      return res.status(200).json({
        status: "error",
        message: "账户状态异常",
      });
    }

    // 使用新的令牌创建函数
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
      target_id: user.id
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
      message: error.message || "登录失败",
    });
  }
};

/**
 * 生成魔术链接
 */
export const generateMagicLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !emailTest(email)) {
      return res.status(200).json({
        status: "error",
        message: "无效的邮箱地址",
      });
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findUnique({
      where: {
        contact_value: email,
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

    const token = jsonwebtoken.sign(
      { id: user.id },
      await configManager.getConfig("security.jwttoken"),
      { expiresIn: 60 * 10 }
    );

    await prisma.ow_users_magiclink.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 10 * 1000),
      },
    });

    const magicLink = `${await configManager.getConfig(
      "urls.frontend"
    )}/app/account/magiclink/validate?token=${token}`;

    // 发送魔术链接邮件
    await sendEmail(
      email,
      "魔术链接登录",
      `
      <h2>魔术链接登录请求</h2>
      <p>您请求了魔术链接登录。</p>
      <p>如果这是您的操作，请点击以下链接登录：</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
      <p>此链接将在10分钟内有效。</p>
      <p>如果这不是您的操作，请忽略此邮件并考虑修改您的密码。</p>
      `
    );

    res.status(200).json({
      status: "success",
      message: "魔术链接已发送到您的邮箱",
    });
    logger.debug(`Magic link sent to ${email}: ${magicLink}`);
  } catch (error) {
    logger.error("生成魔术链接时出错:", error);
    res.status(200).json({
      status: "error",
      message: "生成魔术链接失败",
    });
  }
};

/**
 * 验证魔术链接并登录
 */
export const validateMagicLink = async (req, res) => {
  try {
    const { token } = req.query;

    // 检查token是否已被使用
    const usedKey = `used_magic_link:${token}`;
    if (memoryCache.get(usedKey)) {
      return res.status(200).json({
        status: "error",
        message: "此魔术链接已被使用",
      });
    }

    if (!token) {
      return res.status(200).json({
        status: "error",
        message: "无效的魔术链接",
      });
    }

    const decoded = jsonwebtoken.verify(
      token,
      await configManager.getConfig("security.jwttoken")
    );

    const magicLink = await prisma.ow_users_magiclink.findUnique({
      where: { token },
    });

    if (!magicLink || magicLink.expiresAt < new Date()) {
      return res.status(200).json({
        status: "error",
        message: "魔术链接已过期",
      });
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: magicLink.userId },
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在",
      });
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

    const userEmail =
      primaryEmail?.contact_value || verifiedEmail?.contact_value;

    // 使用新的令牌创建函数
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

    // 删除已使用的魔术链接
    await prisma.ow_users_magiclink.delete({
      where: { token },
    });

    // 标记token为已使用
    memoryCache.set(usedKey, true, 86400); // 24小时过期

    // 记录登录事件
    await createEvent("user_login", user.id, TargetTypes.USER, user.id, {
      event_type: "user_login",
      actor_id: user.id,
      target_type: TargetTypes.USER,
      target_id: user.id
    });

    res.status(200).json({
      status: "success",
      message: "登录成功",
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
      token: tokenResult.accessToken,
      refresh_token: tokenResult.refreshToken,
      expires_at: tokenResult.expiresAt,
      refresh_expires_at: tokenResult.refreshExpiresAt
    });
  } catch (error) {
    logger.error("验证魔术链接时出错:", error);
    res.status(200).json({
      status: "error",
      message: "验证魔术链接失败",
    });
  }
};

/**
 * 退出登录
 */
export const logout = async (req, res) => {
  try {
    const tokenId = res.locals.tokenId;

    const result = await authUtils.logout(tokenId);

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "已成功退出登录"
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: result.message || "退出登录失败"
      });
    }
  } catch (error) {
    logger.error("退出登录时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "退出登录失败"
    });
  }
};

/**
 * 退出所有设备
 */
export const logoutAllDevices = async (req, res) => {
  try {
    const tokenId = res.locals.tokenId;

    const result = await authUtils.revokeToken(tokenId, true);

    if (result.success) {
      return res.status(200).json({
        status: "success",
        message: "已成功退出所有设备"
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: result.message || "退出所有设备失败"
      });
    }
  } catch (error) {
    logger.error("退出所有设备时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "退出所有设备失败"
    });
  }
};

/**
 * 发送验证码到指定邮箱
 */
export const sendVerificationEmail = async (email, contactHash, type) => {
  // 实现从email.js导入
};