import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
var router = Router();
import jsonwebtoken from "jsonwebtoken";
import {
  userpwTest,
  emailTest,
  hash,
  checkhash,
  generateJwt,
  randomPassword,
  prisma,
} from "../utils/global.js";
import { sendEmail } from "../utils/email/emailService.js";
import {
  registrationTemplate,
  passwordResetTemplate,
} from "../utils/email/emailTemplates.js";
import { needlogin } from "../middleware/auth.js";

import totpUtils from "../utils/totp.js";
// { isTotpTokenValid, createTotpTokenForUser, enableTotpToken, removeTotpToken, validateTotpToken }
const {
  isTotpTokenValid,
  createTotpTokenForUser,
  enableTotpToken,
  removeTotpToken,
  validateTotpToken,
} = totpUtils;

import geetestMiddleware from "../middleware/geetest.js";
import { addUserContact, sendVerificationEmail, verifyContact } from "../controllers/email.js";


import memoryCache from '../utils/memoryCache.js';

router.all("*", function (req, res, next) {
  next();
});

router.post("/login", geetestMiddleware, async function (req, res, next) {
  try {
    const loginId = req.body.un;
    
    // 检查登录尝试次数
    const attemptKey = `login_attempts:${loginId}`;
    const attempts = memoryCache.get(attemptKey) || 0;
    
    if (attempts >= 5) {
      res.status(200).send({ 
        message: "登录尝试次数过多，请15分钟后再试", 
        status: "error" 
      });
      return;
    }

    if (!req.body.pw || !userpwTest(req.body.pw)) {
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    let user = null;

    // 先通过邮箱查找
    if (emailTest(loginId)) {
      // 查找已验证的邮箱联系方式
      const verifiedContact = await prisma.ow_users_contacts.findFirst({
        where: {
          contact_value: loginId,
          contact_type: 'email',
          verified: true
        }
      });

      if (verifiedContact) {
        user = await prisma.ow_users.findFirst({
          where: { id: verifiedContact.user_id }
        });
      }
    }

    // 如果通过邮箱没找到，尝试通过用户名查找
    if (!user) {
      user = await prisma.ow_users.findFirst({
        where: { username: loginId }
      });
    }

    if (!user) {
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    if (!checkhash(req.body.pw, user.password)) {
      memoryCache.set(attemptKey, attempts + 1, 900); // 15分钟过期
      res.status(200).send({ message: "账户或密码错误", status: "error" });
      return;
    }

    if (user.state == 2) {
      res.status(200).send({ message: "您已经被封禁", status: "error" });
      return;
    }

    // 获取用户的主要邮箱联系方式
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: 'email',
        is_primary: true,
        verified: true
      }
    });

    // 如果没有主要邮箱，获取任何已验证的邮箱
    const verifiedEmail = !primaryEmail ? await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: 'email',
        verified: true
      }
    }) : null;

    if (!primaryEmail && !verifiedEmail) {
      res.status(200).send({ message: "请先验证邮箱", status: "error" });
      return;
    }

    const userEmail = primaryEmail?.contact_value || verifiedEmail?.contact_value;

    const token = await generateJwt({
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail
    });

    // 登录成功后清除尝试记录
    memoryCache.delete(attemptKey);

    res.status(200).send({
      status: "success",
      message: "登录成功",
      userid: parseInt(user.id),
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
      token: token,
    });
  } catch (err) {
    next(err);
  }
});

const logout = function (req, res) {
  res.locals.userid = null;

  // res.cookie("userid", "", { maxAge: 0, signed: true });
  // res.cookie("email", "", { maxAge: 0, signed: true });
  // res.cookie("display_name", "", { maxAge: 0, signed: true });
  // res.cookie("token", "", { maxAge: 0, signed: true });
};

router.get("/logout", function (req, res) {
  logout(req, res);
  res.redirect("/");
});

router.post("/register", geetestMiddleware, async function (req, res, next) {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      res.status(200).send({
        message: "邮箱、用户名和密码都是必需的",
        status: "error"
      });
      return;
    }

    // 检查邮箱是否已存在
    const existingContact = await prisma.ow_users_contacts.findUnique({
      where: { contact_value: email }
    });

    if (existingContact) {
      res.status(200).send({ message: "邮箱已被使用", status: "error" });
      return;
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.ow_users.findUnique({
      where: { username }
    });

    if (existingUser) {
      res.status(200).send({ message: "用户名已被使用", status: "error" });
      return;
    }

    const newUser = await prisma.ow_users.create({
      data: {
        username: username,
        password: hash(password),
        display_name: username,
      },
    });

    try {
      const contact = await addUserContact(newUser.id, email, 'email', true);
      await sendVerificationEmail(email, contact.contact_hash);
    } catch (error) {
      // 如果添加联系方式失败，删除刚创建的用户
      await prisma.ow_users.delete({
        where: { id: newUser.id }
      });
      throw error;
    }

    res.status(200).send({
      message: "注册成功,请查看邮箱验证您的邮箱地址",
      status: "success"
    });
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(200).send({ message: "邮箱已被使用", status: "error" });
      return;
    }
    next(err);
  }
});

