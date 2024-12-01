const logger = require("./lib/logger.js");
const configManager = require("./configManager");
const jsonwebtoken = require("jsonwebtoken");

var express = require("express");
var router = express.Router();
var fs = require("fs");
var DB = require("./lib/database.js"); // 数据库

//功能函数集
var I = require("./lib/global.js");
const { log, error } = require("console");
const { needlogin } = require("./middleware/auth.js");
const {
  getProjectsByList,
  getUsersByList,
  getProjectsAndUsersByProjectsList,
  extractProjectData,
  isJson,
  setProjectFile,
  getProjectFile,
  handleError,
  projectSelectionFields,
  authorSelectionFields,
} = require("./lib/method/projects.js");
router.all("*", function (req, res, next) {
  next();
});

router.get("/scratchcount", function (req, res, next) {
  try {
    //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
    var SQL =
      `SELECT ` +
      ` (SELECT count(id) FROM ow_projects WHERE state='public' AND type='scratch' ) AS scratch_count `;
    DB.query(SQL, function (err, data) {
      if (err) {
        // logger.error('数据库操作出错：');
        res.locals.scratch_count = 0;
      } else {
        res.locals.scratch_count = data[0].scratch_count;
      }
      res.status(200).send({ scratch_count: res.locals.scratch_count });
    });
  } catch (err) {
    next(err);
  }
});
//翻页：Scratch作品列表：数据
router.get("/view/getScratchProjects", function (req, res, next) {
  try {
    var curr = parseInt(req.query.curr); //当前要显示的页码
    var limit = parseInt(req.query.limit); //每页显示的作品数
    var type = "view_count";
    if (req.query.type === "new") {
      type = "time";
    }

    var SQL = `SELECT ow_projects.id, ow_projects.title, ow_projects.state,ow_projects.authorid,ow_projects.view_count, ow_users.display_name,ow_users.motto,ow_users.images FROM ow_projects JOIN ow_users ON ow_projects.authorid = ow_users.id WHERE ow_projects.state='public' AND ow_projects.type='scratch' ORDER BY ow_projects.${type} DESC LIMIT ${
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

//搜索：Scratch项目列表：数据//只搜索标题
router.get("/view/seachScratchProjects", function (req, res, next) {
  try {
    if (!req.query.txt) {
      res.status(200).send([]);
      return;
    }
    var tabelName = "scratch";
    var searchinfo = "title";
    if (req.query.searchall == "true") {
      searchinfo = "source";
    }
    //var SQL = `SELECT id, title FROM ow_projects WHERE state='public' AND (${searchinfo} LIKE ?) LIMIT 12`;
    var SQL = `SELECT ow_projects.id, ow_projects.title, ow_projects.state,ow_projects.authorid,ow_projects.description,ow_projects.view_count, ow_users.display_name,ow_users.motto FROM ow_projects JOIN ow_users ON ow_projects.authorid = ow_users.id WHERE ow_projects.state='public' AND (${searchinfo} LIKE ?) AND ow_projects.type='${tabelName}'`;
    var WHERE = [`%${req.query.txt}%`];
    DB.qww(SQL, WHERE, function (err, data) {
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

//==作品状态：
//0：未发布；
//1：已发布；
//2：已开源；（开源的必须发布）
//Scratch项目展示

router.get("/projectinfo", function (req, res, next) {
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
      ` WHERE ow_projects.id=${req.query.id} AND (ow_projects.state='public' ${
        res.locals.userid ? `or ow_projects.authorid=${res.locals.userid}` : ""
      }) AND ow_projects.type='scratch' LIMIT 1`;
    DB.query(SQL, function (err, SCRATCH) {
      if (err || SCRATCH.length == 0) {
        res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
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

      ////logger.debug(SCRATCH[0]);
      res.json(SCRATCH[0]);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/projectinfo2", async function (req, res, next) {
  try {
    var result = await I.prisma.ow_projects.findFirst({
      where: {
        id: Number(req.query.id),
      },
    });
    var author = await I.prisma.ow_users.findFirst({
      where: {
        id: result.authorid,
      },
    });
    res.locals["is_author"] =
      result.authorid == res.locals.userid ? true : false;
    logger.debug(result);
    var resulttype = {
      id: 50,
      type: "scratch",
      licence: "no",
      authorid: 89,
      teacherid: 0,
      state: "public",
      view_count: 119,
      like_count: 0,
      favo_count: 0,
      time: "2024-06-22T10:32:42.000Z",
      title: "title",
      description: "description",
      source: "source",
      history: true,
      devenv: true,
      devsource: "devsource",
      tags: "",
    };
    var project_token = jsonwebtoken.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
        data: {
          type: "project",
          action: "read",
          issuer: await configManager.getConfig("site.domain"),
          projectid: result.id,
          userid: res.locals.userid,
        },
      },
      await configManager.getConfig("security.jwttoken")
    );
    logger.debug(project_token);
    jsonscratch = {
      id: result.id,
      title: result.title,
      description: result.description,
      instructions: "ZeroCat社区",
      visibility: "visible",
      public: result.state == "public" ? true : false,
      comments_allowed: true,
      is_published: result.state == "public" ? true : false,
      author: {
        id: result.authorid,
        username: author.display_name,
        scratchteam: author.id == 1 ? true : false,
        history: {
          joined: author.createdAt,
        },
        profile: {
          id: null,
          images: {
            "90x90": `${global.config["urls.static"]}/user/${author.images}`,
            "60x60": `${global.config["urls.static"]}/user/${author.images}`,
            "55x55": `${global.config["urls.static"]}/user/${author.images}`,
            "50x50": `${global.config["urls.static"]}/user/${author.images}`,
            "32x32": `${global.config["urls.static"]}/user/${author.images}`,
          },
        },
      },
      image: `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      images: {
        "282x218": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "216x163": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "200x200": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "144x108": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "135x102": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "100x80": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      },
      history: {
        created: result.createdAt,
        modified: result.createdAt,
        shared: result.createdAt,
      },
      stats: {
        views: result.view_count,
        loves: 0,
        favorites: 0,
        remixes: 0,
      },
      remix: {
        parent: null,
        root: null,
      },
      project_token,
    };
    ////logger.debug(SCRATCH[0]);
    res.json(jsonscratch);
  } catch (err) {
    next(err);
  }
});

