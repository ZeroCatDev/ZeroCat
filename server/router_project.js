var express = require('express');
var router = express.Router();

var DB = require("./lib/database.js"); // 数据库


router.all('*', function (req, res, next) {
	next();
});
//router.get('/', function (req, res) {})

//保存作品：标题
router.post("/saveProjcetTitle", function (req, res) {
    if (!res.locals.login) {
      res.status(404);
      return;
    }
    var UPDATE = `UPDATE ow_projects SET title=? WHERE id=${String(Number(req.body.id))} AND authorid=${res.locals.userid} LIMIT 1`;
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
    var SQL = `UPDATE ow_projects SET ? WHERE id=${String(Number(req.body.id))} AND authorid=${res.locals.userid} LIMIT 1`;
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
    var SQL = `UPDATE ow_projects SET ? WHERE id=${String(Number(req.body.id))} AND authorid=${res.locals.userid} LIMIT 1`;
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
    var SQL = `UPDATE ow_projects SET state=1 WHERE id=${String(Number(req.body["id"]))} AND authorid=${res.locals.userid} LIMIT 1`;
    DB.query(SQL, function (err, d) {
      if (err) {
        res.status(200).send(I.msg_fail);
        return;
      }

      res.status(200).send({ status: "success", msg: "分享成功" });
    });
  });
module.exports = router;