router.post("/retrievePassword", geetestMiddleware, async function (req, res, next) {
  try {
    const email = req.body.un;
    if (!email || !emailTest(email)) {
      res.status(200).send({
        message: "请提供有效的邮箱地址",
        status: "error"
      });
      return;
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: 'email',
        OR: [
          { verified: true },  // 已验证的邮箱
          { is_primary: true } // 或主邮箱
        ]
      }
    });

    if (!contact) {
      res.status(200).send({
        message: "此邮箱不可用于找回密码",
        status: "error"
      });
      return;
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id }
    });

    if (!user) {
      res.status(200).send({
        message: "用户不存在",
        status: "error"
      });
      return;
    }

    const jwttoken = jsonwebtoken.sign(
      {
        userid: user.id,
        email: contact.contact_value
      },
      await configManager.getConfig("security.jwttoken"),
      { expiresIn: 60 * 10 }
    );

    await sendEmail(
      email,
      `密码重置消息`,
      await passwordResetTemplate(email, jwttoken)
    );

    res.status(200).send({
      message: "请查看邮箱",
      status: "success"
    });
  } catch (err) {
    logger.error("找回密码时出错:", err);
    res.status(200).send({
      message: "找回密码失败",
      status: "error"
    });
  }
});

router.post("/torepw", geetestMiddleware, async function (req, res, next) {
  try {
    let decoded;
    try {
      decoded = jsonwebtoken.verify(
        req.body.jwttoken,
        await configManager.getConfig("security.jwttoken")
      );
    } catch (err) {
      res.status(200).send({
        message: "token错误或过期",
        status: "error"
      });
      return;
    }

    // 验证token中的用户和邮箱是否匹配，且邮箱必须是已验证的或主邮箱
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: decoded.userid,
        contact_value: decoded.email,
        contact_type: 'email',
        OR: [
          { verified: true },  // 已验证的邮箱
          { is_primary: true } // 或主邮箱
        ]
      }
    });

    if (!contact) {
      res.status(200).send({
        message: "无效的重置请求",
        status: "error"
      });
      return;
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: decoded.userid }
    });

    if (!user) {
      res.status(200).send({
        message: "用户不存在",
        status: "error"
      });
      return;
    }

    // 更新密码
    await prisma.ow_users.update({
      where: { id: decoded.userid },
      data: { password: hash(req.body.pw) }
    });

    res.status(200).send({
      message: "您的密码已更新",
      status: "success"
    });
  } catch (err) {
    logger.error("重置密码时出错:", err);
    res.status(200).send({
      message: "重置密码失败",
      status: "error"
    });
  }
});

