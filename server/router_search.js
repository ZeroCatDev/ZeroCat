//搜索
var express = require("express");
var router = express.Router();
var fs = require("fs");

//功能函数集
var I = require("./lib/global.js");
//数据库
var DB = require("./lib/database.js");
const { join } = require("path");

//搜索：Scratch项目列表：数据//只搜索标题
router.get("/", async function (req, res) {
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
  //console.log(search);


  var andid = "";
  if (!["scratch", "python",''].includes(search.type)) {
    res.send("注入");
  }

  if (search.userid != "") {
    andid = `AND (authorid = ${Number(search.userid)} )`;
  }
  orderby = search.orderby.split("_")[0];
  if (!["view", "time", "random", "id"].includes(orderby)) {
    res.send("注入1");
  }
  ordersc = search.orderby.split("_")[1];
  if (!["up", "down"].includes(ordersc)) {
    res.send("注入2");
  }
  orderbylist = {
    view: "view_count",
    time: "time",
    id: "id",
  };
  var orderby = orderbylist[orderby];
  ordersclist = { up: "desc", down: "asc"};
  ordersc = ordersclist[ordersc];
//  console.log(ordersc);
  var projectresult = await I.prisma.ow_projects.findMany({
    orderBy: [orderby === 'view_count' ? { view_count:ordersc } : orderby === 'time' ? { time:ordersc } : orderby === 'id' ? { id:ordersc } : { }],
    where: { title:{contains: search.title},src:{contains: search.src} ,description:{contains: search.description},type:{contains: search.type} },
    select: {
      id: true,
      type: true,
      title: true,
      state: true,
      authorid: true,
      description: true,
      view_count: true,
      time: true,
    },
    skip: (search.curr - 1) * search.limit,
    take: search.limit,
  });
  var projectcount = await I.prisma.ow_projects.count({
    where: { title:{contains: search.title},src:{contains: search.src} ,description:{contains: search.description},type:{contains: search.type} },
  });
 // console.log(projectcount);
  const authorIds = new Set(projectresult.map((item) => item.authorid));
 // console.log(authorIds); // 输出: Set(2) { '0', '1' }
  const authorIdTuple = [...authorIds];
  //console.log(authorIdTuple); // 输出: [0, 1]
  var userresult = await I.prisma.ow_users.findMany({

    where: { id: { in: authorIdTuple } },
    select: {
      id: true,
      username: true,
      display_name: true,
      motto: true,
      images: true,
    },

  });
 // console.log(userresult); // 输出: [0, 1]

  //var SQL = `SELECT id, title FROM ${tabelName} WHERE state>0 AND (${searchinfo} LIKE ?) LIMIT 12`;
  //var SQL = `SELECT s.id, s.title, s.state, s.authorid, s.description, s.view_count, u.display_name, u.motto,u.images FROM ( SELECT id, title, state, authorid, description, view_count,time FROM ${search.type} WHERE state > 0 AND (title LIKE ? ) AND (src like ? ) AND (description like ? ) ${andid} ) s JOIN ow_users u ON s.authorid = u.id ORDER BY ${orderby} ${ordersc} LIMIT ${(search.curr - 1) * search.limit}, ${ search.limit }`; var QUERY = [ `%${search.title}%`, `%${search.src}%`, `%${search.description}%`, ];



          res.status(200).send({
            data: projectresult,
            user: userresult,
            totalCount: [{"totalCount":projectcount}],
          });

});

//搜索：Scratch项目列表：数据//只搜索标题
router.post("/user", function (req, res) {
  if (!req.body.txt) {
    res.status(200).send([]);
    return;
  }
  var SQL = `SELECT id, display_name, motto,images FROM ow_users WHERE display_name LIKE ?`;
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
