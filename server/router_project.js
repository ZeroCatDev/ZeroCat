var express = require("express");
var router = express.Router();

var DB = require("./lib/database.js"); // 数据库

router.all("*", function (req, res, next) {
  next();
});
//router.get('/', function (req, res) {})

//保存作品：标题
router.post("/newProjcet", function (req, res) {
  if (!res.locals.login) {
    res.status(404);
    return;
  }var INSERT =`INSERT INTO ow_projects (authorid, title,type) VALUES (${res.locals.userid}, ?,?)`;
  var SET = [req.body.title,req.body.type]
  DB.qww(INSERT, SET, function (err, newproject) {
    if (err || newproject.affectedRows==0) {
      res.status(200).send({status: "x", msg: "创建失败" });
      return;
    }

    res.status(200).send({status: "ok", msg: "创建成功", 'id': newproject['insertId']})
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

//Scratch_play获取源代码数据部分
router.get("/getproject/src/:id", function (req, res) {
  var SQL = `SELECT src FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
  DB.query(SQL, function (err, PROJECT) {
    if (err) {
      return;
    }
    if (PROJECT.length == 0) {
      return;
    }
    res.status(200).send(PROJECT[0].src);

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
module.exports = router;
