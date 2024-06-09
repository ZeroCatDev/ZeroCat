// 连接MySQL
var mysql = require('mysql');
var pool = mysql.createPool({
     host: process.env.mysqlhost,
     port: process.env.mysqlport,
     user: process.env.mysqluser,
     password: process.env.mysqlpassword,
     database: process.env.mysqldatabase,
     //debug: true
    });


//防止注入：'SELECT * FROM ow_Users WHERE ?', WHERE
exports.qww = function query_with_w(SQL, W, callback) {
    pool.getConnection(function (err, connection) {
        //console.log(err)
        if (err) return callback(err,'');

        // Use the connection
        connection.query(SQL, W, function (err, rows) {
            callback(err, rows);
            connection.release();//释放链接
            console.log(SQL)
        });
    });
}

//正常操作
exports.query = function query(SQL, callback) {
    pool.getConnection(function (err, connection) {
        //console.log(err)
        if (err) return callback(err,'');
        
        // Use the connection
        connection.query(SQL, function (err, rows) {
            callback(err, rows);
            connection.release();//释放链接
            console.log(SQL)
        });
    });
}

exports.mysql = mysql;