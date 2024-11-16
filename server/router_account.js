import configManager from "./configManager.js";

import express from "express";
var router = express["Router"]();
import jsonwebtoken from "jsonwebtoken";
import { qww, query } from "./lib/database.js";
import { userpwTest, emailTest, hash, checkhash, GenerateJwt, randomPassword, prisma } from "./lib/global.js";
import { sendEmail } from "./services/emailService.js";
import { registrationTemplate, passwordResetTemplate } from "./services/emailTemplates.js";
import needlogin from "./lib/needlogin.js";

import { isTotpTokenValid, createTotpTokenForUser, enableTotpToken, removeTotpToken } from "./lib/totpUtils.js";
import validateTotpToken from "./lib/validateTotpToken.js"; // Import the middleware
router.all("*", function (req, res, next) {
  next();
});
/*
(async () => {
  try {
    console.log("site.name:", await configManager.getConfig("site.name"));

    // 其他逻辑...
  } catch (error) {
    console.error("Error:", error);
  }
})();
*/



import geetest from "./lib/captcha/geetest.js";
//geetest,
router.post("/login", async function (req, res, next) {
  try {
    if (
      !req.body.pw ||
      !userpwTest(req.body.pw) ||
      !req.body.un ||
      !emailTest(req.body.un)
    ) {
      res.status(200).send({ message: "账户或密码错误" });
      return;
    }

    var SQL = `SELECT * FROM ow_users WHERE email=? LIMIT 1`;
    var WHERE = [`${req.body["un"]}`];
    qww(SQL, WHERE, async function (err, USER) {
      if (err || USER.length == 0) {
        res.status(200).send({ message: "账户或密码错误" });
        return;
      }

      var User = USER[0];
      pw = hash(req.body.pw);
      if (checkhash(req.body.pw, User["password"]) == false) {
        res.status(200).send({ message: "账户或密码错误" });
      } else if (User["state"] == 2) {
        res.status(200).send({ message: "您已经被封号，请联系管理员" });
      } else {
        res.locals["userid"] = User["id"];
        res.locals["username"] = User["username"];
        res.locals["email"] = User["email"];
        res.locals["display_name"] = User["display_name"];

        res.locals["is_admin"] = 0;
        if (
          res.locals["email"].indexOf(
            await configManager.getConfig("security.adminuser")
          ) == 0
        ) {
          if (
            res.locals["email"] ==
            (await configManager.getConfig("security.adminuser"))
          ) {
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

        var token = await GenerateJwt({
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
    query(SQL, function (err, User) {
      if (err) {
        res.status(200).send({ message: "账户格式错误" });
        return;
      }
      if (User.length > 0) {
        res.status(200).send({ message: "账户已存在" });
        return;
      }

      var randonpw = randomPassword(12);
      pw = hash(randonpw);
      var display_name = req.body.pw;
      var INSERT = `INSERT INTO ow_users (username,email,password,display_name) VALUES ('${Date.now()}','${email}','${pw}','${display_name}')`;
      query(INSERT, async function (err, newUser) {
        if (err) {
          console.error(err);
          res.status(200).send({ message: "再试一次17" });
          return;
        }
        var userid = newUser.insertId;

        sendEmail(
          email,
          `${await configManager.getConfig("site.name")}社区注册消息`,
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
    qww(SQL, w, async function (err, User) {
      if (err) {
        res.status(200).send({ message: "账户格式错误或不存在" });
        return;
      }
      var user = User[0];
      var jwttoken = jsonwebtoken.sign(
        { userid: user["id"], email: user["email"] },
        await configManager.getConfig("security.jwttoken"),
        { expiresIn: 60 * 10 }
      );

      sendEmail(
        email,
        `${await configManager.getConfig("site.name")}密码重置消息`,
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
    jsonwebtoken.verify(
      req.body.jwttoken,
      await configManager.getConfig("security.jwttoken"),
      function (err, decoded) {
        if (err) {
          res.status(200).send({ message: "token错误或过期" });
          return;
        }
        userid = decoded.userid;
        email = decoded.email;
      }
    );
    var newPW = hash(req.body.pw);
    SET = { password: newPW };
    UPDATE = `UPDATE ow_users SET ? WHERE id=${userid} LIMIT 1`;
    qww(UPDATE, SET, function (err, u) {
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

router.get("/totp/list", needlogin, async (req, res) => {
  try {
    var totpData = await prisma.ow_users_totp.findMany({
      where: { user_id: Number(res.locals.userid) },
      select: {
        id: true,
        user_id: true,
        name: true,
        type: true,
        status: true,
      },
    });
    // 获取列表中status为unverified的数量并从列表中删除这些数据
    const unverifiedTotpCount = totpData.filter(
      (totp) => totp.status === "unverified"
    ).length;
    totpData = totpData.filter((item) => item.status !== "unverified");

    return res.json({
      status: "success",
      message: "获取成功",
      data: {
        list: totpData,
        unverified: unverifiedTotpCount,
      },
    });
  } catch (error) {
    console.error("获取验证器列表时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "获取验证器列表失败",
      error: error.message,
    });
  }
});
router.post("/totp/rename", needlogin, async (req, res) => {
  const { totp_id, name } = req.body;
  if (!totp_id || !name) {
    return res.status(400).json({
      status: "error",
      message: "TOTP ID 和名称是必需的",
    });
  }
  try {
    var renamedTotp = await prisma.ow_users_totp.update({
      where: { id: Number(totp_id) },
      data: { name: name },
      select: {
        id: true,
        user_id: true,
        name: true,
        type: true,
        status: true,
      },
    });
    return res.json({
      status: "success",
      message: "验证器已重命名",
      data: renamedTotp,
    });
  } catch (error) {
    console.error("重命名验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "重命名验证器失败",
      error: error.message,
    });
  }
});
router.post("/totp/check", async (req, res) => {
  const { totp_token, userId } = req.body;
  if (!totp_token || !userId) {
    return res.status(400).json({
      status: "error",
      message: "验证器令牌和用户 ID 是必需的",
    });
  }

  try {
    const isValid = await isTotpTokenValid(userId, totp_token);
    return res.json({
      status: "success",
      message: "令牌验证结果",
      data: { validated: isValid },
    });
  } catch (error) {
    console.error("验证令牌时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "验证令牌失败",
      error: error.message,
    });
  }
});
router.post("/totp/delete", needlogin, async (req, res) => {
  const { totp_id } = req.body;
  if (!totp_id) {
    return res.status(400).json({
      status: "error",
      message: "验证器 ID 是必需的",
    });
  }
  try {
    const deletedTotp = await removeTotpToken(res.locals.userid, totp_id);
    return res.json({
      status: "success",
      message: "验证器已删除",
      data: deletedTotp,
    });
  } catch (error) {
    console.error("删除验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "删除验证器失败",
      error: error.message,
    });
  }
});
router.post("/totp/generate", needlogin, async (req, res) => {
  try {
    const info = await createTotpTokenForUser(res.locals.userid);
    return res.json({
      status: "success",
      message: "验证器创建成功",
      data: info,
    });
  } catch (error) {
    console.error("创建验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "创建验证器失败",
      error: error.message,
    });
  }
});

router.post("/totp/activate", needlogin, async (req, res) => {
  const { totp_id, totp_token } = req.body;

  if (!totp_id || !totp_token) {
    return res.status(400).json({
      status: "error",
      message: "验证器ID和令牌是必需的",
    });
  }

  try {
    const activatedTotp = await enableTotpToken(
      res.locals.userid,
      totp_id,
      totp_token
    );
    return res.json({
      status: "success",
      message: "验证器已激活",
      data: activatedTotp,
    });
  } catch (error) {
    console.error("激活验证器时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "激活验证器失败",
      error: error.message,
    });
  }
});

router.post("/totp/protected-route", validateTotpToken, (req, res) => {
  return res.json({
    status: "success",
    message: "请求成功，验证器令牌验证通过",
  });
});

export default router;
