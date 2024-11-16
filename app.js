import express from "express";
var app = express();
import jsonwebtoken from "jsonwebtoken";

import configManager from "./server/configManager.js";
import dotenv from "dotenv";
dotenv.config({ override: true });
//import path from 'path';

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log("运行目录：" + __dirname);

import morganlogger, { token as _token } from "morgan";
_token("colored-status", (req, res) => {
  const status = res.statusCode;
  let color;
  if (status >= 500) {
    color = "\x1b[31m"; // 红色
  } else if (status >= 400) {
    color = "\x1b[33m"; // 黄色
  } else if (status >= 300) {
    color = "\x1b[36m"; // 青色
  } else {
    color = "\x1b[32m"; // 绿色
  }
  return color + status + "\x1b[0m"; // 重置颜色
});
app.use(
  morganlogger(":method :colored-status :response-time ms :remote-addr :url")
);

// cors配置
import cors from "cors";
let corslist;
(async () => {
  corslist = (await configManager.getConfig("cors")).split(",");
})();

var corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corslist.indexOf(new URL(origin).hostname) !== -1) {
      callback(null, true);
    } else {
      console.log(origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions)); // 应用CORS配置函数

//设置环境变量
//var session = require("express-session"); app.use( session({ secret: await configManager.getConfig('security.SessionSecret'), resave: false, name: "ZeroCat-session", saveUninitialized: true, cookie: { secure: false }, }) );

//express 的http请求体进行解析组件
import bodyParser from "body-parser";
app.use(bodyParser["urlencoded"]({ limit: "50mb", extended: false }));
app.use(bodyParser["json"]({ limit: "50mb" }));
app.use(bodyParser["text"]({ limit: "50mb" }));

//文件上传模块
import multipart from "connect-multiparty";
app.use(multipart({ uploadDir: "./data/upload_tmp" }));

//压缩组件，需要位于 express.static 前面，否则不起作用
import compress from "compression";
app.use(compress());

app.set("env", __dirname + "/.env");
app.set("data", __dirname + "/data");
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

//全局变量
global.dirname = __dirname;

//启动http(80端口)==================================
//http.createServer(app).listen(3000, "0.0.0.0", function () {
//  console.log("Listening on http://localhost:3000");
//}); // 平台总入口
app.options("*", cors());

let zcjwttoken;
(async () => {
  zcjwttoken = await configManager.getConfig("security.jwttoken");
})();
app.all("*", async function (req, res, next) {
  //console.log(req.method +' '+ req.url + " IP:" + req.ip);
  const token =
    (req.headers["authorization"] || "").replace("Bearer ", "") ||
    (req.cookies && req.cookies.token) ||
    (req.body && req.body.token) ||
    (req.headers && req.headers["token"]) ||
    (req.query && req.query.token);
  console.log(token);
  // Continue with the token verification
  if (token) {
    jsonwebtoken.verify(token, zcjwttoken, (err, decodedToken) => {
      if (err) {
        // If verification fails, clear local login state
        res.locals = {
          login: false,
          userid: "",
          email: "",
          username: "",
          display_name: "",
          avatar: "",
          is_admin: 0,
          usertoken: "",
        };
        //console.log("JWT验证失败: " + err.message);
      } else {
        // If verification succeeds, store user info
        let userInfo = decodedToken;
        res.locals = {
          login: true,
          userid: userInfo.userid,
          email: userInfo.email,
          username: userInfo.username,
          display_name: userInfo.display_name,
          avatar: userInfo.avatar,
          is_admin: 0,
          usertoken: token,
        };
        //console.log("JWT验证成功: " + userInfo.email);
        //console.log("调试用户信息(session): " + JSON.stringify(res.locals));
      }

      next();
    });
  } else {
    // If no token is found, clear local login state
    res.locals = {
      login: false,
      userid: 0,
      email: "",
      username: "",
      display_name: "未登录",
      avatar: "",
      is_admin: 0,
      usertoken: "",
    };
    console.log("未找到JWT Token");
    next();
  }
});

//首页
app.get("/", function (req, res) {
  res.render("index.ejs");
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
import router_register from "./server/router_account.js";
app.use("/account", router_register);

import router_user from "./server/router_user.js";
app.use("/user", router_user);

//个人中心路由
import router_admin from "./server/router_my.js";
app.use("/my", router_admin);

//搜索api
import router_search from "./server/router_search.js";
app.use("/searchapi", router_search);

//scratch路由
import router_scratch from "./server/router_scratch.js";
app.use("/scratch", router_scratch);

//api路由
import apiserver from "./server/router_api.js";
app.use("/api", apiserver);

import router_projectlist from "./server/router_projectlist.js";
app.use("/projectlist", router_projectlist);

//项目路由
import router_project from "./server/router_project.js";
app.use("/project", router_project);

//评论路由
import router_comment from "./server/router_comment.js";
app.use("/comment", router_comment);

// 在线状态检查
app.get("/check", function (req, res, next) {
  res.status(200).json({
    message: "success",
    code: 200,
  });
});

process.on("uncaughtException", function (err) {
  throw err;
  console.log("Caught exception: " + err);
});

// Centralized error-handling middleware function
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    status: "error",
    message: "Something went wrong!",
    error: err.message,
  });
});

//放在最后，友好的处理地址不存在的访问
app.all("*", function (req, res, next) {
  res.locals.tipType = "访问错误";
  res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
});
export default app; // 默认导出 `app` 对象
