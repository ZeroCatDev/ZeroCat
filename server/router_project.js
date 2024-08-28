var express = require("express");
var router = express.Router();
const { encode, decode } = require("html-entities");

var DB = require("./lib/database.js"); // 数据库

//功能函数集
var I = require("./lib/global.js");
router.all("*", function (req, res, next) {
  next();
});
//router.get('/', function (req, res) {})

//新作品
router.post("/", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }

  const allowable = [
    "type",
    "license",
    "state",
    "title",
    "description",
    "devsource",
    "source",
    "history",
  ];

  // 定义一个新的JSON对象来存储符合条件的键值对
  var outputJson = {};

  // 遍历输入的JSON对象
  for (const key in req.body) {
    if (req.body.hasOwnProperty(key)) {
      // 检查当前键是否在指定的名称列表中
      if (allowable.includes(key)) {
        // 如果在，则将该键值对加入到outputJson中
        outputJson[key] = req.body[key];
      }
    }
  }
  if (outputJson.devsource && outputJson.source == undefined) {
    outputJson.source = outputJson.devsource;
  }
  outputJson.authorid = res.locals.userid;
  I.prisma.ow_projects
    .create({
      data: outputJson,
    })
    .catch((err) => {
      console.log(err);
      res
        .status(200)
        .send({
          status: "0",
          msg: "保存失败",
          message: "保存失败",
          error: err,
        });
      return;
    })
    .then(async (result) => {
      res
        .status(200)
        .send({ status: "1", msg: "保存成功", message: "保存成功", id: result.id });
    });
});

//fork作品
router.post("/:id/fork", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  try {
    I.prisma.ow_projects.findFirst({
      where: {
        id: Number(req.params.id),
      },
    }).then((result) => {
      if (result.state == 'public') {
        I.prisma.ow_projects
          .create({
            data: {
              authorid: res.locals.userid,
              title: result.title + '改编',
              description: result.description,
              license: result.license,
              state: 'private',
              type: result.type,
              source: result.source,
              devsource: result.source,
            },
          }).catch((err) => {
            console.log(err);
            res.status(200).send({ status: "0", msg: "改编失败", error: err });
          }).then((result) => {
            res.status(200).send({ status: "1", msg: "改编成功", id: result.id });
          })
      } else {
        res.status(200).send({ status: "0", msg: "改编失败" });
      }
    })
  }
  catch (err) {
    console.log(err);
    res.status(200).send({ status: "0", msg: "改编失败", error: err });
    return;
  }

});
// 保存
router.put("/:id/source/dev", function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }
  console.log(req.body);
  I.prisma.ow_projects
    .update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: {
        devsource: JSON.stringify(req.body),
      },
    })
    .catch((err) => {
      console.log(err);
      res.status(200).send({ status: "0", msg: "保存失败", error: err });
      return;
    })
    .then(async (result) => {
      console.log(result);
      if (result.devenv == 0) {
        I.prisma.ow_projects
          .update({
            where: {
              id: Number(req.params.id),
              authorid: Number(res.locals.userid),
            },
            data: {
              source: JSON.stringify(req.body),
            },
          })
          .catch((err) => {
            console.log(err);
            res.status(200).send({ status: "0", msg: "保存失败", error: err });
            return;
          })
          .then(async (result) => {
            res.status(200).send({ status: "1", msg: "保存成功" });
            console.log(result);
          });
      } else {
        res.status(200).send({ status: "1", msg: "保存成功" });
      }
    });
});

// 保存
router.put("/:id", function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }

  const allowable = [
    "type",
    "license",
    "state",
    "title",
    "description",
    "devsource",
    "source",
    "history",
  ];

  // 定义一个新的JSON对象来存储符合条件的键值对
  var outputJson = {};

  // 遍历输入的JSON对象
  for (const key in req.body) {
    if (req.body.hasOwnProperty(key)) {
      // 检查当前键是否在指定的名称列表中
      if (allowable.includes(key)) {
        // 如果在，则将该键值对加入到outputJson中
        outputJson[key] = req.body[key];
      }
    }
  }

  I.prisma.ow_projects
    .update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: outputJson,
    })
    .catch((err) => {
      console.log(err);
      res
        .status(200)
        .send({
          status: "0",
          msg: "保存失败",
          message: "保存失败",
          error: err,
        });
      return;
    })
    .then(async (result) => {
      res
        .status(200)
        .send({ status: "1", msg: "保存成功", message: "保存成功" });
    });
});

