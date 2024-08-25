var express = require("express");
var router = express.Router();
const { encode, decode } = require("html-entities");

var DB = require("./lib/database.js"); // 数据库

//功能函数集
var I = require("./lib/global.js");

//router.get('/', function (req, res) {})

//保存作品：标题
router.post("/newProjcet", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var INSERT = `INSERT INTO ow_projects (authorid, title,type) VALUES (${res.locals.userid}, ?,?)`;
  var SET = [req.body.title, req.body.type];
  DB.qww(INSERT, SET, function (err, newproject) {
    if (err || newproject.affectedRows == 0) {
      res.status(200).send({ status: "x", msg: "创建失败" });
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

//简介
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
  var SQL = `UPDATE ow_projects SET state=1 WHERE id=${String(
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
      state: 0,
      src: `import turtle\n\nt = turtle.Turtle()\nt.forward(100)\n\nprint ("Welcome to ZeroCat!")`,
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
      SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND state>0`;
    } else {
      //作品编辑：能够打开一个作品的几种权限：
      //1、自己的作品；
      //2、开源的作品；
      SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND (authorid=${res.locals.userid} OR state>0)`;
    }
  }

  DB.query(SQL, function (err, WORK) {
    if (err || WORK.length == 0) {
      res.status(200).send({ status: "x", msg: "作品不存在或无权打开" }); //需要前端内部处理
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
router.get("/getproject/src/:id", function (req, res) {
  var SQL = `SELECT production FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
  DB.query(SQL, function (err, PROJECT) {
    if (err) {
      return;
    }
    if (PROJECT.length == 0) {
      return;
    }
    res.status(200).send(PROJECT[0].production);

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

//删除项目
router.delete("/deleteProject/:id", function (req, res) {
  var DEL = `DELETE FROM ow_projects WHERE id=${req.params.id} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(DEL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    if (d.affectedRows == 0) {
      res.status(200).send({ status: "failed", msg: "删除失败" });
      return;
    }

    res.status(200).send({ status: "success", msg: "删除成功" });
  });
});

//获取源代码数据
router.get("/web/:id/*", function (req, res) {
  var SQL = `SELECT production FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
  DB.query(SQL, function (err, PROJECT) {
    if (err) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.render("404.ejs");
      return;
    }
    if (PROJECT.length == 0) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.render("404.ejs");
      return;
    }
    function getValue(arr, obj) {
      let result = obj;
      for (let i = 0; i < arr.length; i++) {
        // 检查当前键是否存在于对象中
        if (result[arr[i]] !== undefined) {
          result = result[arr[i]];
        } else {
          // 如果不存在对应的键，返回 false
          return false;
        }
      }
      return result;
    }

    var filestr = "";
    var filename = req.path.split("/");
    filename.splice(0, 2);
    //console.log(filename)
    //console.log(req.params.filename)
    //console.log(JSON.parse(PROJECT[0].production));

    if (getValue(filename, JSON.parse(PROJECT[0].production)) != false) {
      filestr = decode(getValue(filename, JSON.parse(PROJECT[0].production)));
      console.log(filestr);

      res.type("html").send(decode(filestr));
    } else {
      res.status(404).send({ code: 404, status: "failed", msg: "文件不存在" });
    }

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

function encodeHtmlInJson(jsonObj) {
  // 检查是否为对象或数组
  if (typeof jsonObj === "object" && jsonObj !== null) {
    // 遍历对象的每个键
    for (let key in jsonObj) {
      if (jsonObj.hasOwnProperty(key)) {
        // 递归调用处理嵌套的对象或数组
        jsonObj[key] = encodeHtmlInJson(jsonObj[key]);
      }
    }
  } else if (typeof jsonObj === "string" || typeof jsonObj === "number") {
    // 将数值或字符串类型的值与指定的字符串连接
    return encode(jsonObj.toString());
  }
  // 返回处理后的对象
  return jsonObj;
}

router.post("/update/:id", function (req, res) {
  if (!res.locals.userid) {
    res.status(200).send({ status: "x", msg: "请先登录" });
    return;
  }

  // 新作品
  //if (req.body.id == '0'){ var INSERT =`INSERT INTO ow_projects (authorid, title,src) VALUES (${res.locals.userid}, ?, ?)`; var SET = [req.body.title,req.body.data] DB.qww(INSERT, SET, function (err, newPython) { if (err || newPython.affectedRows==0) { res.status(200).send({status: "x", msg: "保存失败" }); return; } res.status(200).send({status: "ok", msg: "保存成功", 'newid': newPython['insertId']}) }); return; }
  console.log(req.body);
  console.log(encodeHtmlInJson(req.body));

  // 旧作品
  var UPDATE = `UPDATE ow_projects SET ? WHERE id=${req.params.id} AND authorid=${res.locals.userid} LIMIT 1`;
  var SET = {
    //        title:req.body.title,
    src: JSON.stringify(encodeHtmlInJson(req.body)),
    //        description:req.body.description
  };
  DB.qww(UPDATE, SET, function (err, u) {
    if (err) {
      res.status(200).send({ status: "x", msg: "保存失败" });
      return;
    }

    res.status(200).send({ status: "ok", msg: "保存成功" });
  });
});
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
  var environment = getEnvironment(req.params.id.split("-")[1] || "production")

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
        production: environment == "production" ? true : false,
        development: environment == "development" ? true : false,
        testing: environment == "testing" ? true : false,
        environment: true,
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
  var environment = getEnvironment(req.params.id.split("-")[1] || "production")


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
        production: req.body.production || "",
        development: req.body.development || "",
        testing: req.body.testing || "",
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
// 更新作品
router.put("/:id", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var projectid = req.params.id.split("-")[0];
  var environment = getEnvironment(req.params.id.split("-")[1] || "production")

  console.log(req.body.type != undefined);
  var data = {};
  const keys = Object.keys(req.body);
  allows = [
    "type",
    "licence",
    "state",
    "title",
    "description",
    "production",
    "development",
    "testing",
    "environment",
  ];
  keys.forEach((key) => {
    if (req.body[key] !== undefined && allows.includes(key)) {
      data[key] = req.body[key];
    } else {
      //console.log(key);
      //console.log(req.body[key]);
    }
  });
  // 简单检查下有没有不合规的数据
  // 不检查了，反正精选作品没有实际意义

  await I.prisma.ow_projects
    .update({
      where: {
        id: Number(projectid),
        authorid: res.locals.userid,
      },
      data: data,
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
});

// 更新作品
router.put("/:id/src", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  var projectid = req.params.id.split("-")[0];
  var environment = getEnvironment(req.params.id.split("-")[1] || "production")

  await I.prisma.ow_projects
    .update({
      where: {
        id: Number(projectid),
        authorid: res.locals.userid,
      },
      data: {
        production: environment == "production" ? req.body : {},
        development: environment == "development" ? req.body : {},
        testing: environment == "testing" ? req.body : {},
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
});
// 删除作品
router.delete("/:id", async function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }
  await I.prisma.ow_projects
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
