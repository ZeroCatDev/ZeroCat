//用户账号功能路由：注册、登录等
var express = require("express");
var router = express["Router"]();
//数据库
var DB = require("./lib/database.js");
//功能函数集
var I = require("./lib/global.js");
let cryptojs = require("crypto-js");
router.all("*", function (req, res, next) {
  next();
});



router.get("/", function (req, res) {
      res.render("user.ejs");
});

router.get("/tuxiaochao", function (req, res) {
  if (!res.locals.login) {
    res.redirect("https://support.qq.com/product/" + process.env.txcid);
  }
  if (!process.env.txcid) {
    res.redirect("https://support.qq.com/product/597800");
  }
  if (!process.env.txckey) {
    res.redirect("https://support.qq.com/product/" + process.env.txcid);
  }

  SQL = `SELECT images FROM ow_users WHERE id = ${res.locals["userid"]};`;

  DB.query(SQL, function (err, USER) {
    if (err || USER.length == 0) {
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
      res.render("404.ejs");
      return;
    }
    uid = res.locals["userid"].toString();
    var txcinfo =
      uid +
      res.locals["display_name"] +
      process.env.S3staticurl+'/user/'+USER[0].images+
      process.env.txckey;
    var cryptostr = cryptojs.MD5(txcinfo).toString();

    res.redirect(
      "https://support.qq.com/product/" +
        process.env.txcid +
        "?openid=" +
        res.locals["userid"] +
        "&nickname=" +
        res.locals["display_name"] +
        "&avatar="+process.env.S3staticurl+'/user/'+USER[0].images+
        "&user_signature=" +
        cryptostr
    );

  });

});

module.exports = router;
