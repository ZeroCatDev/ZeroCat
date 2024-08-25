//个人中心
var express = require("express");
var router = express.Router();
var fs = require("fs");
var crypto = require("crypto");
//功能函数集
var I = require("./lib/global.js");
//数据库
var DB = require("./lib/database.js");
const geetest = require('./geetest.js');

router.all("*", function (req, res, next) {
  //限定访问该模块的权限：必须已登录
  if (!res.locals.login) {
    //未登录时，跳转到登录界面
    res.redirect("/account/login");
    return;
  }

  //设置导航栏选中情况
  res.locals["curItem"] = {};
  next();
});

//个人中心：当前版本，直接跳转到个人作品
router.get("/", function (req, res) {
  res.redirect("/my/scratch");
});
router.get("/project", function (req, res) {
  res.redirect("/my/scratch");
});

//作品
router.get("/scratch", function (req, res) {
  var SQL =
    `SELECT ` +
    ` count(case when state=0 then 1 end) AS state0_count, ` +
    ` count(case when state=1 then 1 end) AS state1_count, ` +
    ` count(case when state=2 then 1 end) AS state2_count ` +
    ` FROM scratch WHERE authorid=${res.locals["userid"]}`;

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
    res.render("scratch/my_scratch_projects.ejs");
  });
});

