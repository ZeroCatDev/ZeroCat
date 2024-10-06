//用户账户功能路由：注册、登录等
var express = require("express");
var router = express["Router"]();
var fs = require("fs");
var jwt = require("jsonwebtoken");
//数据库
var DB = require("./lib/database.js");
//功能函数集
var I = require("./lib/global.js");
let cryptojs = require("crypto-js");
router.all("*", function (req, res, next) {
  next();
});

const request = require("request");
var nodemailer = require("nodemailer");
router.get("/", function (req, res) {
  res.render("user.ejs");
});
//登录、注册、找回密码三合一界面
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

//登录、注册、找回密码三合一界面
router.get("/repw", function (req, res) {
  res.render("repw.ejs");
});
const geetest = require("./lib/captcha/geetest.js");

//登录
router.post("/login", geetest, function (req, res) {
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
      //console.log('已登录：**********************************');

      //判断系统管理员权限
      // if (req.session['email']=='sunwuyuan'){
      //     req.session['is_admin'] = 1;
      // } else {
      //     req.session['is_admin'] = 0;
      // }
      //判断系统管理员权限：此处写死，无需从数据库获取
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

      //7天时长的毫秒数：86400000=24*60*60*1000
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
});
//退出
var logout = function (req, res) {
  //req.session.destroy();

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

//注册
router.post("/register", geetest, function (req, res) {
  //if (!req.body.pw|| !I.userpwTest(req.body.pw) || !req.body.un|| !I.emailTest(req.body.un)){ res.status(200).send( { 'status':'账户或密码格式错误' });return;}
  //if (I.phoneTest(req.body.un)){res.status(200).send( { 'status':'手机号不能直接用于注册账户' });return;}

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

    //对密码进行加密
    //var pw = req.body.pw;
    var randonpw = I.randomPassword(12);
    //console.log(randonpw);
    //console.log(email);

    pw = I.hash(randonpw);
    //console.log(pw);
    //新用户注册 //loginInfo = [{'t': new Date(),'ip':req.ip,'agent':req.headers["user-agent"]}];
    //var display_name = email.substring(email.length-5);
    var display_name = req.body.pw;
    //console.log(display_name);
    var INSERT = `INSERT INTO ow_users (username,email,password,display_name) VALUES ('${Date.now()}','${email}','${pw}','${display_name}')`;
    DB.query(INSERT, function (err, newUser) {
      if (err) {
        console.error(err);
        res.status(200).send({ message: "再试一次17" });
        return;
      }
      var userid = newUser.insertId;

      const transporter = nodemailer.createTransport({
        service: global.config.mail.service, //  邮箱
        secure: true, //  安全的发送模式
        auth: {
          user: global.config.mail.user, //  发件人邮箱
          pass: global.config.mail.pass, //  授权码
        },
      });

      transporter.sendMail(
        {
          // 发件人邮箱
          from: `${global.config.site.name}"社区注册消息" <${global.config.mail.from}>`,
          // 邮件标题
          subject: global.config.site.name + "社区注册消息",
          // 目标邮箱
          to: email,
          // 邮件内容
          html: `<div class="page flex-col">
                  <div class="box_3 flex-col"
                      style="display: flex;position: relative;width: 100%;height: 206px;background: #1289d82e;top: 0;left: 0;justify-content: center;">
                      <img class="section_1 flex-col" src="https://b2.190823.xyz/2023/05/d405a5b948f858b3479fa0d60478c98f.svg"
                          style="position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;">
                  </div>
                  <div class="box_4 flex-col" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;">
                      <div class="text-group_5 flex-col justify-between"
                          style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1"
                              style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你在${global.config.site.name}申请了账户</span><span
                              class="text_2"
                              style="font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #00000030;line-height: 22px;margin-top: 21px;text-align: center;">你在${global.config.site.name}申请了账户，这是你的账户信息</span>
                      </div>
                      <div class="box_2 flex-row"
                          style="margin: 0 20px;min-height: 128px;min-width: 600px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;width: calc(100% - 40px);">
                          <div class="text-wrapper_4 flex-col justify-between"
                              style="display: flex;flex-direction: column;margin-left: 30px;margin-bottom: 16px;"><span class="text_3"
                                  style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #0585ee;line-height: 22px;">账户信息</span><span
                                  class="text_4"
                                  style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">登录邮箱：${email}<br />密码：${randonpw}</span>
                          </div>
                          <hr
                              style="display: flex;position: relative;border: 1px dashed #1289d82e;box-sizing: content-box;height: 0px;overflow: visible;width: 100%;">
                          <a class="text-wrapper_2 flex-col"
                              style="min-width: 106px;height: 38px;background: #1289d82e;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;"
                              href="https://${global.config.site.domain}"><span class="text_5" style="color: #068bf8;">立即登录</span></a>
                      </div>
                      <table style="width:100%;font-weight:300;margin-bottom:10px;border-collapse:collapse">
                          <tbody>
                              <tr style="font-weight:300">
                                  <td style="width:3.2%;max-width:30px;"></td>
                                  <td style="max-width:540px;">
                                      <p style="text-align:center; margin:20px auto 14px auto;font-size:12px;color:#999;">
                                          此为系统邮件,如需联系请联系${global.config.site.email} <br /><a
                                              style="text-decoration:none;word-break:break-all;word-wrap:normal; color: #333;"
                                              target="_blank"> 您收到这份邮件是因为您注册了${global.config.site.name}账户 </a></p>
                                      <p id="cTMail-rights"
                                          style="max-width: 100%; margin:auto;font-size:12px;color:#999;text-align:center;line-height:22px;">
                                          <img border="0" src="https://cdn.wuyuan.dev/img/qrcode_for_gh_a55736ccbcb4_258_6dxqg3_.jpg"
                                              style="width:100px; height:100px; margin:0 auto;"><br> 关注公众号，快速了解社区活动 <br> </p>
                                  </td>
                                  <td style="width:3.2%;max-width:30px;"></td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>`,
        },
        (err, data) => {
          if (err) {
            console.error(err);
          } else {
            console.log(data);
          }
        }
      );

      res.status(200).send({ message: "注册成功,请查看邮箱获取账户数据" });
    });
  });
});

