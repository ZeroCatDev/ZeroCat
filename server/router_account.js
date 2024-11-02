var express = require("express");
var router = express["Router"]();
var fs = require("fs");
var jwt = require("jsonwebtoken");
var DB = require("./lib/database.js");
var I = require("./lib/global.js");
let cryptojs = require("crypto-js");
const { sendEmail } = require("./lib/email");
const { registrationTemplate, passwordResetTemplate } = require("./lib/emailTemplates");
router.all("*", function (req, res, next) {
  next();
});

const request = require("request");
router.get("/", function (req, res) {
  res.render("user.ejs");
});

router.get("/login", function (req, res, next) {
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
const geetest = require("./lib/captcha/geetest.js");

router.post("/login", geetest, async function (req, res, next) {
  try {
    if (
      !req.body.pw ||
      !I.userpwTest(req.body.pw) ||
      !req.body.un ||
      !I.emailTest(req.body.un)
    ) {
      res.status(200).send({ message: "账户或密码错误" });
      return;
    }

    var SQL = `SELECT * FROM ow_users WHERE email=? LIMIT 1`;
    var WHERE = [`${req.body["un"]}`];
    DB.qww(SQL, WHERE, function (err, USER) {
      if (err || USER.length == 0) {
        res.status(200).send({ message: "账户或密码错误" });
        return;
      }

      var User = USER[0];
      pw = I.hash(req.body.pw);
      if (I.checkhash(req.body.pw, User["password"]) == false) {
        res.status(200).send({ message: "账户或密码错误" });
      } else if (User["state"] == 2) {
        res.status(200).send({ message: "您已经被封号，请联系管理员" });
      } else {
        res.locals["userid"] = User["id"];
        res.locals["username"] = User["username"];
        res.locals["email"] = User["email"];
        res.locals["display_name"] = User["display_name"];

        res.locals["is_admin"] = 0;
        if (res.locals["email"].indexOf(global.config.security.adminuser) == 0) {
          if (res.locals["email"] == global.config.security.adminuser) {
            res.locals["is_admin"] = 1;
          } else {
            let no = parseInt(res.locals["email"].substring(8));
            if (0 <= no && no < 100) {
              res.locals["is_admin"] = 1;
            }
          }
        }

        res.cookie("userid", User["id"], { maxAge: 604800000, signed: true });
        res.cookie("email", User["email"], {
          maxAge: 604800000,
          signed: true,
        });
        res.cookie("username", User["username"], {
          maxAge: 604800000,
          signed: true,
        });
        res.cookie("display_name", User["display_name"], {
          maxAge: 604800000,
          signed: true,
        });
        var token = I.GenerateJwt({
          userid: User["id"],
          username: User["username"],
          email: User["email"],
          display_name: User["display_name"],
          avatar: User["images"],
        });
        console.log(token);
        res.cookie("token", token, { maxAge: 604800000 });
        res.status(200).send({
          status: "OK",
          message: "OK",
          userid: parseInt(User["id"]),
          email: User["email"],
          username: User["username"],
          display_name: User["display_name"],
          avatar: User["images"],
          token: token,
        });
      }
    });
  } catch (err) {
    next(err);
  }
});

var logout = function (req, res) {
  res.locals["userid"] = null;
  res.locals["email"] = null;

  res.cookie("userid", "", { maxAge: 0, signed: true });
  res.cookie("email", "", { maxAge: 0, signed: true });
  res.cookie("display_name", "", { maxAge: 0, signed: true });
  res.cookie("token", "", { maxAge: 0, signed: true });
};

router.get("/logout", function (req, res) {
  logout(req, res);
  res.redirect("/");
});

router.post("/register", geetest, async function (req, res, next) {
  try {
    var email = req.body.un;
    SQL = `SELECT id FROM ow_users WHERE email='${email}' LIMIT 1`;
    DB.query(SQL, function (err, User) {
      if (err) {
        res.status(200).send({ message: "账户格式错误" });
        return;
      }
      if (User.length > 0) {
        res.status(200).send({ message: "账户已存在" });
        return;
      }

      var randonpw = I.randomPassword(12);
      pw = I.hash(randonpw);
      var display_name = req.body.pw;
      var INSERT = `INSERT INTO ow_users (username,email,password,display_name) VALUES ('${Date.now()}','${email}','${pw}','${display_name}')`;
      DB.query(INSERT, function (err, newUser) {
        if (err) {
          console.error(err);
          res.status(200).send({ message: "再试一次17" });
          return;
        }
        var userid = newUser.insertId;

        sendEmail(
          email,
          `${global.config.site.name}社区注册消息`,
          registrationTemplate(email, randonpw)
        );

        res.status(200).send({ message: "注册成功,请查看邮箱获取账户数据" });
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/repw", geetest, async function (req, res, next) {
  try {
    if (req.body.un == "" || req.body.un == null) {
      res.status(200).send({ message: "账户格式错误" });
      return;
    }
    var email = req.body.un;
    SQL = `SELECT * FROM ow_users WHERE email=? LIMIT 1`;
    w = [email];
    DB.qww(SQL, w, function (err, User) {
      if (err) {
        res.status(200).send({ message: "账户格式错误或不存在" });
        return;
      }
      var user = User[0];
      var jwttoken = jwt.sign(
        { userid: user["id"], email: user["email"] },
        global.config.security.jwttoken,
        { expiresIn: 60 * 10 }
      );

      sendEmail(
        email,
        `${global.config.site.name}密码重置消息`,
        passwordResetTemplate(email, jwttoken)
      );

      res.status(200).send({ message: "请查看邮箱" });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/torepw", geetest, async function (req, res, next) {
  try {
    var user1 = jwt.verify(
      req.body.jwttoken,
      global.config.security.jwttoken,
      function (err, decoded) {
        if (err) {
          res.status(200).send({ message: "token错误或过期" });
          return;
        }
        userid = decoded.userid;
        email = decoded.email;
      }
    );
    var newPW = I.hash(req.body.pw);
    SET = { password: newPW };
    UPDATE = `UPDATE ow_users SET ? WHERE id=${userid} LIMIT 1`;
    DB.qww(UPDATE, SET, function (err, u) {
      if (err) {
        res.status(200).send({ message: "请再试一次" });
        return;
      }
      res.status(200).send({ message: "您的密码已更新" });
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
