//搜索
var express = require("express");
var router = express.Router();
var fs = require("fs");

//功能函数集
var I = require("./lib/global.js");
//数据库
var DB = require("./lib/database.js");

//搜索：Scratch项目列表：数据//只搜索标题
router.get("/", function (req, res) {
  var search = {
    userid: req.query.search_userid,
    type: req.query.search_type,
    title: req.query.search_title,
    src: req.query.search_src,
    description: req.query.search_description,
    orderby: req.query.search_orderby,
    curr: Number(req.query.curr),
    limit: Number(req.query.limit),

  };
  console.log(search);
  var andid = "";
  if (!["scratch", "python"].includes(search.type)) {
    res.send("注入");
  }

  if (search.userid != "") {
    andid = `AND (authorid = ${Number(search.userid)} )`;
  }
  orderby = search.orderby.split('_')[0]
  if (!["view", "time","random","id"].includes(orderby)) {
    res.send("注入1");
  }
  ordersc = search.orderby.split('_')[1]
  if (!["up", "down","random"].includes(ordersc)) {
    res.send("注入2");
  }
  orderbylist={view:'s.view_count',time:'s.time',id:'s.id',random:'RAND()'}
  orderby = orderbylist[orderby]
  ordersclist={up:'desc',down:'asc',random:''}
  ordersc = ordersclist[ordersc]
  //var SQL = `SELECT id, title FROM ${tabelName} WHERE state>0 AND (${searchinfo} LIKE ?) LIMIT 12`;
  var SQL = `SELECT s.id, s.title, s.state, s.authorid, s.description, s.view_count, u.display_name, u.motto
    FROM (
        SELECT id, title, state, authorid, description, view_count,time
        FROM ${search.type}
        WHERE state > 0 AND (title LIKE ? ) AND (src like ? ) AND (description like ? ) ${andid}
    ) s
    JOIN ow_Users u ON s.authorid = u.id
ORDER BY ${orderby} ${ordersc} LIMIT ${
  (search.curr - 1) * search.limit
}, ${search.limit}`;
  var QUERY = [
    `%${search.title}%`,
    `%${search.src}%`,
    `%${search.description}%`,
  ];
  
  DB.qww(SQL, QUERY, function (err, data) {

    if (err) {
      res.status(200).send([err]);
    } else {
      searchresult=data
      console.log(searchresult)
      var SQL = `SELECT COUNT(s.id) as totalCount
      FROM (
          SELECT id, title, state, authorid, description, view_count, time
          FROM ${search.type}
          WHERE state > 0 AND (title LIKE ? ) AND (src like ? ) AND (description like ? ) ${andid}
      ) s
      JOIN ow_Users u ON s.authorid = u.id
  
      `;
  var QUERY = [
    `%${search.title}%`,
    `%${search.src}%`,
    `%${search.description}%`,
  ];
  DB.qww(SQL, QUERY, function (err, totalCount) {
    if (err) {
      res.status(200).send([err]);
    } else {
      console.log(totalCount)
      res.status(200).send({data:data,totalCount:totalCount});
    }
  });
      
    }
  });
});

//搜索：Scratch项目列表：数据//只搜索标题
router.post("/user", function (req, res) {
  if (!req.body.txt) {
    res.status(200).send([]);
    return;
  }
  var SQL = `SELECT id, display_name, motto,images FROM ow_Users WHERE display_name LIKE ?`;
  var WHERE = [`%${req.body.txt}%`];
  DB.qww(SQL, WHERE, function (err, data) {
    if (err) {
      res.status(200).send([]);
    } else {
      res.status(200).send(data);
    }
  });
});
module.exports = router;
