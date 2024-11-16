const configManager = require("./configManager.js");
var express = require("express");
var router = express["Router"]();
var fs = require("fs");
var jwt = require("jsonwebtoken");
var DB = require("./lib/database.js");
var I = require("./lib/global.js");
let cryptojs = require("crypto-js");
const needlogin = require("./lib/needlogin.js");


router.all("*", function (req, res, next) {
  next();
});

const request = require("request");


router.get("/logout", function (req, res) {
  logout(req, res);
  res.redirect("/");
});

router.get("/tuxiaochao", async function (req, res) {
  if (!res.locals.login) {
    res.redirect(
      "https://support.qq.com/product/" +
        (await configManager.getConfig("feedback.txcid"))
    );
  }
  if (!(await configManager.getConfig("feedback.txcid"))) {
    res.redirect("https://support.qq.com/product/597800");
  }
  if (!(await configManager.getConfig("feedback.txckey"))) {
    res.redirect(
      "https://support.qq.com/product/" +
        (await configManager.getConfig("feedback.txcid"))
    );
  }

  SQL = `SELECT images FROM ow_users WHERE id = ${res.locals["userid"]};`;

  DB.query(SQL, async function (err, USER) {
    if (err || USER.length == 0) {
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
      res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
      return;
    }
    uid = res.locals["userid"].toString();
    var txcinfo =
      uid +
      res.locals["display_name"] +
      (await configManager.getConfig("s3.staticurl")) +
      "/user/" +
      USER[0].images +
      (await configManager.getConfig("feedback.txckey"));
    var cryptostr = cryptojs.MD5(txcinfo).toString();

    res.redirect(
      "https://support.qq.com/product/" +
        (await configManager.getConfig("feedback.txcid")) +
        "?openid=" +
        res.locals["userid"] +
        "&nickname=" +
        res.locals["display_name"] +
        "&avatar=" +
        (await configManager.getConfig("s3.staticurl")) +
        "/user/" +
        USER[0].images +
        "&user_signature=" +
        cryptostr
    );
  });
});

module.exports = router;
