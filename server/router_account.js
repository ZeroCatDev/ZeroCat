const configManager = require("./configManager");

var express = require("express");
var router = express["Router"]();
var fs = require("fs");
var jwt = require("jsonwebtoken");
var DB = require("./lib/database.js");
var I = require("./lib/global.js");
let cryptojs = require("crypto-js");
const { sendEmail } = require("./services/emailService");
const { registrationTemplate, passwordResetTemplate } = require("./services/emailTemplates");
const passport = require("passport");
const TwoFAStartegy = require("passport-2fa-totp").Strategy;
const { authenticator } = require("otplib");

passport.use(new TwoFAStartegy(
  {
    usernameField: 'email',
    passwordField: 'password',
    codeField: 'otp',
    passReqToCallback: true,
  },
  function (req, email, password, done) {
    DB.query('SELECT * FROM ow_users WHERE email = ?', [email], function (err, results) {
      if (err) { return done(err); }
      if (!results.length) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      const user = results[0];
      if (user.password !== password) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  },
  function (req, user, done) {
    if (!user.fa_enabled) {
      return done(null, false, { message: '2FA is not enabled for this user.' });
    }
    return done(null, user, user.fa_secret);
  }
));

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  DB.query('SELECT * FROM ow_users WHERE id = ?', [id], function (err, results) {
    if (err) { return done(err); }
    done(null, results[0]);
  });
});

router.all("*", function (req, res, next) {
  next();
});
(async () => {
    try {
        console.log('site.name:', await configManager.getConfig('site.name'));

        // 其他逻辑...
    } catch (error) {
        console.error('Error:', error);
    }
})();

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
//geetest,
router.post("/login",  async function (req, res, next) {
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
    DB.qww(SQL, WHERE, async function (err, USER) {
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
        if (res.locals["email"].indexOf(await configManager.getConfig('security.adminuser')) == 0) {
          if (res.locals["email"] == await configManager.getConfig('security.adminuser')) {
            res.locals["is_admin"] = 1;
          } else {
            let no = parseInt(res.locals["email"].substring(8));
            if (0 <= no && no < 100) {
              res.locals["is_admin"] = 1;
            }
          }
        }

        // res.cookie("userid", User["id"], { maxAge: 604800000, signed: true });
        // res.cookie("email", User["email"], { maxAge: 604800000, signed: true, });
        // res.cookie("username", User["username"], { maxAge: 604800000, signed: true, });
        // res.cookie("display_name", User["display_name"], { maxAge: 604800000, signed: true, });

        var token =await I.GenerateJwt({
          userid: User["id"],
          username: User["username"],
          email: User["email"],
          display_name: User["display_name"],
          avatar: User["images"],
        });
        //console.log(token);
        // res.cookie("token", token, { maxAge: 604800000 });
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

  // res.cookie("userid", "", { maxAge: 0, signed: true });
  // res.cookie("email", "", { maxAge: 0, signed: true });
  // res.cookie("display_name", "", { maxAge: 0, signed: true });
  // res.cookie("token", "", { maxAge: 0, signed: true });
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
      DB.query(INSERT, async function (err, newUser) {
        if (err) {
          console.error(err);
          res.status(200).send({ message: "再试一次17" });
          return;
        }
        var userid = newUser.insertId;

        sendEmail(
          email,
          `${await configManager.getConfig('site.name')}社区注册消息`,
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
    DB.qww(SQL, w, async function (err, User) {
      if (err) {
        res.status(200).send({ message: "账户格式错误或不存在" });
        return;
      }
      var user = User[0];
      var jwttoken = jwt.sign(
        { userid: user["id"], email: user["email"] },
        await configManager.getConfig('security.jwttoken'),
        { expiresIn: 60 * 10 }
      );

      sendEmail(
        email,
        `${await configManager.getConfig('site.name')}密码重置消息`,
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
      await configManager.getConfig('security.jwttoken'),
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

router.post("/2fa/setup", passport.authenticate('local', { session: false }), async function (req, res, next) {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, await configManager.getConfig('2FA_ISSUER'), secret);

    await I.prisma.ow_users.update({
      where: { id: req.user.id },
      data: { fa_secret: secret, fa_enabled: true },
    });

    res.status(200).send({ otpauth });
  } catch (err) {
    next(err);
  }
});

router.post("/2fa/verify", passport.authenticate('local', { session: false }), async function (req, res, next) {
  try {
    const isValid = authenticator.check(req.body.otp, req.user.fa_secret);
    if (!isValid) {
      return res.status(401).send({ message: 'Invalid OTP' });
    }
    res.status(200).send({ message: '2FA verification successful' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