// 获取源代码
router.get("/project/:id", async (req, res, next) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ status: "0", msg: "缺少项目ID" });
    }
    let project_token;
    if (req.query.token) {
      try {
        logger.debug(await configManager.getConfig("security.jwttoken"));
        project_token = jsonwebtoken.verify(
          req.query.token,
          await configManager.getConfig("security.jwttoken")
        );
        logger.debug(project_token);
      } catch (err) {
        logger.debug("Error verifying project token:", err);
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
      if (project_token.data.projectid != req.params.id) {
        logger.debug("1");
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
      if (res.locals.userid && project_token.data.userid != res.locals.userid) {
        logger.debug("2");
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
    } else {
      logger.debug("3");
      return res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(project_token.data.projectid) },
    });

    if (!project) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const source =
      project.authorid === project_token.data.userid
        ? project.devsource
        : project.source;
    const projectFile = await getProjectFile(source);

    if (projectFile?.source) {
      res.status(200).send(projectFile.source);
    } else {
      res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
  } catch (err) {
    logger.error("Error fetching project source code:", err);
    next(err);
  }
});

//Scratch_play获取源代码数据部分
router.get("/play/project/:id", function (req, res, next) {
  try {
    var SQL = `SELECT source FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
    DB.query(SQL, function (err, SCRATCH) {
      if (err) {
        return;
      }
      if (SCRATCH.length == 0) {
        return;
      }
      res.status(200).send(SCRATCH[0].source);

      //浏览数+1
      var SQL = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${req.params.id} LIMIT 1`;
      DB.query(SQL, function (err, U) {
        if (err || U.affectedRows == 0) {
          res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
          res.status(404).json({
            status: "error",
            code: "404",
            message: "找不到页面",
          });
          return;
        }
      });
    });
  } catch (err) {
    next(err);
  }
});

//项目开源、闭源
router.post("/play/openSrc", function (req, res, next) {
  try {
    if (!res.locals.login) {
      res.status(200).send({ status: "failed", msg: "请先登录" });
      return;
    }

    var pid = req.body["pid"];
    var SQL = `SELECT state FROM ow_projects WHERE id=${pid} AND authorid=${res.locals.userid} LIMIT 1`;
    DB.query(SQL, function (err, RECO) {
      if (err || RECO.length == 0) {
        res.status(200).send({ status: "failed", msg: "数据错误，请再试一次" });
        return;
      }

      var state = 1;
      if (RECO[0].state == 1) {
        state = 2;
      }

      var UPDATE = `UPDATE ow_projects SET state=${state} WHERE id=${pid} LIMIT 1`;
      DB.query(UPDATE, function (err, SCRATCH) {
        if (err) {
          res
            .status(200)
            .send({ status: "failed", msg: "数据错误，请再试一次" });
          return;
        }

        res.status(200).send({ status: "1", msg: "操作成功" });
      });
    });
  } catch (err) {
    next(err);
  }
});

