var express = require("express");
var app = express();
const jwt = require("jsonwebtoken");

require("dotenv").config({ override: true });
//console.log(global.config);
// 日志部分
/*
const opentelemetry = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");
const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");
const traceExporter = new OTLPTraceExporter({ url: "https://api.axiom.co/v1/traces", headers: { Authorization: `Bearer ${process.env.AXIOM_TOKEN}`, "X-Axiom-Dataset": process.env.AXIOM_DATASET, }, });
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: "node traces",
});
const sdk = new opentelemetry.NodeSDK({
  spanProcessor: new BatchSpanProcessor(traceExporter),
  resource: resource,
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
*/

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
corslist = global.config.cors;
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
//var session = require("express-session"); app.use( session({ secret: global.config.security.SessionSecret, resave: false, name: "ZeroCat-session", saveUninitialized: true, cookie: { secure: false }, }) );
//express 的cookie的解析组件
var cookieParser = require("cookie-parser");
app.use(cookieParser(global.config.security.SessionSecret));

//express 的http请求体进行解析组件
var bodyParser = require("body-parser");
app.use(bodyParser["urlencoded"]({ limit: "50mb", extended: false }));
app.use(bodyParser["json"]({ limit: "50mb" }));

//文件上传模块
var multipart = require("connect-multiparty");
app.use(multipart({ uploadDir: "./data/upload_tmp" }));

//压缩组件，需要位于 express.static 前面，否则不起作用
var compress = require("compression");
app.use(compress());

app.set("env", __dirname + "/.env");
app.set("data", __dirname + "/data");
app.set("views", __dirname + "/views");
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
app.all("*", function (req, res, next) {
  //console.log(req.method +' '+ req.url + " IP:" + req.ip);

  const token =
    req.cookies.token ||
    req.body.token ||
    req.headers["token"] ||
    req.query.token || // 获取JWT令牌
    (req.headers["authorization"] || "").replace("Bearer ", "");

  if (token) {
    jwt.verify(token, global.config.security.jwttoken, (err, decodedToken) => {
      // 解析并验证JWT
      if (err) {
        // 如果验证失败，清除本地登录状态
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
        console.log("JWT验证失败: " + err.message);
      } else {
        // 如果验证成功，将用户信息存储在res.locals和session中
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
        //res.locals["is_admin"] = 0;
        //if (userInfo.email == global.config.security.adminuser) {
        //  res.locals["is_admin"] = 1;
        //}
        //console.log("JWT验证成功: " + userInfo.email);
        //console.log( "调试用户信息(session)：" + res.locals.userid + "," + res.locals.email + "," + res.locals.username + "," + res.locals.display_name + "," + res.locals.is_admin );

        //console.log( "调试用户信息(locals )：" + res.locals.userid + "," + res.locals.email + "," + res.locals.username + "," + res.locals.display_name + "," + res.locals.is_admin );
      }

      next();
    });
  } else {
    // 如果未找到token，则清除本地登录状态
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
    //console.log("未找到JWT Token");
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

//系统平台路由
var router_admin = require("./server/router_admin.js");
app.use("/admin", router_admin);

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
app.get("/about", function (req, res, next) {
  res.render("about.ejs");
});
app.get("/share", function (req, res, next) {
  res.render("share.ejs");
});

app.get("/search", function (req, res, next) {
  res.render("search.ejs");
});

//python路由
var router_python = require("./server/router_python.js");
app.use("/python", router_python);

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
});

//放在最后，友好的处理地址不存在的访问
app.all("*", function (req, res, next) {
  res.locals.tipType = "访问错误";
  res.render("404.ejs");
});

module.exports = app;
