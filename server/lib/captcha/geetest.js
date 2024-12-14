import logger from "../logger.js";
import configManager from "../../configManager.js";

import express from "express";
import { parse } from "querystring";
import { createHmac } from "crypto";
import axios from "axios";

const app = express();

// 从配置中读取极验的相关信息

const GEE_CAPTCHA_ID = await configManager.getConfig("captcha.GEE_CAPTCHA_ID");
const GEE_CAPTCHA_KEY = await configManager.getConfig("captcha.GEE_CAPTCHA_KEY");
const GEE_API_SERVER = await configManager.getConfig("captcha.GEE_API_SERVER");
const API_URL = `${GEE_API_SERVER}/validate?captcha_id=${GEE_CAPTCHA_ID}`;
logger.debug(API_URL);

// 中间件处理极验验证码验证
app.use(async (req, res, next) => {
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
  const sign_token = hmac_sha256_encode(geetest.lot_number, GEE_CAPTCHA_KEY);

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
    const result = await axios({
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      url: API_URL, // 极验验证码验证接口
      data: datas,
    });

    if (result.data.result === "success") {
      next(); // 验证成功，继续处理请求
    } else {
      console.log(result.data);
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
});

// 生成签名的函数，使用 HMAC-SHA256
function hmac_sha256_encode(value, key) {
  logger.debug(value);
  logger.debug(key);
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export default app;
