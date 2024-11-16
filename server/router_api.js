const configManager = require("./configManager");

var express = require("express");
var router = express.Router();
var fs = require("fs");

var I = require("./lib/global.js");
var DB = require("./lib/database.js");

router.get("/", async function (req, res, next) {
  try {
    var SQL =
      `SELECT ` +
      ` (SELECT count(id) FROM ow_projects WHERE state='public' AND type='scratch' ) AS scratch_count, ` +
      ` (SELECT count(id) FROM ow_projects WHERE state='public' AND type='python') AS python_count `;
    DB.query(SQL, function (err, data) {
      if (err) {
        res.locals.scratch_count = 0;
        res.locals.python_count = 0;
      } else {
        res.locals.scratch_count = data[0].scratch_count;
        res.locals.python_count = data[0].python_count;
      }
      res.status(200).send({ name: "index", count: data[0] });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/getUserScratchProjects", async function (req, res, next) {
  try {
    var curr = parseInt(req.body.curr);
    var limit = parseInt(req.body.limit);
    var userid = parseInt(req.body.userid);
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
  } catch (err) {
    next(err);
  }
});

router.post("/getUserPythonProjects", async function (req, res, next) {
  try {
    var curr = parseInt(req.body.curr);
    var limit = parseInt(req.body.limit);
    var userid = parseInt(req.body.userid);
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
  } catch (err) {
    next(err);
  }
});

router.post("/getProjectsInfo", async function (req, res, next) {
  try {
    res.status(200).send([
      { name: "Scratch编程", info: "Scartch创作", link: "/scratch" },
      { name: "Python编程", info: "Python编程", link: "/python" },
    ]);
  } catch (err) {
    next(err);
  }
});

router.get("/usertx", async function (req, res, next) {
  try {
    SQL = `SELECT images FROM ow_users WHERE id = ${req.query.id};`;
    DB.query(SQL, async function (err, USER) {
      if (err || USER.length == 0) {
        res.locals.tip = { opt: "flash", msg: "用户不存在" };
        res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
        return;
      }
      res.redirect(302, await configManager.getConfig('s3.staticurl') + "/user/" + USER[0].images);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/getuserinfo", async function (req, res, next) {
  try {
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
        username: true,
      },
    });

    scratchcount = await I.prisma.ow_projects.count({
      where: {
        type: "scratch",
        state: "public",
      },
    });
    pythoncount = await I.prisma.ow_projects.count({
      where: {
        type: "python",
        state: "public",
      },
    });
    if (!user[0]) {
      console.log("用户不存在");
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
      res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
    }
    res.send({
      status: "ok",
      info: { user: user[0], count: { pythoncount, scratchcount } },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/info", async (req, res, next) => {
  try {
    const userCount = await I.prisma.ow_users.count();
    const scratchCount = await I.prisma.ow_projects.count();
    const pythonCount = await I.prisma.ow_projects.count();

    res.send({
      user: userCount,
      scratch: scratchCount,
      python: pythonCount,
      project: scratchCount + pythonCount,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/myprojectcount", async function (req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
});

router.get("/work/info", async function (req, res, next) {
  try {
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
  } catch (err) {
    next(err);
  }
});

router.get("/projectinfo", async function (req, res, next) {
  try {
    SQL =
      `SELECT ow_projects.id,ow_projects.authorid,ow_projects.time,ow_projects.view_count,ow_projects.like_count,ow_projects.type,` +
      ` ow_projects.favo_count,ow_projects.title,ow_projects.state,ow_projects.description,ow_projects.licence,ow_projects.tags,` +
      ` '' AS likeid, '' AS favoid,` +
      ` ow_users.display_name AS author_display_name,` +
      ` ow_users.images AS author_images,` +
      ` ow_users.motto AS author_motto` +
      ` FROM ow_projects ` +
      ` LEFT JOIN ow_users ON (ow_users.id=ow_projects.authorid) ` +
      ` WHERE ow_projects.id=${req.query.id} AND (ow_projects.state='public' or ow_projects.authorid=${res.locals.userid}) LIMIT 1`;
    DB.query(SQL, function (err, SCRATCH) {
      if (err || SCRATCH.length == 0) {
        res.locals.tip = { opt: "flash", msg: "项目不存在或未发布", error: err };
        res.send({
          code: 404,
          status: "404",
          msg: "项目不存在或未发布",
          error: err,
        });
        return;
      }

      res.locals["is_author"] =
        SCRATCH[0].authorid == res.locals.userid ? true : false;

      res.json(SCRATCH[0]);
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
