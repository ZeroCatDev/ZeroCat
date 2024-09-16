var express = require("express");
var router = express.Router();

var DB = require("./lib/database.js"); // 数据库

const crypto = require("crypto");

//功能函数集
var I = require("./lib/global.js");
router.all("*", function (req, res, next) {
  next();
});
//router.get('/', function (req, res) {})
var default_project = require("./lib/default_project.js");

//新作品
router.post("/", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  try {
    var outputJson = {};

    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        if (
          [
            "type",
            "licence",
            "state",
            "title",
            "description",
            "history",
            "tags",
          ].includes(key)
        ) {
          outputJson[key] = req.body[key];
        }
      }
    }
    if (outputJson.type != undefined) {
      // 如果指定了类型没传源码则默认为该类型的源码
      outputJson.source = default_project[outputJson.type];
      outputJson.devsource = default_project[outputJson.type];
    } else {
      // 如果全都不指定则默认为scratch
      outputJson.source = default_project.scratch;
      outputJson.devsource = default_project.scratch;
    }
    outputJson.authorid = res.locals.userid;
    console.log(outputJson);
    I.prisma.ow_projects
      .create({
        data: outputJson,
      })
      .then(async (result) => {
        res.status(200).send({
          status: "1",
          msg: "保存成功",
          message: "保存成功",
          id: result.id,
        });
      });
  } catch (err) {
    console.log(err);
    res.status(200).send({ status: "0", msg: "保存失败", error: err });
    return;
  }
});

//fork作品
router.post("/:id/fork", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  try {
    I.prisma.ow_projects
      .findFirst({
        where: {
          id: Number(req.params.id),
        },
      })
      .then((result) => {
        if (result.state == "public") {
          I.prisma.ow_projects
            .create({
              data: {
                authorid: res.locals.userid,
                title: result.title + "改编",
                description: result.description,
                licence: result.licence,
                state: "private",
                type: result.type,
                source: result.source,
                devsource: result.source,
                tags: result.tags,
              },
            })
            .then((result) => {
              res
                .status(200)
                .send({ status: "1", msg: "改编成功", id: result.id });
            });
        } else {
          res.status(200).send({ status: "0", msg: "改编失败" });
        }
      });
  } catch (err) {
    console.log(err);
    res.status(200).send({ status: "0", msg: "改编失败", error: err });
    return;
  }
});


// 保存
router.put("/:id/source", function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }
  //console.log(req.body);
  try {
    var sha256 = setProjectFile(JSON.stringify(req.body));
    I.prisma.ow_projects
      .update({
        where: {
          id: Number(req.params.id),
          authorid: Number(res.locals.userid),
        },
        data: {
          devsource: sha256,
        },
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
                source: sha256,
              },
            })
            .then(async (result) => {
              res.status(200).send({ status: "1", msg: "保存成功" });
              console.log(result);
            });
        } else {
          res.status(200).send({ status: "1", msg: "保存成功" });
        }
      });
  } catch (error) {
    console.log(error);
    res.status(200).send({ status: "0", msg: "保存失败", error: error });
    return;
  }
});

// 保存
router.put("/:id", function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }
  try {
    var outputJson = {};

    for (const key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        if (
          [
            "type",
            "licence",
            "state",
            "title",
            "description",
            "history",
            "tags",
          ].includes(key)
        ) {
          outputJson[key] = req.body[key];
        }
      }
    }

    I.prisma.ow_projects
      .update({
        where: {
          id: Number(req.params.id),
          authorid: Number(res.locals.userid),
        },
        data: outputJson,
      })
      .then(async (result) => {
        res
          .status(200)
          .send({ status: "1", msg: "保存成功", message: "保存成功" });
      });
  } catch (error) {
    console.log(error);
    res.status(200).send({ status: "0", msg: "保存失败", error: error });
    return;
  }
});

// 推送
router.post("/:id/push", async function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }

  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: {
        id: Number(req.params.id),
        authorid: Number(res.locals.userid),
      },
    });

    if (project.devenv == 0) {
      if (req.body.force == "true") {
        await I.prisma.ow_projects.update({
          where: {
            id: Number(req.params.id),
            authorid: Number(res.locals.userid),
          },
          data: {
            source: project.devsource,
          },
        });
      } else {
        res.status(200).send({ status: "0", msg: "未开启开发环境，无法推送" });
        return;
      }
    } else {
      await I.prisma.ow_projects.update({
        where: {
          id: Number(req.params.id),
          authorid: Number(res.locals.userid),
        },
        data: {
          source: project.devsource,
        },
      });

      if (project.history == 1) {
        var sha256 = setProjectFile(project.source);
        console.log(sha256);
        // 创建一个历史记录
        await I.prisma.ow_projects_history.create({
          data: {
            projectid: Number(req.params.id),
            source: sha256,
            authorid: Number(res.locals.userid),
            type: project.type,
            title: project.title,
            description: project.description,
            state: project.state,
            licence: project.licence,
            tags: project.tags,
          },
        });
      }
      res
        .status(200)
        .send({ status: "1", msg: "推送成功", message: "推送成功" });
    }
  } catch (err) {
    console.log(err);
    res.status(200).send({
      status: "0",
      msg: "保存失败",
      message: "保存失败",
      error: err,
    });
  }
});


//获取源代码数据
router.get("/:id/source/:env?", async function (req, res) {
  try {
    console.log(req.params.id);
    var project = await I.prisma.ow_projects.findFirst({
      where: {
        id: Number(req.params.id),
      },
    });

    if (
      (project.authorid == res.locals.userid && project.devsource != "" && project.devsource != null)
    ) {
      console.log("dev");
      var getproject = await getProjectFile(project.devsource);
      res.status(200).send(getproject.source);
    } else if (project.state == 'public' || project.authorid == res.locals.userid) {
      console.log(project.source);

      var getproject = await getProjectFile(project.source);
      console.log(getproject);
      res.status(200).send(getproject.source);
    } else {
      res.status(200).send({ status: "0", msg: "作品不存在或无权打开4" });
    }
  } catch (err) {
    res
      .status(200)
      .send({ status: "0", msg: "作品不存在或无权打开1", error: err }); //需要前端内部处理
  }
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


//已弃用的接口
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
//获取源代码数据 弃用
router.get("/getproject/source/:id", async function (req, res) {
  try {
    console.log(req.params.id);
    var project = await I.prisma.ow_projects.findFirst({
      where: {
        id: Number(req.params.id),
      },
    });

    var project = await getProjectFile(project.source);

    res.status(200).send(project.source);
  } catch (err) {
    res
      .status(200)
      .send({ status: "0", msg: "作品不存在或无权打开2", error: err }); //需要前端内部处理
  }
});
// 从数据库获取作品 弃用
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
      res.status(200).send({ status: "0", msg: "作品不存在或无权打开3" }); //需要前端内部处理
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



// 通用函数
async function getProjectFile(sha256) {
  var getproject = await I.prisma.ow_projects_file
    .findFirst({
      where: {
        sha256: sha256,
      },
      select: {
        source: true,
        sha256: true,
      },
    })
    .catch((err) => {
      console.log(err);
    });
  return getproject;
}
function setProjectFile(source) {
  //console.log(source);
  // 创建一个历史记录
  var sha256 = crypto.createHash("sha256").update(source).digest("hex");
  I.prisma.ow_projects_file
    .create({
      data: {
        sha256: sha256,
        source: source,
      },
    })
    .catch((err) => {
      //console.log(err);
      return sha256;
    })
    .then((project) => {
      //console.log(project);
      return sha256;
    });
  return sha256;
}
module.exports = router;
