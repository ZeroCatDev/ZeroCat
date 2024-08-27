var express = require('express');
var router = express.Router();

var DB = require("./lib/database.js"); // 数据库


router.all('*', function (req, res, next) {
	next();
});
//router.get('/', function (req, res) {})

//首页
router.get("/", function (req, res) {


        res.render("python/python_projects.ejs");


  });
//首页
router.get("/next", function (req, res) {


    res.render("python/next_python_play.ejs");


});
  router.get("/pythoncount", function (req, res) {
    //获取已分享的作品总数：1:普通作品，2：推荐的优秀作品
    var SQL =
      `SELECT ` +
      ` (SELECT count(id) FROM ow_projects WHERE state='public' ) AS python_count `;
    DB.query(SQL, function (err, data) {
      if (err) {
        // console.error('数据库操作出错：');
        res.locals.python_count = 0;
      } else {
        res.locals.python_count = data[0].python_count;
      }
      res.status(200).send(data[0]);
    });
  });
//翻页：Python作品列表：数据
router.get("/view/getPythonProjects", function (req, res) {
    var curr = parseInt(req.query.curr); //当前要显示的页码
    var limit = parseInt(req.query.limit); //每页显示的作品数
    var type = "view_count";
    if (req.query.type == "new") {
      type = "time";
    }

    var SQL = `SELECT ow_projects.id, ow_projects.title, ow_projects.state,ow_projects.authorid, ow_projects.description,ow_projects.view_count,ow_users.display_name,ow_users.motto FROM ow_projects JOIN ow_users ON ow_projects.authorid = ow_users.id WHERE ow_projects.state='public' AND ow_projects.type='python' ORDER BY ow_projects.${type} DESC LIMIT ${
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

//搜索：Scratch项目列表：数据//只搜索标题
router.get("/view/seachPythonProjects", function (req, res) {
    if (!req.query.txt) {
      res.status(200).send([]);
      return;
    }
    var tabelName = "python";
    var searchinfo = "title";
    if (req.query.searchall == "true") {
      searchinfo = "src";
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
  });

//python项目展示界面
router.get('/play', function (req, res) {

            res.render('python/python_play.ejs');
        });


//python项目编辑界面：获取项目源代码
router.get('/edit', function (req, res) {
	res.render('python/python_edit.ejs');
})

// 从数据库获取作品
router.post('/getWork', function (req, res) {
    var projectid = 0;
    if (req.body.id && req.body.id>1){
        projectid = req.body.id;
    }

    if (projectid == 0 || projectid == 1){ // 默认作品
        //***当把该块注释后，则从数据库加载默认作品***
        //从指定文件加载默认作品：BEGIN==========================================
         var DefaultPython={
             "id":0,
             "title":"Python新项目",
             "state":0,
             "src":`import turtle\n\nt = turtle.Turtle()\nt.forward(100)\n\nprint ("Welcome to ZeroCat!")`
         };
         if (projectid == 1){
         	res.status(200).send({status:'ok',work:DefaultPython});
             return;
         }
        //从指定文件加载默认作品：END============================================
        //*/
        SQL = `SELECT * FROM ow_projects WHERE id=1`;//默认作品为1号作品
    } else {
        if (!res.locals.login){//未登录时，只能打开已发布的作品
            SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND state='public'`;
        }else {

                //作品编辑：能够打开一个作品的几种权限：
                //1、自己的作品；
                //2、开源的作品；
                SQL = `SELECT * FROM ow_projects WHERE id=${projectid} AND (authorid=${res.locals.userid} OR state='public')`;


        }
    }

    DB.query(SQL, function(err, WORK) {
        if (err||WORK.length==0) {
            res.status(200).send({status:'x', msg:"作品不存在或无权打开"});//需要前端内部处理
        } else {
			var UPDATE = `UPDATE ow_projects SET view_count=view_count+1 WHERE id=${projectid} LIMIT 1`;
			DB.query(UPDATE, function(err, s) { if (err) { } });

            if (WORK[0].id == 1) {
                WORK[0].id = 0; // 通知浏览器作品ID为0
            }
            res.status(200).send({status:'ok', work:WORK[0]});
        }
    });
});

