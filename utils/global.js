import configManager from "./configManager.js";
import logger from "./logger.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PasswordHash } from "phpass";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const pwdHash = new PasswordHash();
const prisma = new PrismaClient();
const s3config = {
  endpoint: await configManager.getConfig("s3.endpoint"),
  region: await configManager.getConfig("s3.region"),
  credentials: {
    accessKeyId: await configManager.getConfig("s3.AWS_ACCESS_KEY_ID"),
    secretAccessKey: await configManager.getConfig("s3.AWS_SECRET_ACCESS_KEY"),
  },
};
logger.debug(s3config);

const s3 = new S3Client(s3config);

async function S3update(name, file) {
  try {
    const fileContent = fs.readFileSync(file);
    const command = new PutObjectCommand({
      Bucket: await configManager.getConfig("s3.bucket"),
      Key: name,
      Body: fileContent,
    });

    const data = await s3.send(command);
    logger.debug(data);
    logger.debug(
      `成功上传了文件 ${await configManager.getConfig("s3.bucket")}/${name}`
    );
  } catch (err) {
    logger.error("S3 update Error:", err);
  }
}

function md5(data) {
  return crypto.createHash("md5").update(data).digest("base64");
}

function hash(data) {
  return pwdHash.hashPassword(data);
}

function checkhash(pwd, storeHash) {
  return pwdHash.checkPassword(pwd, storeHash);
}

function userpwTest(pw) {
  return /^(?:\d+|[a-zA-Z]+|[!@#$%^&*]+){6,16}$/.test(pw);
}

function emailTest(email) {
  return /^([a-zA-Z]|[0-9])(\w|\-)+@[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/.test(email);
}

function phoneTest(phone) {
  return /^1[3456789]\d{9}$/.test(phone);
}

const msg_fail = { status: "fail", msg: "请再试一次19" };

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  const maxPos = chars.length;
  const password = Array.from({ length: len - 4 }, () =>
    chars.charAt(Math.floor(Math.random() * maxPos))
  ).join("");
  return `${password}@Aa1`;
}

async function generateJwt(json) {
  try {
    const secret = await configManager.getConfig("security.jwttoken");
    logger.debug(secret);
    if (!secret) {
      throw new Error("JWT secret is not defined in the configuration");
    }
    return jwt.sign(json, secret);
  } catch (error) {
    logger.error("Error generating JWT:", error);
    throw error;
  }
}

function isJSON(str) {
  if (typeof str !== "string") return false;
  try {
    const obj = JSON.parse(str);
    return obj && typeof obj === "object";
  } catch (e) {
    logger.error("error:", str, e);
    return false;
  }
}

export {
  prisma,
  S3update,
  md5,
  hash,
  checkhash,
  userpwTest,
  emailTest,
  phoneTest,
  msg_fail,
  randomPassword,
  generateJwt,
  isJSON,
};

