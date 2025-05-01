import logger from "../../services/logger.js";
import { prisma, hash, emailTest, userpwTest } from "../../services/global.js";
import { addUserContact, sendVerificationEmail, verifyContact } from "../../controllers/email.js";
import jsonwebtoken from "jsonwebtoken";
import zcconfig from "../../services/config/zcconfig.js";

/**
 * 用户注册
 */
export const registerUser = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username) {
      res.status(200).send({
        message: "邮箱和用户名是必需的",
        status: "error",
      });
      return;
    }

    // 检查邮箱是否已存在
    const existingContact = await prisma.ow_users_contacts.findUnique({
      where: { contact_value: email },
    });

    if (existingContact) {
      res.status(200).send({ message: "邮箱已被使用", status: "error" });
      return;
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.ow_users.findUnique({
      where: { username },
    });

    if (existingUser) {
      res.status(200).send({ message: "用户名已被使用", status: "error" });
      return;
    }

    // 创建用户，如果有密码则设置密码
    const newUser = await prisma.ow_users.create({
      data: {
        username: username,
        password: password ? hash(password) : null, // 如果没有密码则设为 null
        display_name: username,
      },
    });

    try {
      const contact = await addUserContact(newUser.id, email, "email", true);
      await sendVerificationEmail(email, contact.contact_hash, "VERIFY");
    } catch (error) {
      // 如果添加联系方式失败，删除刚创建的用户
      await prisma.ow_users.delete({
        where: { id: newUser.id },
      });
      throw error;
    }

    res.status(200).send({
      message: "注册成功,请查看邮箱验证您的邮箱地址",
      status: "success",
    });
  } catch (err) {
    if (err.code === "P2002") {
      res.status(200).send({ message: "邮箱已被使用", status: "error" });
      return;
    }
    next(err);
  }
};

/**
 * 请求找回密码
 */
export const retrievePassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !emailTest(email)) {
      res.status(200).send({
        message: "请提供有效的邮箱地址",
        status: "error",
      });
      return;
    }

    // 查找邮箱联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: "email",
        OR: [
          { verified: true }, // 已验证的邮箱
          { is_primary: true }, // 或主邮箱
        ],
      },
    });

    if (!contact) {
      res.status(200).send({
        message: "此邮箱不可用于找回密码",
        status: "error",
      });
      return;
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id },
    });

    if (!user) {
      res.status(200).send({
        message: "用户不存在",
        status: "error",
      });
      return;
    }

    // 发送验证码邮件
    await sendVerificationEmail(
      email,
      contact.contact_hash,
      "RESET_PASSWORD"
    );

    res.status(200).send({
      message: "验证码已发送到您的邮箱",
      status: "success",
    });
  } catch (err) {
    logger.error("找回密码时出错:", err);
    res.status(200).send({
      message: "找回密码失败",
      status: "error",
    });
  }
};

/**
 * 重置密码
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, verificationCode, newPassword } = req.body;

    if (!email || !verificationCode || !newPassword) {
      return res.status(200).json({
        status: "error",
        message: "邮箱、验证码和新密码都是必需的",
      });
    }

    // 验证码验证
    const isValid = await verifyContact(email, verificationCode);
    if (!isValid) {
      return res.status(200).json({
        status: "error",
        message: "验证码无效",
      });
    }

    // 查找用户
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: email,
        contact_type: "email",
      },
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到用户",
      });
    }

    // 更新密码
    await prisma.ow_users.update({
      where: { id: contact.user_id },
      data: { password: hash(newPassword) },
    });

    return res.status(200).json({
      status: "success",
      message: "密码已重置",
    });
  } catch (error) {
    logger.error("重置密码时出错:", error);
    return res.status(200).json({
      status: "error",
      message: error.message || "重置密码失败",
    });
  }
};

/**
 * 通过JWT令牌重置密码
 */
export const resetPasswordWithToken = async (req, res, next) => {
  try {
    let decoded;
    try {
      decoded = jsonwebtoken.verify(
        req.body.jwttoken,
        await zcconfig.get("security.jwttoken")
      );
    } catch (err) {
      res.status(200).send({
        message: "token错误或过期",
        status: "error",
      });
      return;
    }

    // 验证token中的用户和邮箱是否匹配，且邮箱必须是已验证的或主邮箱
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: decoded.userid,
        contact_value: decoded.email,
        contact_type: "email",
        OR: [
          { verified: true }, // 已验证的邮箱
          { is_primary: true }, // 或主邮箱
        ],
      },
    });

    if (!contact) {
      res.status(200).send({
        message: "无效的重置请求",
        status: "error",
      });
      return;
    }

    const user = await prisma.ow_users.findUnique({
      where: { id: decoded.userid },
    });

    if (!user) {
      res.status(200).send({
        message: "用户不存在",
        status: "error",
      });
      return;
    }

    // 更新密码
    await prisma.ow_users.update({
      where: { id: decoded.userid },
      data: { password: hash(req.body.pw) },
    });

    res.status(200).send({
      message: "您的密码已更新",
      status: "success",
    });
  } catch (err) {
    logger.error("重置密码时出错:", err);
    res.status(200).send({
      message: "重置密码失败",
      status: "error",
    });
  }
};

/**
 * 验证邮箱
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        status: "error",
        message: "邮箱和验证码都是必需的",
      });
    }

    const verified = await verifyContact(email, token);

    if (!verified) {
      return res.status(200).json({
        status: "error",
        message: "验证失败，请检查验证码是否正确",
      });
    }

    res.status(200).json({
      status: "success",
      message: "邮箱验证成功",
    });
  } catch (error) {
    logger.error(error);
    res.status(200).json({
      status: "error",
      message: error.message || "验证失败",
    });
  }
};