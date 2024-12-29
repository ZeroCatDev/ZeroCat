import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

//个人中心
import { Router } from "express";
var router = Router();
import { rename, createReadStream } from "fs";
import { createHash } from "crypto";
//功能函数集
import { msg_fail, S3update, checkhash, hash as _hash,prisma } from "../utils/global.js";
//数据库
import { query, qww } from "../utils/database.js";
import geetestMiddleware from "../middleware/geetest.js";

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
  query(SQL, function (err, data) {
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
  query(SQL, function (err, data) {
    if (err) {
      res.status(200).send([]);
    } else {
      res.status(200).send(data);
    }
  });
});

// 弃用
//分享Scratch项目
router.post("/scratch/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='public' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});

// 弃用
//分享Scratch项目
router.post("/python/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='public' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});

//分享Scratch项目
router.post("/project/share", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='public' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "分享成功" });
  });
});
//简介
router.post("/scratch/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//简介
router.post("/python/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});
//简介
router.post("/project/setdescription", function (req, res) {
  var SET = { description: req.body["description"] };
  var SQL = `UPDATE ow_projects SET ? WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  qww(SQL, SET, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "设置成功" });
  });
});

//取消分享Scratch项目
router.post("/scratch/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='private' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});

//取消分享Scratch项目
router.post("/python/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='private' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});

//取消分享Scratch项目
router.post("/project/noshare", function (req, res) {
  var SQL = `UPDATE ow_projects SET state='private' WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(SQL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    res.status(200).send({ status: "success", msg: "取消分享成功" });
  });
});
//删除Scratch项目
router.post("/scratch/del", function (req, res) {
  var DEL = `DELETE FROM ow_projects WHERE id=${req.body["id"]} AND authorid=${res.locals.userid} LIMIT 1`;
  query(DEL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
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
  query(DEL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
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
  query(DEL, function (err, d) {
    if (err) {
      res.status(200).send(msg_fail);
      return;
    }

    if (d.affectedRows == 0) {
      res.status(200).send({ status: "failed", msg: "删除失败" });
      return;
    }

    res.status(200).send({ status: "success", msg: "删除成功" });
  });
});
router.post("/set/avatar", geetestMiddleware,async (req, res) => {
  if (!req.files?.file) {
    return res.status(200).send({ status: "文件上传失败" });
  }

  const file = req.files.file;
  const hash = createHash("md5");
  const chunks = createReadStream(file.path);
  chunks.on("data", (chunk) => hash.update(chunk));
  chunks.on("end", async () => {
    const hashValue = hash.digest("hex");
    await S3update(`user/${hashValue}`, file.path);
    await prisma.ow_users.update({
      where: { id: res.locals.userid },
      data: { images: hashValue },
    });
    res.status(200).send({ status: "ok", message: "头像修改成功" });
  });
});
//修改个人信息
router.post("/set/userinfo", geetestMiddleware, function (req, res) {
  var UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
  var SET = {
    display_name: req.body["display_name"],
    motto: req.body["aboutme"],
    sex: req.body["sex"],
    birthday: new Date(`2000-01-01 00:00:00`),
  };
  qww(UPDATE, SET, async function (err, u) {
    if (err) {
      res.status(200).send({ status: "请再试一次" });
      return;
    }

    res.locals["display_name"] = req.body["display_name"];

    // res.cookie( "token", await I.generateJwt({ userid: res.locals["userid"], email: res.locals["email"], username: res.locals["username"], display_name: res.locals["display_name"], avatar: res.locals["avatar"], }), { maxAge: 604800000 } );
    res.status(200).send({ status: "个人信息修成成功" });
  });
});
//修改个人信息
router.post("/set/username", geetestMiddleware, function (req, res) {
  var UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
  var SET = {
    username: req.body.username,
  };
  qww(UPDATE, SET, async function (err, u) {
    if (err) {
      res.status(200).send({ status: "请再试一次" });
      return;
    }

    res.locals["username"] = req.body["username"];

    // res.cookie( "token", await I.generateJwt({ userid: res.locals["userid"], email: res.locals["email"], username: res.locals["username"], display_name: res.locals["display_name"], avatar: res.locals["avatar"], }), { maxAge: 604800000 } );
    res.status(200).send({ status: "用户名修成成功" });
  });
});
//修改密码：动作
router.post("/set/pw", geetestMiddleware, function (req, res) {
  SQL = `SELECT password FROM ow_users WHERE id=? LIMIT 1`;
  id = res.locals.userid;

  qww(SQL, id, function (err, USER) {
    if (err || USER.length == 0) {
      res.status(200).send({ status: "错误", message: "用户不存在" });
    }
    if (checkhash(req.body["oldpw"], USER[0]["password"]) == false) {
      res.status(200).send({ status: "错误", message: "旧密码错误" });
      return;
    }
    var newPW = _hash(req.body["newpw"]);
    SET = { password: newPW };
    UPDATE = `UPDATE ow_users SET ? WHERE id=${res.locals.userid} LIMIT 1`;
    qww(UPDATE, SET, function (err, u) {
      if (err) {
        res.status(200).send({ status: "请再试一次" });
        return;
      }
      res.status(200).send({ status: "ok", message: "密码修改成功" });
    });
  });
});

export default router;
