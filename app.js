import express from "express";
var app = express();
import jsonwebtoken from "jsonwebtoken";

import configManager from "./server/configManager.js";
import logger from "./server/lib/logger.js";
logger.error(process.env.NODE_ENV);
logger.error("debug mode");

import "dotenv/config";

import expressWinston from "express-winston";
app.use(
  expressWinston.logger({
    winstonInstance: logger, // 使用外部定义的logger
    meta: true, // optional: control whether you want to log the meta data about the request (default to true).
    msg: "HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}} {{req.ip}}", // optional: customize the default logging message. Eg. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    ignoreRoute: function (req, res) {
      return false;
    }, // optional: allows to skip some loggin. It is passed the http request and http response objects, should return true to skip the request logging.
    level: "info", // 记录所有请求为info级别
  })
);

// cors配置
import cors from "cors";
var corslist = (await configManager.getConfig("cors")).split(",");

var corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corslist.indexOf(new URL(origin).hostname) !== -1) {
      callback(null, true);
    } else {
      logger.error(origin);
      callback(new logger.error("Not allowed by CORS"));
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
import { fileURLToPath } from "url";
import { dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(compress());

app.set("env", __dirname + "/.env");
app.set("data", __dirname + "/data");
app.set("views", __dirname + "/views");
app.set("prisma", __dirname + "/prisma");
app.set(
  "node_modules/@prisma/client",
  __dirname + "/node_modules/@prisma/client"
);

app.set("view engine", "ejs");

//数据库
import DB from "./server/lib/database.js";

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
  logger.error("test");

  // List of possible locations where the token might be found
  const tokenSources = [
    req.headers["authorization"]?.replace("Bearer ", ""),
    req.cookies?.token,
    req.body?.token,
    req.headers?.["token"],
    req.query?.token,
  ];

  // Initialize token variable
  let token = null;

  // Iterate through the token sources and find the first valid token
  for (let source of tokenSources) {
    if (source) {
      try {
        // Try to verify the token and extract user info
        const decodedToken = jsonwebtoken.verify(source, zcjwttoken);
        // If the token contains a valid 'userid', use this token
        if (decodedToken?.userid) {
          token = source;
          logger.error(token);
          // Store user information in res.locals
          res.locals = {
            login: true,
            userid: decodedToken.userid,
            email: decodedToken.email,
            username: decodedToken.username,
            display_name: decodedToken.display_name,
            avatar: decodedToken.avatar,
            is_admin: decodedToken.is_admin || 0, // Default to 0 if is_admin is not present
            usertoken: token,
          };
          logger.error("找到登录信息");
          logger.error(JSON.stringify(res.locals));
          break; // Stop iterating once we find a valid token
        }
      } catch (err) {
        // If verification fails, continue to next token source
        continue;
      }
    }
  }

  // If no valid token is found, set the default behavior
  if (!token) {
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
  }

  // Proceed with the request
  next();
});

//首页
app.get("/", function (req, res) {
  res.render("index.ejs");
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
import router_register from "./server/router_account.js";
app.use("/account", router_register);

//个人中心路由//学生平台路由
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
//api路由

import router_projectlist from "./server/router_projectlist.js";
app.use("/projectlist", router_projectlist);

//项目处理路由
import router_project from "./server/router_project.js";
app.use("/project", router_project);

//项目处理路由
import router_comment from "./server/router_comment.js";

app.use("/comment", router_comment);

app.get("/check", function (req, res, next) {
  res.status(200).json({
    message: "success",
    code: 200,
  });
  logger.error("check");
});

process.on("uncaughtException", function (err) {
  logger.error(err);
});

// Centralized error-handling middleware function
app.use((err, req, res, next) => {
  logger.error(err);
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

export default app;
