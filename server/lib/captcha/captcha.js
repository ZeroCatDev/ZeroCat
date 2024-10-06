const express = require("express");

const app = express();
const request = require("request");

app.use((req, res, next) => {
  const recaptcha =
    req.body.recaptcha || req.body.re || req.query.recaptcha || req.query.re;

  if (!recaptcha) {
    return res.status(200).send({ message: "请完成验证码" });
  }

  request.post(
    {
      url: global.config.captcha.reverify,
      form: { secret: global.config.captcha.resecret, response: recaptcha },
    },
    function (error, httpResponse, body) {
      if (error) {
        console.error("Error verifying recaptcha:", error);
        res.status(200).send({ message: "验证码验证失败", error: error });
      }

      const response = JSON.parse(body);
      console.log(response);
      if (response.success) {
        next();
      } else {
        res.status(200).send({ message: "验证码无效", response: response });
      }
    }
  );
});

module.exports = app;
