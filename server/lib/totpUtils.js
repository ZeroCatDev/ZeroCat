import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { prisma } from "./global.js";
import e from "express";

// Common function to create a TOTP instance
function createTotpInstance(
  secret,
  algorithm = "SHA256",
  digits = 6,
  period = 30
) {
  return new TOTP({
    secret: secret,
    algorithm: algorithm,
    digits: digits,
    period: period,
    issuer: "ZeroCat",
    label: "ZeroCat社区验证令牌",
  });
}

// Function to check if the TOTP token is valid
async function isTotpTokenValid(userId, token) {
  try {
    const userTotps = await prisma.ow_users_totp.findMany({
      where: { user_id: Number(userId), status: "enabled" },
      select: {
        totp_secret: true,
        totp_algorithm: true,
        totp_digits: true,
        totp_period: true,
      },
    });

    if (userTotps.length === 0) {
      return {
        status: "0",
        message: "未找到验证器配置",
        valid: false,
      };
    }

    for (let totpConfig of userTotps) {
      const totp = createTotpInstance(
        totpConfig.totp_secret,
        totpConfig.totp_algorithm,
        totpConfig.totp_digits,
        totpConfig.totp_period
      );

      if (totp.validate({ token, window: 1 }) !== null) {
        return { status: "success", message: "令牌有效", valid: true };
      }
    }

    return { status: "0", message: "无效的令牌", valid: false };
  } catch (error) {
    return {
      status: "0",
      message: "无法验证令牌",
      valid: false,
      error: error,
    };
  }
}

// Function to check if the TOTP token is valid by specific TOTP ID
async function isTotpTokenValidById(userId, token, totp_id) {
  try {
    const userTotp = await prisma.ow_users_totp.findUnique({
      where: { user_id: Number(userId), id: Number(totp_id) },
      select: {
        totp_secret: true,
        totp_algorithm: true,
        totp_digits: true,
        totp_period: true,
      },
    });

    if (!userTotp) {
      return {
        status: "0",
        message: "验证器不存在",
        valid: false,
      };
    }

    const totp = createTotpInstance(
      userTotp.totp_secret,
      userTotp.totp_algorithm,
      userTotp.totp_digits,
      userTotp.totp_period
    );
    return totp.validate({ token, window: 1 }) !== null
      ? { status: "success", message: "令牌有效", valid: true }
      : { status: "0", message: "令牌无效", valid: false };
  } catch (error) {
    return {
      status: "0",
      message: "无法验证令牌",
      valid: false,
      error: error,
    };
  }
}

// Function to create a TOTP token for a user and return the secret and TOTP URL
async function createTotpTokenForUser(userId) {
  try {
    const secret = new Secret();
    const totpConfig = {
      user_id: userId,
      totp_secret: secret.base32,
      totp_algorithm: "SHA256",
      totp_digits: 6,
      totp_period: 30,
      status: "unverified",
    };

    const result = await prisma.ow_users_totp.create({ data: totpConfig });
    const otpauthUrl = generateTotpUrlForUser(userId, secret.base32);

    return {
      status: "success",
      message: "验证器已创建",
      secret: result.totp_secret,
      otpauth_url: otpauthUrl,
      totp_id: result.id,
    };
  } catch (error) {
    return {
      status: "0",
      message: "无法创建验证器",
      secret: null,
      otpauth_url: null,
      error: error,
    };
  }
}

// Function to generate the TOTP URL for use in the TOTP app
function generateTotpUrlForUser(userId, secret) {
  const totp = createTotpInstance(secret, "SHA256", 6, 30);
  return totp.toString();
}

// Function to enable (activate) a TOTP token after validating the token
async function enableTotpToken(userId, totp_id, token) {
  try {
    const isValid = await isTotpTokenValidById(userId, token, totp_id);

    if (!isValid.valid) {
      return { status: "0", message: "无法激活令牌：" + isValid.message };
    }
    const needupdatedTotp = await prisma.ow_users_totp.findUnique({
      where: {
        id: Number(totp_id),
        user_id: Number(userId),
      },
    });
    if (needupdatedTotp.status === "unverified" && isValid.valid) {
      const updatedTotp = await prisma.ow_users_totp.update({
        where: {
          id: Number(totp_id),
          user_id: Number(userId),
        },
        data: {
          status: "enabled",
        },
      });

      return {
        status: "success",
        message: "验证器已激活",
        totp: updatedTotp,
      };
    } else {
      return { status: "0", message: "验证器已被激活或无效" };
    }
  } catch (error) {
    return { status: "0", message: "无法激活验证器", error };
  }
}

// Function to remove a TOTP token
async function removeTotpToken(userId, totp_id) {
  try {
    const result = await prisma.ow_users_totp.delete({
      where: { id: Number(totp_id), user_id: Number(userId) },
      select: { id: true, user_id: true, name: true, type: true, status: true },
    });

    return { status: "success", message: "验证器已删除", totp: result };
  } catch (error) {
    return { status: "0", message: "无法删除验证器",error:error };
  }
}

export  {
  isTotpTokenValid,
  isTotpTokenValidById,
  createTotpTokenForUser,
  enableTotpToken,
  removeTotpToken,
};
