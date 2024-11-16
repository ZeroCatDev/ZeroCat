const configManager = require("../configManager");

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

//获取源代码数据
router.get("/:id/*", function (req, res) {
  var SQL = `SELECT source FROM ow_projects WHERE id=${req.params.id} LIMIT 1`;
  DB.query(SQL, function (err, PROJECT) {
    if (err) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
      return;
    }
    if (PROJECT.length == 0) {
      res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
      res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
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
    //console.log(JSON.parse(PROJECT[0].source));

    if (getValue(filename, JSON.parse(PROJECT[0].source)) != false) {
      filestr = decode(getValue(filename, JSON.parse(PROJECT[0].source)));
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
        res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
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
    res.status(200).send({ status: "0", msg: "请先登录" });
    return;
  }

  // 新作品
  //if (req.body.id == '0'){ var INSERT =`INSERT INTO ow_projects (authorid, title,source) VALUES (${res.locals.userid}, ?, ?)`; var SET = [req.body.title,req.body.data] DB.qww(INSERT, SET, function (err, newPython) { if (err || newPython.affectedRows==0) { res.status(200).send({status: "0", msg: "保存失败" }); return; } res.status(200).send({status: "ok", msg: "保存成功", 'newid': newPython['insertId']}) }); return; }
  console.log(req.body);
  console.log(encodeHtmlInJson(req.body));

  // 旧作品
  var UPDATE = `UPDATE ow_projects SET ? WHERE id=${req.params.id} AND authorid=${res.locals.userid} LIMIT 1`;
  var SET = {
    //        title:req.body.title,
    source: JSON.stringify(encodeHtmlInJson(req.body)),
    //        description:req.body.description
  };
  DB.qww(UPDATE, SET, function (err, u) {
    if (err) {
      res.status(200).send({ status: "0", msg: "保存失败" });
      return;
    }

    res.status(200).send({ status: "ok", msg: "保存成功" });
  });
});

module.exports = router;