//找回密码
router.post("/repw", geetest, function (req, res) {
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
    //console.log(user);
    var jwttoken = jwt.sign(
      { userid: user["id"], email: user["email"] },
      global.config.security.jwttoken,
      { expiresIn: 60 * 10 }
    );
    //console.log(jwttoken);
    const transporter = nodemailer.createTransport({
      service: global.config.mail.service, //  邮箱
      secure: true, //  安全的发送模式
      auth: {
        user: global.config.mail.user, //  发件人邮箱
        pass: global.config.mail.pass, //  授权码
      },
    });

    transporter.sendMail(
      {
        // 发件人邮箱
        from: `${global.config.site.name}"密码重置消息" <${global.config.mail.from}>`,
        // 邮件标题
        subject: global.config.site.name + "密码重置消息",
        // 目标邮箱
        to: email,
        // 邮件内容
        html: `<div class="page flex-col">
            <div class="box_3 flex-col"
                style="display: flex;position: relative;width: 100%;height: 206px;background: #1289d82e;top: 0;left: 0;justify-content: center;">
                <img class="section_1 flex-col" src="https://b2.190823.xyz/2023/05/d405a5b948f858b3479fa0d60478c98f.svg"
                    style="position: absolute;width: 152px;height: 152px;display: flex;top: 130px;background-size: cover;">
            </div>
            <div class="box_4 flex-col" style="margin-top: 92px;display: flex;flex-direction: column;align-items: center;">
                <div class="text-group_5 flex-col justify-between"
                    style="display: flex;flex-direction: column;align-items: center;margin: 0 20px;"><span class="text_1"
                        style="font-size: 26px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #000000;line-height: 37px;text-align: center;">嘿！你在${global.config.site.name}申请重置密码</span><span
                        class="text_2"
                        style="font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #00000030;line-height: 22px;margin-top: 21px;text-align: center;">你在${global.config.site.name}申请了重置密码，这是你的密码重置信息</span>
                </div>
                <div class="box_2 flex-row"
                    style="margin: 0 20px;min-height: 128px;min-width: 600px;background: #F7F7F7;border-radius: 12px;margin-top: 34px;display: flex;flex-direction: column;align-items: flex-start;padding: 32px 16px;width: calc(100% - 40px);">
                    <div class="text-wrapper_4 flex-col justify-between"
                        style="display: flex;flex-direction: column;margin-left: 30px;margin-bottom: 16px;"><span class="text_3"
                            style="height: 22px;font-size: 16px;font-family: PingFang-SC-Bold, PingFang-SC;font-weight: bold;color: #0585ee;line-height: 22px;">账户信息</span><span
                            class="text_4"
                            style="margin-top: 6px;margin-right: 22px;font-size: 16px;font-family: PingFangSC-Regular, PingFang SC;font-weight: 400;color: #000000;line-height: 22px;">登录邮箱：${email}</span>
                    </div>
                    <hr
                        style="display: flex;position: relative;border: 1px dashed #1289d82e;box-sizing: content-box;height: 0px;overflow: visible;width: 100%;">
                    <a class="text-wrapper_2 flex-col"
                        style="min-width: 106px;height: 38px;background: #1289d82e;border-radius: 32px;display: flex;align-items: center;justify-content: center;text-decoration: none;margin: auto;margin-top: 32px;"
                        href="https://${global.config.site.domain}/account/repw?token=${jwttoken}"><span class="text_5"
                            style="color: #068bf8;">重设密码</span></a>
                    <p style="text-align:center; margin:20px auto 5px auto;font-size:12px;color:#999;">也可以复制以下链接</p>
                    <p style="text-align:center; margin:0px auto 0px auto;font-size:12px;color:#999;word-break:break-all">
                        https://${global.config.site.domain}/account/repw?token=${jwttoken}</p>
                </div>
                <table style="width:100%;font-weight:300;margin-bottom:10px;border-collapse:collapse">
                    <tbody>
                        <tr style="font-weight:300">
                            <td style="width:3.2%;max-width:30px;"></td>
                            <td style="max-width:540px;">
                                <p style="text-align:center; margin:20px auto 14px auto;font-size:12px;color:#999;">
                                    此为系统邮件,如需联系请联系${global.config.site.email} <br /><a
                                        style="text-decoration:none;word-break:break-all;word-wrap:normal; color: #333;"
                                        target="_blank"> 您收到这份邮件是因为您在${global.config.site.name}上申请重置密码</a></p>
                                <p id="cTMail-rights"
                                    style="max-width: 100%; margin:auto;font-size:12px;color:#999;text-align:center;line-height:22px;">
                                    <img border="0" src="https://cdn.wuyuan.dev/img/qrcode_for_gh_a55736ccbcb4_258_6dxqg3_.jpg"
                                        style="width:100px; height:100px; margin:0 auto;"><br> 关注公众号，快速了解社区活动 <br>
                                </p>
                            </td>
                            <td style="width:3.2%;max-width:30px;"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`,
      },
      (err, data) => {
        if (err) {
          console.error(err);
          res.status(200).send({ message: "出现错误" });
        } else {
          console.log(data);
          res.status(200).send({ message: "请查看邮箱" });
        }
      }
    );
  });
});

//找回密码
router.post("/torepw", geetest, function (req, res) {
  //console.log(req.body.token);
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
  //console.log(userid);
  //console.log(req.body.pw);
  var newPW = I.hash(req.body.pw);
  //console.log(newPW);

  SET = { password: newPW };
  UPDATE = `UPDATE ow_users SET ? WHERE id=${userid} LIMIT 1`;
  DB.qww(UPDATE, SET, function (err, u) {
    if (err) {
      res.status(200).send({ message: "请再试一次" });
      return;
    }

    res.status(200).send({ message: "您的密码已更新" });
  });
  // Continue with your program
});

module.exports = router;