//Scratch内部调用一：获取作品数据：JSON源代码
//支持两种方案加载默认作品
//1、从指定文件加载
//2、从数据库加载
router.post("/project/:projectid", function (req, res, next) {
  try {
    ////logger.debug('服务器：获取作品JSON源代码');
    var projectid = 0;
    if (req.params.projectid) {
      projectid = req.params.projectid;
    }

    if (projectid == 0) {
      // 默认作品
      // 当把该块注释后，则从数据库加载默认作品
      //从指定文件加载默认作品：BEGIN==========================================
      var _SDP = require("./lib/scratch_default_project.js");
      res.status(200).send({ status: "ok", src: _SDP });
      return;
      //从指定文件加载默认作品：END============================================
      //
      SQL = `SELECT id, authorid, state, title, source FROM ow_projects WHERE id=1`; //默认作品为1号作品
    } else {
      if (!res.locals.login) {
        SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND state='public'`;
      } else {
        //作品编辑：能够打开一个作品的几种权限：
        //0、管理员能打开所有作品;
        //1、自己的作品；
        //2、开源的作品；
        //3、课堂用例、作业模板：购买课程后可以打开；
        //4、课堂作业作品：课程老师可以打开；
        if (res.locals["is_admin"] == 1) {
          SQL = `SELECT * FROM ow_projects WHERE id=${projectid}`;
        } else {
          SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND (authorid=${res.locals.userid} OR state='public')`;
          //(AND (courseid IN (SELECT courseid FROM student WHERE studentid=${res.locals.userid} AND coursepayid>0)))
        }
      }
    }

    DB.query(SQL, function (err, SCRATCH) {
      if (err) {
        res.status(200).send({ status: "作品不存在或无权打开" }); //需要Scratch内部处理
        return;
      }

      if (SCRATCH.length == 0) {
        //4、课堂作业作品：课程老师可以打开；
        SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND courseid!=0 AND (courseid IN (SELECT courseid FROM class WHERE teacherid=${res.locals.userid}))`;
        DB.query(SQL, function (err, SCRATCH) {
          if (err || SCRATCH.length == 0) {
            res.status(200).send({ status: "作品不存在或无权打开" }); //需要Scratch内部处理
            return;
          }

          //作品被浏览次数+1
          var UPDATE = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
          DB.query(UPDATE, function (err, s) {
            if (err) {
            }
          });

          SCRATCH[0]["teacher_id"] = res.locals.userid;
          res.status(200).send({ status: "ok", src: SCRATCH[0] });
        });

        return;
      }

      if (projectid == 0) {
        // 默认作品， 转换成scratch.min.js能使用的默认作品数据
        SCRATCH[0].id = 0;
        SCRATCH[0].authorid = 0;
        SCRATCH[0].state = 0;
        projectid = 1;
      }

      //作品被浏览次数+1
      var UPDATE = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
      DB.query(UPDATE, function (err, s) {
        if (err) {
        }
      });

      res.status(200).send({ status: "ok", src: SCRATCH[0] });
    });
  } catch (err) {
    next(err);
  }
});

//Scratch内部调用二：获取作品素材：背景、角色、音频。取素材时需要完整的文件路径
router.get("/assets/:filename", function (req, res, next) {
  try {
    var p = `${global.dirname}/data/material/asset/${req.params.filename}`;
    res.sendFile(p); //必须是绝对路径
  } catch (err) {
    next(err);
  }
});

//保存作品：标题
router.post("/saveProjcetTitle", function (req, res, next) {
  try {
    if (!res.locals.login) {
      res.status(404);
      return;
    }
    var UPDATE = `UPDATE ow_projects SET title=? WHERE id=${req.body.id} AND authorid=${res.locals.userid} LIMIT 1`;
    var VAL = [`${req.body.title}`];
    DB.qww(UPDATE, VAL, function (err, SCRATCH) {
      if (err) {
        res.status(404).send({ status: "err" }); //返回内容可有可无，，因为客户端没处理
      } else {
        res.status(200).send({ status: "ok" }); //返回内容可有可无，因为客户端没处理
      }
    });
  } catch (err) {
    next(err);
  }
});

//保存作品源代码：此时作品已存在。req.body为项目JSON源代码
router.put("/projects/:projectid", function (req, res, next) {
  try {
    // //logger.debug('服务器：保存作品JSON源代码');
    if (!res.locals.login) {
      res.status(404).send({});
      return;
    }

    var SQL = `SELECT id, authorid FROM ow_projects WHERE id=${req.params.projectid} LIMIT 1`;
    DB.query(SQL, function (err, SWork) {
      if (err || SWork.length == 0) {
        res.status(404).send({});
        return;
      }

      if (SWork[0].authorid != res.locals.userid) {
        res.status(404).send({});
        return;
      }

      var UPDATE = `UPDATE ow_projects SET source=? WHERE id=${req.params.projectid} LIMIT 1`;
      var VAL = [`${JSON.stringify(req.body)}`];
      DB.qww(UPDATE, VAL, function (err, SCRATCH) {
        if (err) {
          res.status(404).send({});
          return;
        }

        res.status(200).json({ status: "ok" });
      });
    });
  } catch (err) {
    next(err);
  }
});
//保存作品：缩略图
router.post("/thumbnail/:projectid", function (req, res, next) {
  try {
    ////logger.debug('开始保存缩略图：'+req.params.projectid);

    // 请求的头部为 'Content-Type': 'image/png'时，用req.on接收文件
    var _data = [];
    req.on("data", function (data) {
      if (data) {
        _data["push"](data);
      }
    });
    req.on("end", function () {
      //var strFileName = './data/scratch_slt/' + req.params.projectid;
      var strFileName = `${global.dirname}/data/scratch_slt/${req.params.projectid}`;
      let content = Buffer["concat"](_data);
      fs.writeFile(strFileName, content, function (err) {
        if (err) {
          res.status(404).send({ status: "err" });
          //logger.debug(err);
          //logger.debug("保存缩略图失败：" + strFileName);
        } else {
          I.S3update("scratch_slt/" + req.params.projectid, strFileName);

          ////logger.debug('保存缩略图成功：'+strFileName);
          res.status(200).send({ status: "ok" });
          //fs.unlink(`./data/scratch_slt/${req.params.projectid}`,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
        }
      });
    });
  } catch (err) {
    next(err);
  }
});
//分享作品：
router.post("/shareProject/:projectid", function (req, res, next) {
  try {
    if (!res.locals.login) {
      res.status(200).send({ status: "0" });
      return;
    }

    var s = 0;
    if (req.body.s == 1) {
      s = 1;
    }

    //只能分享自己的作品
    var UPDATE = `UPDATE ow_projects SET state=${s} WHERE id=${req.params.projectid} AND authorid=${res.locals.userid} LIMIT 1`;
    DB.query(UPDATE, function (err, U) {
      if (err) {
        res.status(200).send({ status: "0" });
        return;
      }

      res.status(200).send({ status: "ok" });
    });
  } catch (err) {
    next(err);
  }
});

//保存新作品：保存源代码及作品名称。req.body为项目JSON源代码,?title=作品名称
router.post("/projects", function (req, res, next) {
  try {
    //logger.debug("服务器：新建作品JSON源代码");

    //if (!req.body) { res.send(404); return; }
    var title = "新作品";
    if (req.query.title) {
      title = req.query.title;
    }

    var INSERT = `INSERT INTO ow_projects (authorid, title, source,type) VALUES (${res.locals.userid}, ?, ?,'scratch')`;
    var VAL = [title, `${JSON.stringify(req.body.work || req.body)}`];
    DB.qww(INSERT, VAL, function (err, newScratch) {
      if (err || newScratch.affectedRows == 0) {
        res.send(404);
        return;
      }

      res.status(200).send({
        status: "ok",
        id: newScratch["insertId"],
      });
    });
  } catch (err) {
    next(err);
  }
});
//新作品：保存作品素材
router.post("/assets/:filename", function (req, res, next) {
  try {
    var strFileName = "./data/material/asset/" + req.params.filename;
    fs.exists(
      strFileName,
      function (bExists) {
        //if (bExists) {
        //  logger.debug("素材已存在：" + strFileName);
        //  res.status(200).send({ status: "ok" });
        //} else {
        var _data = [];
        req.on("data", function (data) {
          if (data) {
            _data["push"](data);
          }
        });
        req.on("end", function () {
          let content = Buffer["concat"](_data);
          fs.writeFile(strFileName, content, function (err) {
            if (err) {
              res.send(404);
              //logger.debug("素材保存失败：" + strFileName);
            } else {
              I.S3update("material/asset/" + req.params.filename, strFileName);

              logger.debug("素材保存成功：" + strFileName);
              res.status(200).send({ status: "ok" });
              //fs.unlink('./data/material/asset/' + req.params.filename,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
            }
          });
        });
      }
      //}
    );
  } catch (err) {
    next(err);
  }
});

// 自定义背景
router.get("/getBackdrop", (req, res, next) => {
  try {
    var resultData = { tags: [], mates: [] };
    var SQL = `SELECT * FROM material_tags WHERE type=1`;
    DB.query(SQL, function (err, TAGS) {
      if (err || TAGS.length == 0) {
        res.status(200).send(resultData);
        return;
      }

      resultData.tags = TAGS;

      var SQL = `SELECT mb.src
            FROM material_backdrop mb
            INNER JOIN material_tags mt ON mt.type=1
            WHERE mb.tagId=mt.id `;
      DB.query(SQL, function (err, Mates) {
        if (err || Mates.length == 0) {
          res.status(200).send(resultData);
          return;
        }

        resultData.mates = Mates;

        res.status(200).send(resultData);
      });
    });
  } catch (err) {
    next(err);
  }
});
// 自定义角色
router.get("/getSprite", (req, res, next) => {
  try {
    var resultData = { tags: [], mates: [] };
    res.status(200).send(resultData);
  } catch (err) {
    next(err);
  }
});
// 自定义造型
router.get("/getCostume", (req, res, next) => {
  try {
    var resultData = {
      tags: [{ tag: "people", intlLabel: "造型测试标签" }],
      mates: [
        {
          name: "Abby-a",
          tags: ["people"],
          assetId: "809d9b47347a6af2860e7a3a35bce057",
          bitmapResolution: 1,
          dataFormat: "svg",
          md5ext: "809d9b47347a6af2860e7a3a35bce057.svg",
          rotationCenterX: 31,
          rotationCenterY: 100,
        },
      ],
    };
    res.status(200).send(resultData);
  } catch (err) {
    next(err);
  }
});
// 自定义声音
router.get("/getSound", (req, res, next) => {
  try {
    var resultData = { tags: [], mates: [] };
    res.status(200).send(resultData);
  } catch (err) {
    next(err);
  }
});

// 取自定义扩展
router.get("/getExtensionLibrary", async (req, res, next) => {
  try {
    var resultData = [
      {
        name: "数学王国",
        extensionId: "CoCoMathExt",
        extensionURL: "/static/extensions/coco-math-extension.js",
        iconURL: "/static/extensions/cocoExt.jpg",
        insetIconURL: "/static/extensions/cocoLogo.png",
        description:
          (await configManager.getConfig("site.name")) + "自定义扩展",
        featured: true,
      },
    ];

    res.status(200).send(resultData);
  } catch (err) {
    next(err);
  }
});

//点击积木块，从服务器上获取数据
router.get("/test_getBlockLinkToServer", (req, res, next) => {
  try {
    res
      .status(200)
      .send("从服务器上获取数据成功，当前服务器时间：" + new Date().toString());
  } catch (err) {
    next(err);
  }
});

// 获取我的作品列表
// req.body.t:0：未分享/1：已分享 /100：全部 /200：收藏
router.post("/getMyProjectLibrary", function (req, res, next) {
  try {
    if (res.locals["userid"] == "") {
      res.status(200).send({ status: "err", data: [] });
    }

    var WHERE = "";
    if (req.body.t == 0) {
      WHERE = " AND state='private'";
    } else if (req.body.t == 1) {
      // 包括1发而的、2推荐的
      WHERE = " AND state='public'";
    }

    if (req.body.f && req.body.f != "") {
      WHERE += ` AND title LIKE '%${req.body.f}%'`;
    }

    var SELECT = `SELECT id, title, time, state FROM ow_projects WHERE authorid=${res.locals["userid"]} ${WHERE} AND ow_projects.type='scratch' ORDER BY time DESC LIMIT ${req.body.l},${req.body.n}`; //正式版本中，需要限定作者本身的作品
    DB.query(SELECT, function (err, SCRATCH) {
      if (err) {
        res.status(200).send({ status: "err", data: [] });
      } else {
        res.status(200).send({ status: "ok", data: SCRATCH });
      }
    });
  } catch (err) {
    next(err);
  }
});

// 获取优秀作品列表
router.post("/getYxProjectLibrary", function (req, res, next) {
  try {
    var SELECT =
      ` SELECT s.id, s.title, s.view_count, s.authorid, u.display_name, u.images FROM ow_projects s ` +
      " LEFT JOIN ow_users u ON u.id=s.authorid " +
      ` WHERE s.state='public' AND s.type='scratch' ORDER BY s.view_count DESC LIMIT ${req.body.l},${req.body.n}`;
    DB.query(SELECT, function (err, SCRATCH) {
      if (err) {
        res.status(200).send({ status: "err", data: [] });
      } else {
        res.status(200).send({ status: "ok", data: SCRATCH });
      }
    });
  } catch (err) {
    next(err);
  }
});

// 获取背景
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为20个
router.post("/getBackdropLibrary", function (req, res, next) {
  try {
    var WHERE = "";
    if (req.body.t != 0) {
      WHERE = " AND tagId=" + req.body.t;
    }

    if (req.body.f && req.body.f != "") {
      WHERE += ` AND name LIKE '%${req.body.f}%'`;
    }

    var SELECT = `SELECT id, name, md5, info0, info1, info2  FROM material_backdrop WHERE state='public' ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
    DB.query(SELECT, function (err, Backdrop) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      if (req.body.tag == 0) {
        res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
        return;
      }

      // 取一次背景分类
      SELECT = `SELECT id, tag FROM material_tags WHERE type=1 ORDER BY id DESC`;
      DB.query(SELECT, function (err, tags) {
        if (err) {
          res.status(200).send({ status: "err", data: [], tags: [] });
          return;
        }

        res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
      });
    });
  } catch (err) {
    next(err);
  }
});

// 随机获取一个背景
router.post("/getRandomBackdrop", function (req, res, next) {
  try {
    const SELECT =
      `SELECT name, md5, info0, info1, info2 FROM material_backdrop` +
      ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_backdrop WHERE state='public') AS m ` +
      ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state='public' LIMIT 1`;
    DB.query(SELECT, function (err, B) {
      if (err || B.length < 1) {
        res.status(200).send({ status: "err", data: {} });
        return;
      }

      res.status(200).send({ status: "ok", data: B[0] });
    });
  } catch (err) {
    next(err);
  }
});