router.get("/totp/list", needlogin, async (req, res) => {
  try {
    let totpData = await prisma.ow_users_totp.findMany({
      where: { user_id: Number(res.locals.userid) },
      select: {
        id: true,
        user_id: true,
        name: true,
        type: true,
        status: true,
      },
    });
    // 获取列表中status为unverified的数量并从列表中删除这些数据
    const unverifiedTotpCount = totpData.filter(
      (totp) => totp.status === "unverified"
    ).length;
    totpData = totpData.filter((item) => item.status !== "unverified");

    return res.json({
      status: "success",
      message: "获取成功",
      data: {
        list: totpData,
        unverified: unverifiedTotpCount,
      },
    });
  } catch (error) {
    logger.error("获取验证器列表时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "获取验证器列表失败",
      error: error.message,
    });
  }
});
router.post("/totp/rename", needlogin, async (req, res) => {
  const { totp_id, name } = req.body;
  if (!totp_id || !name) {
    return res.status(400).json({
      status: "error",
      message: "TOTP ID 和名称是必需的",
    });
  }
  try {
    let renamedTotp;
    renamedTotp = await prisma.ow_users_totp.update({
      where: { id: Number(totp_id) },
      data: { name: name },
      select: {
        id: true,
        user_id: true,
        name: true,
        type: true,
        status: true,
      },
    });
    return res.json({
      status: "success",
      message: "验证器已重命名",
      data: renamedTotp,
    });
  } catch (error) {
    logger.error("重命名验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "重命名验证器失败",
      error: error.message,
    });
  }
});
router.post("/totp/check", async (req, res) => {
  const { totp_token, userId } = req.body;
  if (!totp_token || !userId) {
    return res.status(400).json({
      status: "error",
      message: "验证器令牌和用户 ID 是必需的",
    });
  }

  try {
    const isValid = await isTotpTokenValid(userId, totp_token);
    return res.json({
      status: "success",
      message: "令牌验证结果",
      data: { validated: isValid },
    });
  } catch (error) {
    logger.error("验证令牌时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "验证令牌失败",
      error: error.message,
    });
  }
});
router.post("/totp/delete", needlogin, async (req, res) => {
  const { totp_id } = req.body;
  if (!totp_id) {
    return res.status(400).json({
      status: "error",
      message: "验证器 ID 是必需的",
    });
  }
  try {
    const deletedTotp = await removeTotpToken(res.locals.userid, totp_id);
    return res.json({
      status: "success",
      message: "验证器已删除",
      data: deletedTotp,
    });
  } catch (error) {
    logger.error("删除验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "删除验证器失败",
      error: error.message,
    });
  }
});
router.post("/totp/generate", needlogin, async (req, res) => {
  try {
    const info = await createTotpTokenForUser(res.locals.userid);
    return res.json({
      status: "success",
      message: "验证器创建成功",
      data: info,
    });
  } catch (error) {
    logger.error("创建验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "创建验证器失败",
      error: error.message,
    });
  }
});

router.post("/totp/activate", needlogin, async (req, res) => {
  const { totp_id, totp_token } = req.body;

  if (!totp_id || !totp_token) {
    return res.status(400).json({
      status: "error",
      message: "验证器ID和令牌是必需的",
    });
  }

  try {
    const activatedTotp = await enableTotpToken(
      res.locals.userid,
      totp_id,
      totp_token
    );
    return res.json({
      status: "success",
      message: "验证器已激活",
      data: activatedTotp,
    });
  } catch (error) {
    logger.error("激活验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "激活验证器失败",
      error: error.message,
    });
  }
});

router.post("/totp/protected-route", validateTotpToken, (req, res) => {
  return res.json({
    status: "success",
    message: "请求成功，验证器令牌验证通过",
  });
});

router.post("/magiclink/generate", geetestMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !emailTest(email)) {
      return res.status(200).json({
        status: "error",
        message: "无效的邮箱地址"
      });
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findUnique({
      where: {
        contact_value: email
      }
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此邮箱地址"
      });
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id }
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在"
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
      message: "魔术链接已发送到您的邮箱"
    });
    logger.debug(`Magic link sent to ${email}: ${magicLink}`);
  } catch (error) {
    logger.error("生成魔术链接时出错:", error);
    res.status(200).json({
      status: "error",
      message: "生成魔术链接失败"
    });
  }
});

router.get("/magiclink/validate", async (req, res) => {
  try {
    const { token } = req.query;
    
    // 检查token是否已被使用
    const usedKey = `used_magic_link:${token}`;
    if (memoryCache.get(usedKey)) {
      return res.status(200).json({
        status: "error",
        message: "此魔术链接已被使用"
      });
    }

    if (!token) {
      return res.status(200).json({
        status: "error",
        message: "无效的魔术链接"
      });
    }

    const decoded = jsonwebtoken.verify(
      token,
      await configManager.getConfig("security.jwttoken")
    );

    const magicLink = await prisma.ow_users_magiclink.findUnique({
      where: { token }
    });

    if (!magicLink || magicLink.expiresAt < new Date()) {
      return res.status(200).json({
        status: "error",
        message: "魔术链接已过期"
      });
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: magicLink.userId }
    });

    if (!user) {
      return res.status(200).json({
        status: "error",
        message: "用户不存在"
      });
    }

    // 获取用户的主要邮箱联系方式
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: 'email',
        is_primary: true,
        verified: true
      }
    });

    // 如果没有已验证的主要邮箱，尝试获取任何已验证的邮箱
    const verifiedEmail = !primaryEmail ? await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: 'email',
        verified: true
      }
    }) : null;

    if (!primaryEmail && !verifiedEmail) {
      return res.status(200).json({
        status: "error",
        message: "请先验证邮箱"
      });
    }

    const userEmail = primaryEmail?.contact_value || verifiedEmail?.contact_value;

    const jwtToken = await generateJwt({
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail
    });

    // 删除已使用的魔术链接
    await prisma.ow_users_magiclink.delete({
      where: { token }
    });

    // 标记token为已使用
    memoryCache.set(usedKey, true, 86400); // 24小时过期

    res.status(200).json({
      status: "success",
      message: "登录成功",
      userid: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.images,
      email: userEmail,
      token: jwtToken,
    });
  } catch (error) {
    logger.error("验证魔术链接时出错:", error);
    res.status(200).json({
      status: "error",
      message: "验证魔术链接失败"
    });
  }
});

