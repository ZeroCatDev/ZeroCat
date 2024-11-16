import configManager from "../configManager.js";

import { createHash } from "crypto";
import jsonwebtoken from 'jsonwebtoken';
import { PasswordHash } from "phpass";
const pwdHash = new PasswordHash();
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// prisma client
const prisma = new PrismaClient();
const _prisma = prisma;
export { _prisma as prisma };
let s3config;

(async () => {
  try {
    const configKeys = [
      "s3.endpoint",
      "s3.region",
      "s3.AWS_ACCESS_KEY_ID",
      "s3.AWS_SECRET_ACCESS_KEY",
    ];

    const configValues = await Promise.all(
      configKeys.map((key) => configManager.getConfig(key))
    );

    s3config = {
      endpoint: configValues[0],
      region: configValues[1],
      credentials: {
        accessKeyId: configValues[2],
        secretAccessKey: configValues[3],
      },
    };
  } catch (error) {
    console.error("Error retrieving S3 config:", error);
  } finally {
    // Optionally disconnect Prisma client if needed
    // await configManager.prisma.$disconnect();
  }
})();

// Create an S3 client
const s3 = new S3Client(s3config);

// 上传文件到 S3
export async function S3update(name, file) {
  try {
    const fileContent = readFileSync(file);
    const command = new PutObjectCommand({
      Bucket: await configManager.getConfig("s3.bucket"),
      Key: name,
      Body: fileContent,
    });

    const data = await s3.send(command);
    console.log(data);
    console.log(`成功上传了文件 ${await configManager.getConfig("s3.bucket")}/${name}`);
  } catch (err) {
    console.error("S3 update Error:", err);
  }
}

// 创建 MD5 哈希值
export function md5(data) {
  return createHash("md5").update(data).digest("base64");
}

// 密码哈希与校验
export function hash(data) {
  return pwdHash.hashPassword(data);
}
export function checkhash(pwd, storeHash) {
  return pwdHash.checkPassword(pwd, storeHash);
}

// 校验用户密码格式
export function userpwTest(pw) {
  return /^(?:\d+|[a-zA-Z]+|[!@#$%^&*]+){6,16}$/.test(pw);
}

// 校验邮箱格式
export function emailTest(email) {
  return /^([a-zA-Z]|[0-9])(\w|\-)+@[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/.test(email);
}

// 校验手机号格式
export function phoneTest(phone) {
  return /^1[3456789]\d{9}$/.test(phone);
}

export const msg_fail = { status: "fail", msg: "请再试一次19" };

// 生成随机密码
export function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"; // 默认去掉混淆字符
  const maxPos = chars.length;
  let password = Array.from({ length: len - 4 }, () =>
    chars.charAt(Math.floor(Math.random() * maxPos))
  ).join("");
  return `${password}@Aa1`;
}

// JWT 生成与校验
export function jwt(data) {
  const token = jwt.sign(data, "test");
  console.log(token);
  return token;
}

export async function GenerateJwt(json) {
  try {
    // Retrieve the JWT secret from config
    const secret = await configManager.getConfig("security.jwttoken");
    console.log(secret);
    // Check if the secret is defined
    if (!secret) {
      throw new Error("JWT secret is not defined in the configuration");
    }

    // Generate and return the JWT
    return jsonwebtoken.sign(json, secret);
  } catch (error) {
    console.error("Error generating JWT:", error);
    throw error; // Rethrow or handle as needed
  }
}

// 判断是否为 JSON 字符串
export function isJSON(str) {
  if (typeof str !== "string") return false;
  try {
    const obj = JSON.parse(str);
    return obj && typeof obj === "object";
  } catch (e) {
    console.error("error:", str, e);
    return false;
  }
}