// 获取造型
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为32个
router.post("/getCostumeLibrary", function (req, res, next) {
  try {
    // //logger.debug(req.body);

    var WHERE = "";
    if (req.body.t != 0) {
      WHERE = " AND tagId=" + req.body.t;
    }

    if (req.body.f && req.body.f != "") {
      WHERE += ` AND name LIKE '%${req.body.f}%'`;
    }

    var SELECT = `SELECT id, name, md5, info0, info1, info2  FROM material_costume WHERE state='public' ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
    DB.query(SELECT, function (err, Backdrop) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      if (req.body.tag == 0) {
        res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
        return;
      }

      // 取一次分类
      SELECT = `SELECT id, tag FROM material_tags WHERE type=3 ORDER BY id DESC`;
      DB.query(SELECT, function (err, tags) {
        if (err) {
          res.status(200).send({ status: "err", data: [], tags: [] });
          return;
        }

        res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
      });
    });
  } catch (err) {
    next(err);
  }
});

// 随机获取一个造型
router.post("/getRandomCostume", function (req, res, next) {
  try {
    const SELECT =
      `SELECT name, md5, info0, info1, info2 FROM material_costume` +
      ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_costume WHERE state='public') AS m ` +
      ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state='public' LIMIT 1`;
    DB.query(SELECT, function (err, B) {
      if (err || B.length < 1) {
        res.status(200).send({ status: "err", data: {} });
        return;
      }

      res.status(200).send({ status: "ok", data: B[0] });
    });
  } catch (err) {
    next(err);
  }
});

// 获取声音
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的背景数; n: 每次获取的背景数，默认为32个
router.post("/getSoundLibrary", function (req, res, next) {
  try {
    var WHERE = "";
    if (req.body.t != 0) {
      WHERE = " AND tagId=" + req.body.t;
    }

    if (req.body.f && req.body.f != "") {
      WHERE += ` AND name LIKE '%${req.body.f}%'`;
    }

    var SELECT = `SELECT id, name, md5, format, rate, sampleCount FROM material_sound WHERE state='public' ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
    DB.query(SELECT, function (err, Backdrop) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      if (req.body.tag == 0) {
        res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
        return;
      }

      // 取一次分类
      SELECT = `SELECT id, tag FROM material_tags WHERE type=4 ORDER BY id DESC`;
      DB.query(SELECT, function (err, tags) {
        if (err) {
          res.status(200).send({ status: "err", data: [], tags: [] });
          return;
        }

        res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
      });
    });
  } catch (err) {
    next(err);
  }
});
// 随机获取一个声音
router.post("/getRandomSound", function (req, res, next) {
  try {
    const SELECT =
      `SELECT name, md5, format, rate, sampleCount FROM material_sound` +
      ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_sound WHERE state='public') AS m ` +
      ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state='public' LIMIT 1`;
    DB.query(SELECT, function (err, B) {
      if (err || B.length < 1) {
        res.status(200).send({ status: "err", data: {} });
        return;
      }

      res.status(200).send({ status: "ok", data: B[0] });
    });
  } catch (err) {
    next(err);
  }
});