router.post("/verify-email", async function (req, res, next) {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        status: "error",
        message: "邮箱和验证码都是必需的"
      });
    }

    await verifyContact(email, token);

    res.status(200).json({
      status: "success",
      message: "邮箱验证成功"
    });
  } catch (error) {
    logger.error(error);
    res.status(200).json({
      status: "error",
      message: error.message
    });
  }
});

// 添加新的路由处理绑定辅助邮箱
router.post("/add-email", needlogin, async function (req, res, next) {
  try {
    const userId = res.locals.userid;

    // 检查用户是否有已验证的主邮箱
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: userId,
        contact_type: 'email',
        is_primary: true,
        verified: true
      }
    });

    if (!primaryEmail) {
      return res.status(200).json({
        status: "error",
        message: "请先验证主邮箱后再添加辅助邮箱"
      });
    }

    const { email } = req.body;

    if (!email || !emailTest(email)) {
      return res.status(200).json({
        status: "error",
        message: "请提供有效的邮箱地址"
      });
    }

    // 检查邮箱是否已被使用
    const existingContact = await prisma.ow_users_contacts.findUnique({
      where: { contact_value: email }
    });

    if (existingContact) {
      return res.status(200).json({
        status: "error",
        message: "此邮箱已被使用"
      });
    }

    // 获取用户当前的邮箱数量
    const currentEmailCount = await prisma.ow_users_contacts.count({
      where: {
        user_id: userId,
        contact_type: 'email'
      }
    });

    if (currentEmailCount >= 5) {
      return res.status(200).json({
        status: "error",
        message: "您最多只能绑定5个邮箱"
      });
    }

    // 检查是否已有主要邮箱
    const hasPrimaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: userId,
        contact_type: 'email',
        is_primary: true
      }
    });

    // 如果没有主要邮箱，将此邮箱设为主要邮箱
    const isPrimary = !hasPrimaryEmail;

    try {
      // 添加新邮箱
      const contact = await addUserContact(userId, email, 'email', isPrimary);

      // 发送验证邮件
      await sendVerificationEmail(email, contact.contact_hash);

      return res.status(200).json({
        status: "success",
        message: "邮箱添加成功，请查收验证邮件",
        data: {
          email: contact.contact_value,
          is_primary: contact.is_primary,
          verified: contact.verified
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(200).json({
          status: "error",
          message: "此邮箱已被使用"
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error("添加邮箱时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "添加邮箱失败"
    });
  }
});

// 获取用户的所有邮箱
router.get("/emails", needlogin, async function (req, res) {
  try {
    const userId = res.locals.userid;

    const emails = await prisma.ow_users_contacts.findMany({
      where: {
        user_id: userId,
        contact_type: 'email'
      },
      select: {
        contact_id: true,
        contact_value: true,
        is_primary: true,
        verified: true,
        created_at: true
      },
      orderBy: [
        { is_primary: 'desc' },
        { created_at: 'desc' }
      ]
    });

    return res.status(200).json({
      status: "success",
      message: "获取成功",
      data: emails
    });
  } catch (error) {
    logger.error("获取邮箱列表时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "获取邮箱列表失败"
    });
  }
});

// 删除辅助邮箱
router.post("/remove-email", needlogin, async function (req, res) {
  try {
    const { email } = req.body;
    const userId = res.locals.userid;

    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: userId,
        contact_value: email,
        contact_type: 'email'
      }
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此邮箱"
      });
    }

    if (contact.is_primary) {
      return res.status(200).json({
        status: "error",
        message: "不能删除主要邮箱"
      });
    }

    await prisma.ow_users_contacts.delete({
      where: {
        contact_id: contact.contact_id
      }
    });

    return res.status(200).json({
      status: "success",
      message: "邮箱删除成功"
    });
  } catch (error) {
    logger.error("删除邮箱时出错:", error);
    return res.status(200).json({
      status: "error",
      message: "删除邮箱失败"
    });
  }
});

export default router;