//作品
router.get("/python", function (req, res) {
  var SQL =
    `SELECT ` +
    ` count(case when state=0 then 1 end) AS state0_count, ` +
    ` count(case when state=1 then 1 end) AS state1_count, ` +
    ` count(case when state=2 then 1 end) AS state2_count ` +
    ` FROM python WHERE authorid=${res.locals.userid}`;

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
    res.render("python/my_python_projects.ejs");
  });
});
//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.get("/getScratchProjects", function (req, res) {
  var curr = parseInt(req.query.curr); //当前要显示的页码
  var limit = parseInt(req.query.limit); //每页显示的作品数
  var state = parseInt(req.query.state); //每页显示的作品状态

  var SQL = `SELECT id,type, title,view_count,description FROM ow_projects WHERE authorid=${
    res.locals.userid
  } AND state=${state} AND type='scratch' ORDER BY view_count DESC LIMIT ${
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
router.get("/getPythonProjects", function (req, res) {
  var curr = parseInt(req.query.curr); //当前要显示的页码
  var limit = parseInt(req.query.limit); //每页显示的作品数
  var state = parseInt(req.query.state); //每页显示的作品状态

  var SQL = `SELECT id,type, title,view_count,description FROM ow_projects WHERE authorid=${
    res.locals.userid
  } AND state=${state} AND type='scratch' ORDER BY view_count DESC LIMIT ${
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

//分享Scratch项目
router.post("/scratch/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=1 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});

//分享Scratch项目
router.post("/python/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=1 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});

//分享Scratch项目
router.post("/project/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=1 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});
//简介
router.post("/scratch/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//简介
router.post("/python/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});
//简介
router.post("/project/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//取消分享Scratch项目
router.post("/scratch/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=0 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});

//取消分享Scratch项目
router.post("/python/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=0 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});

//取消分享Scratch项目
router.post("/project/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state=0 WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});
//删除Scratch项目
router.post("/scratch/del", function (req, res) {
  var DEL = `DELETE FROM ow_projects WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  DB.query(DEL, function (err, d) {
    if (err) {
      res.status(200).send(I.msg_fail);
      return;
    }

    if (d.affectedRows == 0) {
      res.status(200).send({ status: "failed", msg: "删除失败" });
      return;
    }

    //var filename = ('./data/scratch_slt/' + req.body['id']);
    //I.qiniudelete('scratch_slt/' + req.body['id'])
    //fs.unlink(filename,function (err) {if(err){}});

    res.status(200).send({ status: "success", msg: "删除成功" });
  });
});

//删除Scratch项目
router.post("/python/del", function (req, res) {
  var DEL = `DELETE FROM ow_projects WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
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

//删除Scratch项目
router.post("/project/del", function (req, res) {
  var DEL = `DELETE FROM ow_projects WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
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
//个人设置
router.get("/info", function (req, res) {
    res.render("my_info.ejs");
});
//修改头像
router.post("/set/avatar", geetest,function (req, res) {
  //保存文件到正确位置
  if (!req["files"]["file"]) {
    res.status(200).send({ status: "文件上传失败" });
    return;
  }

  tmppath = req["files"]["file"]["path"];
  newpath = `./data/user/${res.locals.userid}`;
  fs.rename(tmppath, newpath, function (err) {
    if (err) {
      res.status(200).send({ status: "文件上传失败" });
      return;
    }

    // 计算图片的md5值
    const hash = crypto.createHash("md5");
    const chunks = fs.createReadStream(newpath);
    chunks.on("data", (chunk) => {
      hash.update(chunk);
    });
    chunks.on("end", () => {
      const hashValue = hash.digest("hex");
      // 上传到七牛云
      I.S3update(`user/${hashValue}`, newpath, res.locals.email);
      var UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
      var SET = {
        images: hashValue,
      };
      DB.qww(UPDATE, SET, function (err, u) {
        if (err) {
          res.status(200).send({ status: "请再试一次" ,message: "头像修改失败"});
          return;
        }
        res.status(200).send({ status: "ok" ,message: "头像修改成功"});
      });
    });
  });
});
//修改个人信息
router.post("/set/userinfo",geetest, function (req, res) {
  var UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
  var SET = {
    display_name: req.body["display_name"],
    motto: req.body["aboutme"],
    sex: req.body["sex"],
    birthday: new Date(
      `2000-01-01 00:00:00`
    ),
  };
  DB.qww(UPDATE, SET, function (err, u) {
    if (err) {
      res.status(200).send({ status: "请再试一次" });
      return;
    }

    res.locals["display_name"] = req.body["display_name"];

    res.cookie(
        "token",
        I.GenerateJwt({
          userid: res.locals["userid"],
          email: res.locals["email"],
          username: res.locals["username"],

          display_name: res.locals["display_name"],
          avatar: res.locals["avatar"],
        }),
        { maxAge: 604800000 }
      );
      res.status(200).send({ status: "个人信息修成成功" });

  });
});
//修改个人信息
router.post("/set/username",geetest, function (req, res) {
  var UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
  var SET = {
    username: req.body["username"],
  };
  DB.qww(UPDATE, SET, function (err, u) {
    if (err) {
      res.status(200).send({ status: "请再试一次" });
      return;
    }

    res.locals["username"] = req.body["username"];

    res.cookie(
        "token",
        I.GenerateJwt({
          userid: res.locals["userid"],
          email: res.locals["email"],
          username: res.locals["username"],
          display_name: res.locals["display_name"],
          avatar: res.locals["avatar"],
        }),
        { maxAge: 604800000 }
      );
      res.status(200).send({ status: "用户名修成成功" });

  });
});
//修改密码：动作
router.post("/set/pw",geetest, function (req, res) {
  SQL = `SELECT password FROM ow_users WHERE id=? LIMIT 1`;
  id = res.locals.userid;

  DB.qww(SQL, id, function (err, USER) {
    if (err || USER.length == 0) {
      res.status(200).send({ status: "错误",message: "用户不存在" });
    }
    if (I.checkhash(req.body["oldpw"], USER[0]["password"]) == false) {
      res.status(200).send({ status: "错误" ,message: "旧密码错误"});
      return;
    }
    var newPW = I.hash(req.body["newpw"]);
    SET = { password: newPW };
    UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
    DB.qww(UPDATE, SET, function (err, u) {
      if (err) {
        res.status(200).send({ status: "请再试一次" });
        return;
      }
      res.status(200).send({ status: "ok",message: "密码修改成功" });
    });
  });
});

module.exports = router;
