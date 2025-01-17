import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import axios from "axios";
import { createHmac } from "crypto";

const GEE_CAPTCHA_ID = await configManager.getConfig("captcha.GEE_CAPTCHA_ID");
const GEE_CAPTCHA_KEY = await configManager.getConfig("captcha.GEE_CAPTCHA_KEY");
const GEE_API_SERVER = "http://gcaptcha4.geetest.com/validate";
logger.debug(GEE_API_SERVER);

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
  if (process.env.NODE_ENV === "development") {
    return next(); // 开发环境下不验证验证码
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
      geetest = req.query || req.body;
    }
  } catch (error) {
    logger.error("Captcha Parsing Error:", error);
    res.status(400).send({ code: 400, message: "Invalid captcha data" });
    return;
  }

  if (!geetest.lot_number || !geetest.captcha_output || !geetest.captcha_id || !geetest.pass_token || !geetest.gen_time) {
    logger.error("Captcha data missing");
    res.status(400).send({ code: 400, message: "Captcha data missing" });
    return;
  }

  logger.debug(geetest);

  // 生成签名
  const sign_token = hmacSha256Encode(geetest.lot_number, GEE_CAPTCHA_KEY);

  // 准备请求参数
  const datas = {
    lot_number: geetest.lot_number,
    captcha_output: geetest.captcha_output,
    captcha_id: geetest.captcha_id,
    pass_token: geetest.pass_token,
    gen_time: geetest.gen_time,
    sign_token,
  };
  logger.debug(datas);

  try {
    // 发送请求到极验服务
    logger.debug("Sending request to Geetest server...");
    const result = await axios.post(GEE_API_SERVER, datas, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    logger.debug(result.data);

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
}

export default geetestMiddleware;