// python 保存
router.post('/save', function (req, res) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

    // 新作品
	if (req.body.id == '0'){
		var INSERT =`INSERT INTO ow_projects (authorid, title,src) VALUES (${res.locals.userid}, ?, ?)`;
		var SET = [req.body.title,req.body.data]
		DB.qww(INSERT, SET, function (err, newPython) {
			if (err || newPython.affectedRows==0) {
				res.status(200).send({status: "x", msg: "保存失败" });
				return;
			}

			res.status(200).send({status: "ok", msg: "保存成功", 'newid': newPython['insertId']})
		});

		return;
	}

    // 旧作品
    var UPDATE =`UPDATE ow_projects SET ? WHERE id=${req.body.id} AND authorid=${res.locals.userid} LIMIT 1`;
    var SET = {
        title:req.body.title,
        src:req.body.data,
        description:req.body.description
    }
    DB.qww(UPDATE, SET, function (err, u) {
        if (err) {
            res.status(200).send({status: "x", msg: "保存失败" });
            return;
        }

        res.status(200).send({status: "ok", msg: "保存成功" })
    })
});

router.post('/publish', function (req, res) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

	var state = req.body.s=="0"? 1:0;
	var UPDATE = `UPDATE ow_projects SET state=${state} WHERE id=${req.body.id} AND authorid=${res.locals.userid} LIMIT 1`;
	DB.query(UPDATE, function (err, u) {
		if (err) {
			res.status(200).send({status: "x", msg: "操作失败！"});
			return;
		}

		res.status(200).send({status: "ok", msg: "操作成功"})
	})
})



// python 优秀作品
router.post('/YxLibrary_count', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM ow_projects WHERE state='public'`;
    DB.query(SQL, function (err, COUNT){
        if (err) {
            res.status(200).send({status:'ok', total: 0});
        } else {
            res.status(200).send({status:'ok', total: COUNT[0].c});

        }
    });
})
//显示Python项目列表：数据，流加载模式
router.post('/YxLibrary_data', function (req, res) {
    //获取当前数据集合：以被浏览次数降序排列，每次取16个
    var page = parseInt(req.body.page);
    SQL = `SELECT ow_projects.id, ow_projects.authorid, ow_projects.view_count, ow_projects.time, ow_projects.title, ow_projects.description, ow_users.display_name AS author_display_name FROM ow_projects `+
    ` LEFT JOIN ow_users ON ow_users.id=ow_projects.authorid `+
    ` WHERE ow_projects.state='public' ORDER BY ow_projects.view_count DESC LIMIT ${(page-1)*16},${16}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send({status:'ok', data:[]});
        } else {
            res.status(200).send({status:'ok', data:data});
        }
    });
});



router.all('*', function (req, res, next) {
    if (!res.locals.userid){
        res.status(200).send({status: "x", msg: "请先登录" });
        return;
    }

	next();
});

router.post('/MyLibrary_count', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM ow_projects WHERE authorid=${res.locals.userid}`;
    DB.query(SQL, function (err, COUNT){
        if (err) {
            res.status(200).send({status:'ok', total: 0});
        } else {
            res.status(200).send({status:'ok', total: COUNT[0].c});

        }
    });
})
router.post('/MyLibrary_data', function (req, res) {
    //获取当前数据集合：以被浏览次数降序排列，每次取16个
    var page = parseInt(req.body.page);
    SQL = `SELECT id, state, time, title FROM ow_projects WHERE authorid=${res.locals.userid} ORDER BY time DESC LIMIT ${(page-1)*16},${16}`;
    DB.query(SQL, function (err, data) {
        if (err) {
            res.status(200).send({status:'ok', data:[]});
        } else {
            res.status(200).send({status:'ok', data:data});
        }
    });
});


module.exports = router;