//系统平台部分
var express = require('express');
var router = express.Router();
var fs = require('fs');
//功能函数集
var I = require('./lib/fuck.js');
//数据库
var DB = require("./lib/database.js");

router.all('*', function(req, res, next) {
    if (!res.locals.login){
        res.render('_index/_login_register.ejs');
        return;
    }

    next();
});

router.get('/', function (req, res) {    
    res.render('views/ads/index.ejs');
});

// 返回一个机构的头图
router.get('/data', function (req, res) {
    var SQL = `SELECT count(id) AS c FROM ads`;
    DB.query(SQL,function (err, count){
        if (err || count.length==0 || count[0]['c']==0) {
            res.status(200).send({'count':0,'data':[]});
            return;
        }

        //获取当前数据集合
        var page = parseInt(req.query['page']);
        var limit = parseInt(req.query['limit']);
        SQL = `SELECT * FROM ads ORDER BY state DESC, i ASC LIMIT ${(page-1)*limit}, ${limit}`;
        DB.query(SQL, function (err, data) {
            if (err) {
                res.status(200).send({'count':0,'data':[]});
            } else {
                res.status(200).send({'count':count[0]['c'],'data':data});
            }
        });
    });
});
// 添加一条头图
router.post('/add', function (req, res) {    
    var SQL = `INSERT INTO ads (title, i) VALUES ('请设置头图的具体内容', 99); `;
    DB.query(SQL, function(err,d){
        if (err || d.affectedRows==0){
            res.status(200).send({'status':'x', msg:'数据错误，请再试一次'});
            return;
        }

        // 复制一个图片模板
        // defaultFile = `./data/ads/default.png`;
        // adsFile = `./data/ads/${d.insertId}`;
        // fs.copyFile(defaultFile, adsFile, function (err) { if(err){}});

        res.status(200).send({'status':'ok', msg:'操作成功'});
    });
});

// 删除一条头图
router.post('/del', function (req, res) {
    var SQL = `DELETE FROM ads WHERE id=${req.body.id}`;
    DB.query(SQL, function(err,d){
        if (err || d.affectedRows==0){
            res.status(200).send({'status':'x', msg:'数据错误，请再试一次'});
            return;
        }

        // 删除对应的图片
        fs.unlink(`./data/ads/${req.body.id}`, function (err) { if(err){} });

        res.status(200).send({'status':'ok', msg:'操作成功'});
    })
});

// 修改头图状态：最多能显示6条头图
router.post('/setState', function (req, res) {
    if (req.body.s == 0){//取消显示
        SQL = `UPDATE ads SET state=0 WHERE id=${req.body.id}`;
        DB.query(SQL, function(err,d){
            if (err || d.affectedRows==0){
                res.status(200).send({'status':'x', msg:'数据错误，请再试一次'});
                return;
            }
    
            res.status(200).send({'status':'ok', msg:'操作成功'});
        })
    } else {//显示
        var SQL = `SELECT count(id) AS c FROM ads WHERE state=1`;
        DB.query(SQL, function(err,d){
            if (err){
                res.status(200).send({'status':'x', msg:'数据错误，请再试一次'});
                return;
            }
            
            if(d[0].c >= 6){
                res.status(200).send({'status':'x', msg:'此头图位一次最多只能显示6条头图'});
                return;
            }
       
            SQL = `UPDATE ads SET state=1 WHERE id=${req.body.id}`;
            DB.query(SQL, function(err,d){
                if (err || d.affectedRows==0){
                    res.status(200).send({'status':'x', msg:'数据错误，请再试一次'});
                    return;
                }
        
                res.status(200).send({'status':'ok', msg:'操作成功'});
            })
        })
    }
});

// 修改头图信息
router.post('/setValue', function (req, res) {
    var UPDATE = `UPDATE ads SET ${req.body.f}=? WHERE id=${ req.body.id} LIMIT 1`;
    var SET = [req.body.v]
    DB.qww(UPDATE, SET, function (err, d) {
        if (err) {
            res.status(200).send( { 'status': 'x', 'msg': '再试一次' });
            return;
        }

        res.status(200).send( {'status': 'ok', 'msg': '操作成功' });
    });
});
//修改头图图片：功能
router.post('/setImg', function (req, res) {
    if (!req['files']['file']) {
        res.status(200).send({status: 'x',msg: '文件上传失败,请再试一次'});
        return;
    }
    
    //保存文件到正确位置
    tmppath = req['files']['file']['path'];
    newpath = `${global.dirname}/data/ads/${req.body.id}`;
    fs.rename(tmppath, newpath,function (err) {
        if(err){
            res.status(200).send({status: 'x',msg: '文件上传失败,请再试一次'});
            return;
        }
        
        var SQL = `UPDATE ads SET img=1 WHERE id=${req.body.id}`
        DB.query(SQL, function(err, d){
            if(err){
                res.status(200).send({status: 'x',msg: '文件上传失败,请再试一次'});
                return; 
            }

            res.status(200).send({ status: 'ok', msg: "操作成功"});
        });
    });
});

module.exports = router;