// 保存
router.post("/:id/push", async function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }

  var project = await I.prisma.ow_projects
    .findFirst({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
    })
    .catch((err) => {
      console.log(err);
      res
        .status(200)
        .send({
          status: "0",
          msg: "保存失败",
          message: "保存失败",
          error: err,
        });
      return;
    });
  // 如果没开开发环境那么判断是否要求严格模式
  if (project.devenv == 0) {
    if (req.body.force == "true") {
      I.prisma.ow_projects
        .update({
          where: {
            id: Number(req.params.id),
            authorid: Number(res.locals.userid),
          },
          data: {
            source: project.devsource,
          },
        })
        .catch((err) => {
          console.log(err);
          res
            .status(200)
            .send({
              status: "0",
              msg: "保存失败",
              message: "保存失败",
              error: err,
            });
          return;
        });
    } else {
      res.status(200).send({ status: "0", msg: "未开启开发环境，无法推送" });
      return;
    }
    // 其他情况下将代码从开发环境复制到生产环境，devsource -> source
  } else {
    I.prisma.ow_projects
      .update({
        where: {
          id: Number(req.params.id),
          authorid: Number(res.locals.userid),
        },
        data: {
          source: project.devsource,
        },
      })
      .catch((err) => {
        console.log(err);
        res
          .status(200)
          .send({
            status: "0",
            msg: "保存失败",
            message: "保存失败",
            error: err,
          });
      })
      .then(async (result) => {
        res
          .status(200)
          .send({ status: "1", msg: "推送成功", message: "推送成功"  });
        if (project.history == 1) {
          //console.log(project.devsource)
          //console.log(result.source)
          if (project.source != result.source) {
            // 创建一个历史记录
            console.log("创建历史记录");
            I.prisma.ow_projects_history
              .create({
                data: {
                  projectid: Number(req.params.id),
                  source: result.source,
                  authorid: Number(res.locals.userid),
                  type: project.type,
                  title: project.title,
                  description: project.description,
                  state: project.state,
                  license: project.license,
                },
              })
              .catch((err) => {
                console.log(err);
              });
          } else {
            console.log("未创建历史记录");
          }
        }
      });
  }
});

//新作品 弃用
router.post("/newProjcet", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var INSERT = `INSERT INTO ow_projects (authorid, title,type) VALUES (${res.locals.userid}, ?,?)`;
  var SET = [req.body.title || "新建作品", req.body.type];
  DB.qww(INSERT, SET, function (err, newproject) {
    if (err || newproject.affectedRows == 0) {
      res.status(200).send({ status: "0", msg: "创建失败" });
      return;
    }
    res
      .status(200)
      .send({ status: "ok", msg: "创建成功", id: newproject["insertId"] });
  });

  return;
});

//保存作品：标题
router.post("/saveProjcetTitle", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var UPDATE = `UPDATE ow_projects SET title=? WHERE id=${String(
    Number(req.body.id)
  )} AND authorid=${res.locals.userid} LIMIT 1`;
  var VAL = [`${req.body.title}`];
  DB.qww(UPDATE, VAL, function (err, SCRATCH) {
    if (err) {
      res.status(404).send({ status: "err" });
    } else {
      res.status(200).send({ status: "ok" });
    }
  });
});

//简介
router.post("/setDescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${String(
    Number(req.body.id)
  )} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//样式
