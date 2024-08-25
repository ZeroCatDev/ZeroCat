var express = require("express");
var router = express.Router();
const { encode, decode } = require("html-entities");

var DB = require("./lib/database.js"); // 数据库

//功能函数集
var I = require("./lib/global.js");

function getEnvironment(environment) {
  if (environment == "prod" || environment == "production") {
    return "production";
  } else if (environment == "dev" || environment == "development") {
    return "development";
  } else if (environment == "test" || environment == "testing") {
    return "testing";
  } else {
    return "production";
  }
}
// 获取作品信息
router.get("/:id", async function (req, res) {
  var projectid = req.params.id.split("-")[0];
  await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(projectid),
        OR: [{ state: { gte: 1 } }, { authorid: res.locals.userid }],
      },
      select: {
        id: true,
        type: true,
        licence: true,
        authorid: true,
        state: true,
        view_count: true,
        like_count: true,
        favo_count: true,
        time: true,
        title: true,
        description: true,
        environment: true,
        mainbranche: true,
      },
    })
    .catch((e) => {
      console.log(e);
      res.status(200).send({ status: "0", message: "出现错误" });
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "项目不存在" });
      } else {
        res.status(200).send({ status: "1", message: "成功", project: result });
      }
    });
});
// 获取作品源代码
router.get("/:id/src", async function (req, res) {
  var projectid = req.params.id.split("-")[0];
  var environment = getEnvironment(req.params.id.split("-")[1] || "production");

  await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(projectid),
        OR: [{ state: { gte: 1 } }, { authorid: res.locals.userid }],
      },
      select: {
        production: environment == "production" ? true : false,
        development: environment == "development" ? true : false,
        testing: environment == "testing" ? true : false,
      },
    })
    .catch((e) => {
      console.log(e);
      res.status(200).send({ status: "0", message: "出现错误" });
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "项目不存在" });
      } else {
        res.status(200).send(result[environment]);
      }
    });
});

// 新建作品
router.post("/", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_projects
    .create({
      data: {
        type: req.body.type || "text",
        licence: req.body.licence || "MIT",
        authorid: res.locals.userid,
        state: Number(req.body.state) || 0,
        title: req.body.title || "新作品",
        description: req.body.description || "ZeroCat",
        environment: { main: { history: false } },
        mainbranche: "main",
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "创建失败" });
      } else {
        res
          .status(200)
          .send({ status: "1", message: "创建成功", id: result.id });
      }
    });
});

// 获取分支
router.get("/branche/:id?", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  I.prisma.ow_project
    .findFirst({
      where: {
        id: Number(req.params.id || req.body.id),
        authorid: res.locals.userid,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "获取失败" });
      } else {
        res.status(200).send(result);
      }
    });
});
// 新建branches
router.post("/branche", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(req.body.id),
        authorid: res.locals.userid,
      },
      select: {
        environment: true,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "创建失败" });
      } else {
        var environments = result.environment;
        if (environments[req.body.branche]) {
          res.status(200).send({ status: "0", message: "分支已存在" });
          console.log("分支已存在");
          return;
        }
        environments[req.body.branche] = { history: Boolean(req.body.history) };

        I.prisma.ow_projects
          .update({
            where: {
              id: Number(req.body.id),
              authorid: res.locals.userid,
            },
            data: {
              environment: environments,
            },
          })
          .catch((e) => {
            console.log(e);
          })
          .then((result) => {
            if (!result) {
              res.status(200).send({ status: "0", message: "创建失败" });
            } else {
              res
                .status(200)
                .send({ status: "1", message: "创建成功", id: result.id });
            }
          });
      }
    });
});
// 更新分支
router.put("/branche", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(req.body.id),
        authorid: res.locals.userid,
      },
      select: {
        environment: true,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "更新失败1" });
      } else {
        var environments = result.environment;
        if (!environments[req.body.branche]) {
          res.status(200).send({ status: "0", message: "分支不存在" });
          console.log("分支不存在");
          return;
        }
        environments[req.body.branche] = { history: Boolean(req.body.history) };

        I.prisma.ow_projects
          .update({
            where: {
              id: Number(req.body.id),
              authorid: res.locals.userid,
            },
            data: {
              environment: environments,
            },
          })
          .catch((e) => {
            console.log(e);
          })
          .then((result) => {
            if (!result) {
              res.status(200).send({ status: "0", message: "更新失败2" });
            } else {
              res
                .status(200)
                .send({ status: "1", message: "更新成功", id: result.id });
            }
          });
      }
    });
});
// 更新分支
router.post("/branche/main", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  I.prisma.ow_projects
    .update({
      where: {
        id: Number(req.body.id),
        authorid: res.locals.userid,
      },
      data: {
        mainbranche: req.body.branche,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "更新失败1" });
      } else {
        res
          .status(200)
          .send({ status: "1", message: "更新成功", id: result.id });
      }
    });
});
// 删除分支
router.delete("/branche", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(req.body.id),
        authorid: res.locals.userid,
      },
      select: {
        environment: true,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "删除失败1" });
      } else {
        var environments = result.environment;
        if (!environments[req.body.branche]) {
          res.status(200).send({ status: "0", message: "分支不存在" });
          console.log("分支不存在");
          return;
        }
        delete environments[req.body.branche];

        I.prisma.ow_projects
          .update({
            where: {
              id: Number(req.body.id),
              authorid: res.locals.userid,
            },
            data: {
              environment: environments,
            },
          })
          .catch((e) => {
            console.log(e);
          })
          .then((result) => {
            if (!result) {
              res.status(200).send({ status: "0", message: "删除失败2" });
            } else {
              res
                .status(200)
                .send({ status: "1", message: "删除成功", id: result.id });
            }
          });
      }
    });
});

