//个人中心
var express = require('express');
var router = express.Router();
var fs = require('fs');

//功能函数集
var I = require('./lib/fuck.js');
//数据库
var DB = require("./lib/database.js");


//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.get('/getUserScratchProjects', function (req, res) {
    var curr = parseInt(req.query.curr);     //当前要显示的页码
    var limit = parseInt(req.query.limit);   //每页显示的作品数
    var userid = parseInt(req.query.userid);     //
    var SQL = `SELECT id, title,state,view_count,description FROM scratch WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});

//显示Scratch项目列表：数据，{curr:obj.curr, limit:obj.limit,state:state}
router.get('/getUserPythonProjects', function (req, res) {
    var curr = parseInt(req.query.curr);     //当前要显示的页码
    var limit = parseInt(req.query.limit);   //每页显示的作品数
    var userid = parseInt(req.query.userid);     //
    var SQL = `SELECT id, title,state,view_count,description FROM python WHERE authorid=${userid} AND state>0 ORDER BY view_count DESC LIMIT ${(curr-1)*limit}, ${limit}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send([]);
        } else {
            res.status(200).send(data);
        }
    });
});
router.get('/play', function (req, res) {
    var deviceAgent = req.headers["user-agent"].toLowerCase();
    var agentID = deviceAgent.match(/(iphone|ipad|android|windows phone)/);
    res.locals['is_mobile'] = false;
    if(agentID){
        res.locals['is_mobile'] = true;//请求来自手机、pad等移动端
    }

    //浏览数+1
    var SQL = `UPDATE scratch SET view_count=view_count+1 WHERE id=${req.query.id} LIMIT 1`;
    DB.query(SQL, function(err,U){
        if (err|| U.affectedRows==0) {
            res.locals.tip = {'opt': 'flash', 'msg':'项目不存在或未发布'};
            res.render('ejs/404.ejs');
            return;
        }
        
       
            SQL = `SELECT user.nickname,scratch.motto,`+
          
            ` FROM user `+
            ` LEFT JOIN user ON (user.nickname=user.neme) `+
            ` WHERE user.id=${req.query.id}`;
         
    
        DB.query(SQL, function (err, SCRATCH) {
            if (err|| SCRATCH.length==0) {
                res.locals.tip = {'opt': 'flash', 'msg':'项目不存在或未发布'};
                res.render('ejs/404.ejs');
                return;
            }
    
            res.locals['is_author'] = (SCRATCH[0].authorid==req.session.userid)?true:false;
            res.locals['project'] = SCRATCH[0];
            res.render('ejs/scratch/scratch_play.ejs');
        });
    });
});

router.get('/usertx', function (req, res) {
    

    //浏览数+1
    SQL = `SELECT images FROM user WHERE id = ${req.query.id};`;
  
      DB.query(SQL, function (err, USER) {
        if (err || USER.length == 0) {
          res.locals.tip = { opt: "flash", msg: "用户不存在" };
          res.render("ejs/404.ejs");
          return;
        }

  
        res.redirect(302, process.env.qiniuurl+'/user/'+USER[0].images+'.png');
      });
});

router.get("/getuserinfo", function (req, res) {
    //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
    
      SQL = `SELECT id,nickname, motto FROM user WHERE id = ${req.query.id};`;
  
      DB.query(SQL, function (err, USER) {
        if (err || USER.length == 0) {
          res.locals.tip = { opt: "flash", msg: "用户不存在" };
          res.render("ejs/404.ejs");
          return;
        }
        res.status(200).send({status: 'ok',info:USER[0]});
  
      });
    });

module.exports = router;
