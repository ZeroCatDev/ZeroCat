//API
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
    ` (SELECT count(id) FROM ow_projects WHERE state='public' AND type='scratch' ) AS scratch_count, ` +
    ` (SELECT count(id) FROM ow_projects WHERE state='public' AND type='python') AS python_count `;
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
  var SQL = `SELECT id, title,state,view_count,description FROM ow_projects WHERE authorid=${userid} AND state='public' AND type='scratch' ORDER BY view_count DESC LIMIT ${
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
  var SQL = `SELECT id, title,state,view_count,description FROM ow_projects WHERE authorid=${userid} AND state='public' AND type='python' ORDER BY view_count DESC LIMIT ${
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


router.get("/usertx", function (req, res) {
  SQL = `SELECT images FROM ow_users WHERE id = ${req.query.id};`;

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
  user = await I.prisma.ow_users.findMany({
    where: {
      id: parseInt(req.query.id),
    },
    select: {
      id: true,
      display_name: true,
      motto: true,
      images: true,
      regTime: true,
      sex: true,
      username: true
    },
  });

  scratchcount =await  I.prisma.ow_projects.count({
    where: {
      type: 'scratch',
      state: 'public',
    },
  });
  pythoncount =await  I.prisma.ow_projects.count({
    where: {
      type: 'python',
      state: 'public',
    },
  });
  if (!user[0]) {
    console.log('用户不存在')
    res.locals.tip = { opt: "flash", msg: "用户不存在" };
    res.render("404.ejs");
  }
  res.send({ status: "ok", info: {user:user[0],count:{pythoncount,scratchcount}} });
});
router.get("/info", async (req, res) => {
  const userCount = await I.prisma.ow_users.count();
  const scratchCount = await I.prisma.ow_projects.count();
  const pythonCount = await I.prisma.ow_projects.count();


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
    ` count(case when state='private' then 1 end) AS state0_count, ` +
    ` count(case when state='public' then 1 end) AS state1_count, ` +
    ` '' AS state2_count ` +
    ` FROM ow_projects WHERE authorid=${res.locals["userid"]} AND type='${res.locals.type}'`;

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




//作品
router.get("/work/info", function (req, res) {
  res.locals.type = "scratch";
  if (req.query.type == "python") {
    res.locals.type = "python";
  } else if (req.query.type == "scratch") {
    res.locals.type = "scratch";
  }
  var SQL =
    `SELECT ` +
    ` count(case when state='private' then 1 end) AS state0_count, ` +
    ` count(case when state='public' then 1 end) AS state1_count, ` +
    `'' AS state2_count ` +
    ` FROM ow_projects WHERE authorid=${res.locals["userid"]} AND type='${res.locals.type}'`;

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

router.get("/projectinfo", function (req, res) {
  SQL =
  `SELECT ow_projects.id,ow_projects.authorid,ow_projects.time,ow_projects.view_count,ow_projects.like_count,ow_projects.type,` +
  ` ow_projects.favo_count,ow_projects.title,ow_projects.state,ow_projects.description,ow_projects.license,` +
  ` '' AS likeid, '' AS favoid,` +
  ` ow_users.display_name AS author_display_name,` +
  ` ow_users.images AS author_images,` +
  ` ow_users.motto AS author_motto` +
  ` FROM ow_projects ` +
  ` LEFT JOIN ow_users ON (ow_users.id=ow_projects.authorid) ` +
  ` WHERE ow_projects.id=${req.query.id} AND (ow_projects.state='public' or ow_projects.authorid=${res.locals.userid}) LIMIT 1`;
  DB.query(SQL, function (err, SCRATCH) {
    if (err || SCRATCH.length == 0) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.send({code:404,status:"404",msg:"项目不存在或未发布"})
      return;
    }

    res.locals["is_author"] =
      SCRATCH[0].authorid == res.locals.userid ? true : false;

    ////console.log(SCRATCH[0]);
    res.json(SCRATCH[0])
  });
});


module.exports = router;
