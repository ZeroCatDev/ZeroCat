//个人中心
var express = require("express");
var router = express.Router();
var fs = require("fs");

//功能函数集
var I = require("./lib/global.js");
//数据库
var DB = require("./lib/database.js");

//首页
router.get("/", function (req, res) {
  //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
  var SQL =
    `SELECT ` +
    ` (SELECT count(id) FROM scratch WHERE state>0 ) AS scratch_count, ` +
    ` (SELECT count(id) FROM python WHERE state>0 ) AS python_count `;
  DB.query(SQL, function (err, data) {
    if (err) {
      // console.error('数据库操作出错：');
      res.locals.scratch_count = 0;
      res.locals.python_count = 0;
    } else {
      res.locals.scratch_count = data[0].scratch_count;
      res.locals.python_count = data[0].python_count;
    }

    res.status(200).send({ name: "index", count: data[0] });
  });
});
//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post("/getUserScratchProjects", function (req, res) {
  var curr = parseInt(req.body.curr); //当前要显示的页码
  var limit = parseInt(req.body.limit); //每页显示的作品数
  var userid = parseInt(req.body.userid); //
  var SQL = `SELECT id, title,state,view_count,description FROM scratch WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${
    (curr - 1) * limit
  }, ${limit}`;
  DB.query(SQL, function (err, data) {
    if (err) {
      res.status(200).send([]);
    } else {
      res.status(200).send(data);
    }
  });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post("/getUserPythonProjects", function (req, res) {
  var curr = parseInt(req.body.curr); //当前要显示的页码
  var limit = parseInt(req.body.limit); //每页显示的作品数
  var userid = parseInt(req.body.userid); //
  var SQL = `SELECT id, title,state,view_count,description FROM python WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${
    (curr - 1) * limit
  }, ${limit}`;
  DB.query(SQL, function (err, data) {
    if (err) {
      res.status(200).send([]);
    } else {
      res.status(200).send(data);
    }
  });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.post("/getProjectsInfo", function (req, res) {
  res.status(200).send([
    { name: "Scratch编程", info: "Scartch创作", link: "/scratch" },
    { name: "Python编程", info: "Python编程", link: "/python" },
  ]);
});
router.get("/play", function (req, res) {
  var deviceAgent = req.headers["user-agent"].toLowerCase();
  var agentID = deviceAgent.match(/(iphone|ipad|android|windows phone)/);
  res.locals["is_mobile"] = false;
  if (agentID) {
    res.locals["is_mobile"] = true; //请求来自手机、pad等移动端
  }

  //浏览数+1
  var SQL = `UPDATE scratch SET view_count=view_count+1 WHERE id=${req.query.id} LIMIT 1`;
  DB.query(SQL, function (err, U) {
    if (err || U.affectedRows == 0) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.render("404.ejs");
      return;
    }

    SQL =
      `SELECT ow_Users.display_name,scratch.motto,` +
      ` FROM ow_Users ` +
      ` LEFT JOIN ow_Users ON (ow_Users.display_name=ow_Users.neme) ` +
      ` WHERE ow_Users.id=${req.query.id}`;

    DB.query(SQL, function (err, SCRATCH) {
      if (err || SCRATCH.length == 0) {
        res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
        res.render("404.ejs");
        return;
      }

      res.locals["is_author"] =
        SCRATCH[0].authorid == res.locals.userid ? true : false;
      res.locals["project"] = SCRATCH[0];
      res.render("scratch/scratch_play.ejs");
    });
  });
});

router.get("/usertx", function (req, res) {
  SQL = `SELECT images FROM ow_Users WHERE id = ${req.query.id};`;

  DB.query(SQL, function (err, USER) {
    if (err || USER.length == 0) {
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
      res.render("404.ejs");
      return;
    }

    res.redirect(302, process.env.S3staticurl + "/user/" + USER[0].images);
  });
});

router.get("/getuserinfo", async function (req, res) {
  user = await I.prisma.ow_Users.findMany({
    where: {
      id: parseInt(req.query.id),
    },
    select: {
      id: true,
      display_name: true,
      motto: true,
      images: true,
      regTime: true,
    },
  });
  if (!user[0]) {
    res.locals.tip = { opt: "flash", msg: "用户不存在" };
    res.render("404.ejs");
  }
  res.send({ status: "ok", info: user[0] });
});
router.get("/info", async (req, res) => {
  const userCount = await I.prisma.ow_Users.count();
  const scratchCount = await I.prisma.scratch.count();
  const pythonCount = await I.prisma.python.count();


  res.send({
    user: userCount,
    scratch: scratchCount,
    python: pythonCount,
    project: scratchCount + pythonCount,
  });
});


//作品
router.get("/myprojectcount", function (req, res) {
  res.locals.type = "scratch";
  if (req.query.type == "python") {
    res.locals.type = "python";
  } else if (req.query.type == "scratch") {
    res.locals.type = "scratch";
  }
  var SQL =
    `SELECT ` +
    ` count(case when state=0 then 1 end) AS state0_count, ` +
    ` count(case when state=1 then 1 end) AS state1_count, ` +
    ` count(case when state=2 then 1 end) AS state2_count ` +
    ` FROM ${res.locals.type} WHERE authorid=${res.locals["userid"]}`;

  DB.query(SQL, function (err, data) {
    if (err) {
      res.locals.state0_count = 0;
      res.locals.state1_count = 0;
      res.locals.state2_count = 0;
    } else {
      res.locals.state0_count = data[0].state0_count;
      res.locals.state1_count = data[0].state1_count;
      res.locals.state2_count = data[0].state2_count;
    }
    res.send(data[0]);
  });
});
module.exports = router;
