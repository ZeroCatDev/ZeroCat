var express = require("express");
var app = express();
var http = require("http");
const jwt = require("jsonwebtoken"); // 首先确保安装了jsonwebtoken库

//环境变量
require('dotenv').config({ override: true })

// 日志部分
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
// Initialize OTLP trace exporter with the URL and headers for the Axiom API
const traceExporter = new OTLPTraceExporter(
{
    url: "https://api.axiom.co/v1/traces", // Axiom API endpoint for trace data
    headers: {
      Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,// || 'xaat-11d3193a-3608-41ee-a015-d7884b4f6c71'}`, // Replace $API_TOKEN with your actual API token
      "X-Axiom-Dataset": process.env.AXIOM_DATASET// || 'wuyuan-telemetry', // Replace $DATASET with your dataset
    },
  },
);
// Define the resource attributes, in this case, setting the service name for the traces
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: "node traces", // Name for the tracing service
});
// Create a NodeSDK instance with the configured span processor, resource, and auto-instrumentations
const sdk = new opentelemetry.NodeSDK({
  spanProcessor: new BatchSpanProcessor(traceExporter), // Use BatchSpanProcessor for batching and sending traces
  resource: resource, // Attach the defined resource to provide additional context
  instrumentations: [getNodeAutoInstrumentations()], // Automatically instrument common Node.js modules
});
// Start the OpenTelemetry SDK
sdk.start();

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
var corsOptions = {
  origin: process.env.corslist,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
};
app.use(cors(corsOptions)); // 应用CORS配置函数

//设置环境变量
//var session = require("express-session"); app.use( session({ secret: process.env.SessionSecret, resave: false, name: "ZeroCat-session", saveUninitialized: true, cookie: { secure: false }, }) );
//express 的cookie的解析组件
var cookieParser = require("cookie-parser");
app.use(cookieParser(process.env.SessionSecret));

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

//设置静态资源路径
if (process.env.localstatic == "true") {
  app.use(process.env.staticurl, express.static(process.env.staticpath));
  console.log("local static");
}
//全局变量
global.dirname = __dirname;

//启动http(80端口)==================================
http.createServer(app).listen(3000, "0.0.0.0", function () {
  console.log("Listening on http://localhost:3000");
}); // 平台总入口
app.all("*", function (req, res, next) {
  //console.log(req.method +' '+ req.url + " IP:" + req.ip);

  const token = req.cookies.token || req.body.token || req.headers["token"]; // 获取JWT令牌

  if (token) {
    jwt.verify(token, process.env.jwttoken, (err, decodedToken) => {
      // 解析并验证JWT
      if (err) {
        6;
        // 如果验证失败，清除本地登录状态
        res.locals = {
          login: false,
          userid: "",
          email: "",
          display_name: "",
          avatar: "",
          is_admin: 0,
        };
        //console.log("JWT验证失败: " + err.message);
      } else {
        // 如果验证成功，将用户信息存储在res.locals和session中
        let userInfo = decodedToken;
        res.locals.userid = userInfo.userid;
        res.locals.email = userInfo.email;
        res.locals.display_name = userInfo.display_name;
        res.locals.avatar = userInfo.avatar;

        res.locals["is_admin"] = 0;
        if (userInfo.email == process.env.adminuser) {
          res.locals["is_admin"] = 1;
        }
        //console.log("JWT验证成功: " + userInfo.email);
        //console.log('调试用户信息(session)：'+res.locals.userid+','+res.locals.email+','+res.locals.display_name+','+res.locals.is_admin);

        res.locals = {
          login: true,
          userid: res.locals.userid,
          email: res.locals.email,
          display_name: res.locals.display_name,
          avatar: res.locals.avatar,
          is_admin: res.locals["is_admin"],
        };

        //console.log('调试用户信息(locals )：'+res.locals.userid+','+res.locals.email+','+res.locals.display_name+','+res.locals.is_admin);
      }

      next();
    });
  } else {
    // 如果未找到token，则清除本地登录状态
    res.locals = {
      login: false,
      userid: "",
      email: "",
      display_name: "",
      avatar: "",
      is_admin: 0,
    };
    //console.log("未找到JWT Token");
    next();
  }
});

//首页
app.get("/", function (req, res) {
  res.render('index.ejs');
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
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

app.get("/about", function (req, res, next) {
  res.render("about.ejs");
});
app.get("/share", function (req, res, next) {
  res.render("share.ejs");
});

app.get("/search", function (req, res, next) {
  res.render("search.ejs");
});
//工具
app.get("/tools/comparer", function (req, res, next) {
  res.render("tools/comparer.ejs");
});
app.get("/tools/asdm", function (req, res, next) {
  res.render("tools/asdm.ejs");
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
