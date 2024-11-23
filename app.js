var express = require("express");
var app = express();
const jwt = require("jsonwebtoken");

const configManager = require("./server/configManager.js");
const logger = require("./server/logger.js");

require("dotenv").config({ override: true });

var morganlogger = require("morgan");
morganlogger.token("colored-status", (req, res) => {
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
var cors = require("cors");
let corslist;
(async () => {
  corslist = (await configManager.getConfig("cors")).split(",");
})();

var corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corslist.indexOf(new URL(origin).hostname) !== -1) {
      callback(null, true);
    } else {
      logger.info(origin);
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
var bodyParser = require("body-parser");
app.use(bodyParser["urlencoded"]({ limit: "50mb", extended: false }));
app.use(bodyParser["json"]({ limit: "50mb" }));
app.use(bodyParser["text"]({ limit: "50mb" }));

//文件上传模块
var multipart = require("connect-multiparty");
app.use(multipart({ uploadDir: "./data/upload_tmp" }));

//压缩组件，需要位于 express.static 前面，否则不起作用
var compress = require("compression");
app.use(compress());

app.set("env", __dirname + "/.env");
app.set("data", __dirname + "/data");
app.set("views", __dirname + "/views");
app.set("prisma", __dirname + "/prisma");
app.set("node_modules/@prisma/client", __dirname + "/node_modules/@prisma/client");

app.set("view engine", "ejs");

//数据库
var DB = require("./server/lib/database.js");

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
  logger.info(token);
  // Continue with the token verification
  if (token) {
    jwt.verify(token, zcjwttoken, (err, decodedToken) => {
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
        logger.error("JWT验证失败: " + err.message);
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
        logger.info("JWT验证成功: " + userInfo.email);
        logger.info("调试用户信息(session): " + JSON.stringify(res.locals));
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
    logger.info("未找到JWT Token");
    next();
  }
});

//首页
app.get("/", function (req, res) {
  res.render("index.ejs");
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
var router_register = require("./server/router_account.js");
app.use("/account", router_register);

var router_register = require("./server/router_user.js");
app.use("/user", router_register);

//个人中心路由//学生平台路由
var router_admin = require("./server/router_my.js");
app.use("/my", router_admin);

//搜索api
var router_search = require("./server/router_search.js");
app.use("/searchapi", router_search);

//scratch路由
var router_scratch = require("./server/router_scratch.js");
app.use("/scratch", router_scratch);
//api路由
var apiserver = require("./server/router_api.js");
app.use("/api", apiserver);
//api路由

var router_projectlist = require("./server/router_projectlist.js");
app.use("/projectlist", router_projectlist);

//项目处理路由
var router_project = require("./server/router_project.js");
app.use("/project", router_project);

//项目处理路由
var router_comment = require("./server/router_comment.js");
app.use("/comment", router_comment);

app.get("/check", function (req, res, next) {
  res.status(200).json({
    message: "success",
    code: 200,
  });
});

process.on("uncaughtException", function (err) {
  logger.error("Caught exception: " + err);
});

// Centralized error-handling middleware function
app.use((err, req, res, next) => {
  logger.error(err.stack);
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

module.exports = app;
