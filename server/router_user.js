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

router.get("/", function (req, res) {
  res.render("user.ejs");
});

router.get("/login", function (req, res) {
  var SQL = `SELECT id FROM sys_ini WHERE iniKey='regist' AND iniValue=1 LIMIT 1`;
  DB.query(SQL, function (err, Regist) {
    if (err || Regist.length == 0) {
      res.locals.reg = 0;
    } else {
      res.locals.reg = 1;
    }

    res.render("login_or_register.ejs");
  });
});

router.get("/repw", function (req, res) {
  res.render("repw.ejs");
});

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
      res.render("404.ejs");
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