router.post("/setType", function (req, res) {
  var SET = { type: req.body["type"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${String(
    Number(req.body.id)
  )} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//开源项目
router.post("/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='public' WHERE id=${String(
    Number(req.body["id"])
  )} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});

// 从数据库获取作品
router.get("/getproject/:id", function (req, res) {
  var projectid = 0;
  if (req.params.id && req.params.id > 1) {
    projectid = req.params.id;
  }

  if (projectid == 0 || projectid == 1) {
    // 默认作品
    //***当把该块注释后，则从数据库加载默认作品***
    //从指定文件加载默认作品：BEGIN==========================================
    var DefaultPython = {
      id: 0,
      title: "Python新项目",
      state: "private",
      source: `import turtle\n\nt = turtle.Turtle()\nt.forward(100)\n\nprint ("Welcome to ZeroCat!")`,
    };
    if (projectid == 1) {
      res.status(200).send({ status: "ok", work: DefaultPython });
      return;
    }
    //从指定文件加载默认作品：END============================================
    //*/
    SQL = `SELECT * FROM ow_projects WHERE id=1`; //默认作品为1号作品
  } else {
    if (!res.locals.login) {
      //未登录时，只能打开已发布的作品
      SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND state='public'`;
    } else {
      //作品编辑：能够打开一个作品的几种权限：
      //1、自己的作品；
      //2、开源的作品；
      SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND (authorid=${res.locals.userid} OR state='public')`;
    }
  }

  DB.query(SQL, function (err, WORK) {
    if (err || WORK.length == 0) {
      res.status(200).send({ status: "0", msg: "作品不存在或无权打开" }); //需要前端内部处理
    } else {
      res.status(200).send({ status: "ok", work: WORK[0] });

      var UPDATE = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
      DB.query(UPDATE, function (err, s) {
        if (err) {
        }
      });
    }
  });
});

//获取源代码数据
router.get("/getproject/source/:id", function (req, res) {
  var SQL = `SELECT source FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
  DB.query(SQL, function (err, PROJECT) {
    if (err) {
      return;
    }
    if (PROJECT.length == 0) {
      return;
    }
    res.status(200).send(PROJECT[0].source);

    //浏览数+1
    var SQL = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${req.params.id} LIMIT 1`;
    DB.query(SQL, function (err, U) {
      if (err || U.affectedRows == 0) {
        res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
        res.render("404.ejs");
        return;
      }
    });
  });
});

//获取源代码数据
router.get("/:id/source/:env?", async function (req, res) {
  console.log(req.params.id);
  var project = await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(req.params.id),
      },
    })
    .catch((err) => {
      console.log(err);
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.render("404.ejs");
      return;
    })
    .then((project) => {
      console.log(project);
      return project;
    });

  console.log(project);
  if (project.authorid == res.locals.userid) {
    // 判断是不是作者
    if (project.devenv == false || req.params.env == "prod") {
      // 如果指定了不要测试环境则返回生产源码
      res.status(200).send(project.source);
    } else if (project.devsource == "" || project.devsource == null) {
      // 如果测试环境不存在则返回生产源码
      res.status(200).send(project.source);
    } else {
      // 返回测试环境源码
      res.status(200).send(project.devsource);
    }
  } else {
    // 如果不是作者则直接返回生产源码
    res.status(200).send(project.source);
  }
});

//删除项目
router.delete("/deleteProject/:id", function (req, res) {
  I.prisma.ow_projects
    .delete({
      where: {
        id: Number(req.params.id),
        authorid: res.locals.userid,
      },
    })
    .then((project) => {
      res.status(200).send({ status: "1", msg: "删除成功" });
    })
    .catch((err) => {
      res.status(200).send({ status: "0", msg: "删除失败" });
    });
});

//删除项目
router.delete("/:id", function (req, res) {
  I.prisma.ow_projects
    .delete({
      where: {
        id: Number(req.params.id),
        authorid: res.locals.userid,
      },
    })
    .then((project) => {
      res
        .status(200)
        .send({ status: "1", msg: "删除成功", message: "删除成功" });
    })
    .catch((err) => {
      res
        .status(200)
        .send({ status: "0", msg: "删除失败", message: "删除失败" });
    });
});

module.exports = router;
