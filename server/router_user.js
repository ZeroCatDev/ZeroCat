const configManager = require("./configManager.js");

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
      "https://support.qq.com/product/" + await configManager.getConfig('feedback.txcid')
    );
  }
  if (!await configManager.getConfig('feedback.txcid')) {
    res.redirect("https://support.qq.com/product/597800");
  }
  if (!await configManager.getConfig('feedback.txckey')) {
    res.redirect(
      "https://support.qq.com/product/" + await configManager.getConfig('feedback.txcid')
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
      await configManager.getConfig('s3.staticurl') +
      "/user/" +
      USER[0].images +
      await configManager.getConfig('feedback.txckey');
    var cryptostr = cryptojs.MD5(txcinfo).toString();

    res.redirect(
      "https://support.qq.com/product/" +
        await configManager.getConfig('feedback.txcid') +
        "?openid=" +
        res.locals["userid"] +
        "&nickname=" +
        res.locals["display_name"] +
        "&avatar=" +
        await configManager.getConfig('s3.staticurl') +
        "/user/" +
        USER[0].images +
        "&user_signature=" +
        cryptostr
    );
  });
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
