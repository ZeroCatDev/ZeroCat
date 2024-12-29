import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import axios from "axios";
import { parse } from "url";
import { createHmac } from "crypto";

const GEE_CAPTCHA_ID = await configManager.getConfig("captcha.GEE_CAPTCHA_ID");
const GEE_CAPTCHA_KEY = await configManager.getConfig("captcha.GEE_CAPTCHA_KEY");
const GEE_API_SERVER = await configManager.getConfig("captcha.GEE_API_SERVER");
const API_URL = `${GEE_API_SERVER}/validate?captcha_id=${GEE_CAPTCHA_ID}`;
logger.debug(API_URL);

/**
 * 生成签名的函数，使用 HMAC-SHA256
 * @param {String} value - 待签名的字符串
 * @param {String} key - 签名密钥
 * @returns {String} 签名结果
 */
function hmacSha256Encode(value, key) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/**
 * 验证码中间件
 * @param {Object} req - express的request对象
 * @param {Object} res - express的response对象
 * @param {Function} next - express的next函数
 */
async function geetestMiddleware(req, res, next) {

  // 如果是开发环境，直接放行
  if (process.env.NODE_ENV === "development") {
    logger.debug("In development environment, bypass geetest validation.");
    next();
    return;
  }

  // 验证码信息
  let geetest = {};

  // 处理验证码信息
  try {
    logger.debug(req.body.captcha);
    if (req.body.captcha) {
      // 如果是字符串则转为json
      if (typeof req.body.captcha === "string") {
        geetest = JSON.parse(req.body.captcha);
      } else {
        geetest = req.body.captcha;
      }
    } else {
      const queryCaptcha = parse(req.url.split("?")[1]).captcha;
      geetest = queryCaptcha
        ? JSON.parse(queryCaptcha)
        : parse(req.url.split("?")[1]) || req.body;
    }
  } catch (error) {
    logger.error("Captcha Parsing Error:", error);
    res.status(400).send({ code: 400, msg: "Invalid captcha data" });
    return;
  }

  logger.debug(geetest);

  // 生成签名
  const signToken = hmacSha256Encode(geetest.lot_number, GEE_CAPTCHA_KEY);

  // 准备请求参数
  const datas = {
    lot_number: geetest.lot_number,
    captcha_output: geetest.captcha_output,
    pass_token: geetest.pass_token,
    gen_time: geetest.gen_time,
    sign_token,
  };
  logger.debug(datas);
  try {
    // 发送请求到极验服务
    logger.debug("Sending request to Geetest server...");
    logger.debug(API_URL);
    const result = await axios.post(API_URL, datas);

    if (result.data.result === "success") {
      next(); // 验证成功，继续处理请求
    } else {
      logger.debug(`Validate fail: ${result.data.reason}`);
      res.status(500).send({
        code: 500,
        msg: `请完成验证码/${result.data.reason}`,
        status: `请完成验证码/${result.data.reason}`,
      });
    }
  } catch (error) {
    logger.error("Geetest server error:", error);
    next(); // 极验服务器出错时放行，避免阻塞业务逻辑
  }
};

export default geetestMiddleware;