// 获取角色
// 组件获取条件 tag：是否获取分类; f: 搜索字符串; t: 分类; l: 已经获取的素材数; n: 每次获取的素材数，默认为32个
router.post("/getSpriteLibrary", function (req, res, next) {
  try {
    var WHERE = "";
    if (req.body.t != 0) {
      WHERE = " AND tagId=" + req.body.t;
    }

    if (req.body.f && req.body.f != "") {
      WHERE += ` AND name LIKE '%${req.body.f}%'`;
    }

    var SELECT = `SELECT id, name, json FROM material_sprite WHERE state='public' ${WHERE} ORDER BY name DESC LIMIT ${req.body.l},${req.body.n}`;
    DB.query(SELECT, function (err, Backdrop) {
      if (err) {
        res.status(200).send({ status: "err", data: [], tags: [] });
        return;
      }

      if (req.body.tag == 0) {
        res.status(200).send({ status: "ok", data: Backdrop, tags: [] });
        return;
      }

      // 取一次分类
      SELECT = `SELECT id, tag FROM material_tags WHERE type=2 ORDER BY id DESC`;
      DB.query(SELECT, function (err, tags) {
        if (err) {
          res.status(200).send({ status: "err", data: [], tags: [] });
          return;
        }

        res.status(200).send({ status: "ok", data: Backdrop, tags: tags });
      });
    });
  } catch (err) {
    next(err);
  }
});
// 随机获取一个角色
router.post("/getRandomSprite", function (req, res, next) {
  try {
    const SELECT =
      `SELECT name, json FROM material_sprite` +
      ` JOIN (SELECT MAX(id) AS maxId, MIN(id) AS minId FROM material_sprite WHERE state='public') AS m ` +
      ` WHERE id >= ROUND(RAND()*(m.maxId - m.minId) + m.minId) AND state='public' LIMIT 1`;
    DB.query(SELECT, function (err, B) {
      if (err || B.length < 1) {
        res.status(200).send({ status: "err", data: {} });
        return;
      }

      res.status(200).send({ status: "ok", data: B[0] });
    });
  } catch (err) {
    next(err);
  }
});

//Scratch启动时，自动获取一次登录信息
router.post("/getSession", async (req, res, next) => {
  try {
    if (!res.locals.login) {
      var new_session = {
        userid: 0,
        email: "",
        username: "",

        display_name: "",
        avatar: ``,
      };
    } else {
      var new_session = {
        userid: parseInt(res.locals["userid"]),
        email: res.locals["email"],
        username: res.locals["username"],

        display_name: res.locals["display_name"],
        avatar: `${await configManager.getConfig("s3.staticurl")}/user/${
          res.locals["avatar"]
        }`,
      };
    }

    res.status(200).send(JSON.stringify(new_session));
  } catch (err) {
    next(err);
  }
});

//从Scratch中退出
router.post("/logout", function (req, res, next) {
  try {
    logout(req, res);
    var login_info = [{ email: "ZeroCatExampleUser", success: 1 }];
    res.status(200).send(login_info);
  } catch (err) {
    next(err);
  }
});
module.exports = router;
