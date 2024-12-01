var express = require("express");
var app = express();
const jwt = require("jsonwebtoken");

const configManager = require("./server/configManager.js");
const logger = require("./server/lib/logger.js");
logger.info(process.env.NODE_ENV);
logger.debug('debug mode');
require("dotenv").config({ override: true });

expressWinston = require("express-winston");

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
      logger.debug(origin);
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
app.set(
  "node_modules/@prisma/client",
  __dirname + "/node_modules/@prisma/client"
);

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
  Error("test");

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
        const decodedToken = jwt.verify(source, zcjwttoken);
        // If the token contains a valid 'userid', use this token
        if (decodedToken?.userid) {
          token = source;
          logger.debug(token);
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
          logger.debug("找到登录信息");
          logger.debug(JSON.stringify(res.locals));
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
var router_register = require("./server/router_account.js");
app.use("/account", router_register);

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
const { log } = require("winston");
app.use("/comment", router_comment);

app.get("/check", function (req, res, next) {
  res.status(200).json({
    message: "success",
    code: 200,
  });
  logger.debug("check");
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

module.exports = app;
