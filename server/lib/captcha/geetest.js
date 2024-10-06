const express = require("express");
const querystring = require("querystring");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// 从配置中读取极验的相关信息
const { GEE_CAPTCHA_ID, GEE_CAPTCHA_KEY, GEE_API_SERVER } =
  global.config.captcha;
const API_URL = `${GEE_API_SERVER}/validate?captcha_id=${GEE_CAPTCHA_ID}`;

// 中间件处理极验验证码验证
app.use(async (req, res, next) => {
  let geetest = {};

  // 处理验证码信息
  try {
    console.log(req.body.captcha);
    if (req.body.captcha) {
      // 如果是字符串则转为json
      if (typeof req.body.captcha === "string") {
        geetest = JSON.parse(req.body.captcha);
      } else {
        geetest = req.body.captcha;
      }
    } else {
      const queryCaptcha = querystring.parse(req.url.split("?")[1]).captcha;
      geetest = queryCaptcha
        ? JSON.parse(queryCaptcha)
        : querystring.parse(req.url.split("?")[1]) || req.body;
    }
  } catch (error) {
    console.error("Captcha Parsing Error:", error);
    res.status(400).send({ code: 400, msg: "Invalid captcha data" });
    return;
  }

  console.log(geetest);

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

  try {
    // 发送请求到极验服务
    const result = await post_form(datas, API_URL);

    if (result.result === "success") {
      next(); // 验证成功，继续处理请求
    } else {
      console.log(`Validate fail: ${result.reason}`);
      res
        .status(500)
        .send({
          code: 500,
          msg: `请完成验证码/${result.reason}`,
          status: `请完成验证码/${result.reason}`,
        });
    }
  } catch (error) {
    console.error("Geetest server error:", error);
    next(); // 极验服务器出错时放行，避免阻塞业务逻辑
  }
});

// 生成签名的函数，使用 HMAC-SHA256
function hmac_sha256_encode(value, key) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest("hex");
}

// 发送 POST 请求
async function post_form(datas, url) {
  try {
    const response = await axios.post(url, null, {
      params: datas,
      timeout: 5000,
    });

    if (response.status !== 200) {
      console.error(`Geetest Response Error, StatusCode: ${response.status}`);
      throw new Error("Geetest Response Error");
    }
    return response.data;
  } catch (error) {
    console.error("Request to Geetest failed:", error);
    throw error;
  }
}

module.exports = app;
