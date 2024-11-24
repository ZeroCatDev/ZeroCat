const configManager = require("../configManager");
const logger = require("../logger");

const crypto = require("crypto");
const jwt = require("jsonwebtoken"); // 确保安装了 jsonwebtoken 库
const { PasswordHash } = require("phpass");
const pwdHash = new PasswordHash();
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// prisma client
const prisma = new PrismaClient();
exports.prisma = prisma;
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
    logger.error("Error retrieving S3 config:", error);
  } finally {
    // Optionally disconnect Prisma client if needed
    // await configManager.prisma.$disconnect();
  }
})();

// Create an S3 client
const s3 = new S3Client(s3config);

// 上传文件到 S3
exports.S3update = async function (name, file) {
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
};

// 创建 MD5 哈希值
exports.md5 = (data) => crypto.createHash("md5").update(data).digest("base64");

// 密码哈希与校验
exports.hash = (data) => pwdHash.hashPassword(data);
exports.checkhash = (pwd, storeHash) => pwdHash.checkPassword(pwd, storeHash);

// 校验用户密码格式
exports.userpwTest = (pw) => /^(?:\d+|[a-zA-Z]+|[!@#$%^&*]+){6,16}$/.test(pw);

// 校验邮箱格式
exports.emailTest = (email) =>
  /^([a-zA-Z]|[0-9])(\w|\-)+@[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/.test(email);

// 校验手机号格式
exports.phoneTest = (phone) => /^1[3456789]\d{9}$/.test(phone);

// 常用失败返回信息
exports.msg_fail = { status: "fail", msg: "请再试一次19" };

// 生成随机密码
exports.randomPassword = (len = 12) => {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"; // 默认去掉混淆字符
  const maxPos = chars.length;
  let password = Array.from({ length: len - 4 }, () =>
    chars.charAt(Math.floor(Math.random() * maxPos))
  ).join("");
  return `${password}@Aa1`;
};

// JWT 生成与校验
exports.jwt = (data) => {
  const token = jwt.sign(data, "test");
  logger.debug(token);
  return token;
};


exports.GenerateJwt = async (json) => {
    try {
        // Retrieve the JWT secret from config
        const secret = await configManager.getConfig("security.jwttoken");
logger.debug(secret)
        // Check if the secret is defined
        if (!secret) {
            throw new Error('JWT secret is not defined in the configuration');
        }

        // Generate and return the JWT
        return jwt.sign(json, secret);
    } catch (error) {
        logger.error('Error generating JWT:', error);
        throw error; // Rethrow or handle as needed
    }
};

// 判断是否为 JSON 字符串
exports.isJSON = (str) => {
  if (typeof str !== "string") return false;
  try {
    const obj = JSON.parse(str);
    return obj && typeof obj === "object";
  } catch (e) {
    logger.error("error:", str, e);
    return false;
  }
};
