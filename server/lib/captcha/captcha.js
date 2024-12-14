import { error as _error, debug } from "../logger.js";
import { getConfig } from "../configManager.js";

import express from "express";

const app = express();
import { post } from "request";

app.use(async (req, res, next) => {
  const recaptcha =
    req.body.recaptcha || req.body.re || req.query.recaptcha || req.query.re;

  if (!recaptcha) {
    return res.status(200).send({ message: "请完成验证码" });
  }

  post(
    {
      url: await getConfig('captcha.reverify'),
      form: { secret: await getConfig('captcha.resecret'), response: recaptcha },
    },
    function (error, httpResponse, body) {
      if (error) {
        _error("Error verifying recaptcha:", error);
        res.status(200).send({ message: "验证码验证失败", error: error });
      }

      const response = JSON.parse(body);
      debug(response);
      if (response.success) {
        next();
      } else {
        res.status(200).send({ message: "验证码无效", response: response });
      }
    }
  );
});

export default app;