// 更新作品
router.post("/commit/:id", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var projectid = req.params.id;
  var projectenv = await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(projectid),
        authorid: res.locals.userid,
      },
      select: {
        environment: true,
        mainbranche: true,
      },
    })
    .catch((e) => {
      console.log(e);
      res.status(200).send({ status: "0", message: "出现错误1" });
      return;
    });
  var CommitBranche = "main";
  console.log(projectenv.environment);
  if (!req.body.branche && !projectenv.environment[req.body.branche]) {
    CommitBranche = projectenv.mainbranche;
  } else {
    CommitBranche = req.body.branche;
  }

  console.log("创建新的版本");
  await I.prisma.ow_project
    .create({
      data: {
        projectid: Number(projectid),
        authorid: res.locals.userid,
        branche: CommitBranche,
        title: req.body.title || "new commit",
        commit: req.body.commit || "commit text",
        source: req.body.source,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "创建失败" });
      } else {
        res.status(200).send({ status: "1", message: "成功" });
      }
    });
}); // 更新作品
router.post("/commitlast/:id", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var projectid = req.params.id;
  var projectenv = await I.prisma.ow_projects
    .findFirst({
      where: {
        id: Number(projectid),
        authorid: res.locals.userid,
      },
      select: {
        environment: true,
        mainbranche: true,
      },
    })
    .catch((e) => {
      console.log(e);
      res.status(200).send({ status: "0", message: "出现错误1" });
      return;
    });
  var CommitBranche = "main";
  console.log(projectenv.environment);
  if (!req.body.branche && !projectenv.environment[req.body.branche]) {
    CommitBranche = projectenv.mainbranche;
  } else {
    CommitBranche = req.body.branche;
  }
  console.log("更新最后一次提交");
  await I.prisma.ow_project
    .findFirst({
      orderBy: [
        {
          id: "desc",
        },
      ],
      where: {
        projectid: Number(projectid),
        authorid: res.locals.userid,
        branche: CommitBranche,
      },
    })
    .catch((e) => {
      console.log(e);
      res.status(200).send({ status: "0", message: "出现错误2" });
      return;
    })
    .then((result) => {
      console.log(result);
      if (!result) {
        console.log("创建第一次提交");
        I.prisma.ow_project
          .create({
            data: {
              projectid: Number(projectid),
              authorid: res.locals.userid,
              branche: CommitBranche,
              title: req.body.title || "new commit",
              commit: req.body.commit || "commit text",
              source: req.body.source,
            },
          })
          .catch((e) => {
            console.log(e);
          })
          .then((result) => {
            if (!result) {
              res.status(200).send({ status: "0", message: "创建失败" });
            } else {
              res.status(200).send({ status: "1", message: "成功" });
            }
          });
      } else {
        console.log("更新当前作品");
        I.prisma.ow_project
          .update({
            where: {
              projectid: Number(projectid),
              authorid: res.locals.userid,
              branche: CommitBranche,
              id: result.id,
            },
            data: {
              branche: CommitBranche,
              title: req.body.title || "new commit",
              commit: req.body.commit || "commit text",
              source: req.body.source,
            },
          })
          .catch((e) => {
            console.log(e);
          })
          .then((result) => {
            if (!result) {
              res.status(200).send({ status: "0", message: "创建失败" });
            } else {
              res.status(200).send({ status: "1", message: "成功" });
            }
          });
      }
    });
  return;
});
router.get("/commit/:id", async function (req, res) {
  console.log("获取提交");
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var commit = await I.prisma.ow_project.findFirst({
    where: {
      id: Number(req.params.id),
      authorid: res.locals.userid,
    },
  });
  res.status(200).send(commit);
});

router.get("/commit/:id/src", async function (req, res) {
  console.log("获取提交");
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var commit = await I.prisma.ow_project.findFirst({
    where: {
      id: Number(req.params.id),
      authorid: res.locals.userid,
    },
  });
  res.status(200).send(commit.source);
});
// 删除提交
router.delete("/commit/:id", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_project
    .delete({
      where: {
        id: Number(req.params.id),
        authorid: res.locals.userid,
      },
    })
    .catch((e) => {
      console.log(e);
    })
    .then((result) => {
      if (!result) {
        res.status(200).send({ status: "0", message: "删除失败" });
      } else {
        res.status(200).send({ status: "1", message: "成功" });
      }
    });
});
module.exports = router;
