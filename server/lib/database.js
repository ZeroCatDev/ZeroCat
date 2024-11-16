// 连接MySQL
import mysql, { createPool } from "mysql";
var pool = createPool(process.env.DATABASE_URL);

export const qww = function query_with_w(SQL, W, callback) {
  pool.getConnection(function (err, connection) {
    //console.log(err)
    if (err) return callback(err, "");

    // Use the connection
    connection.query(SQL, W, function (err, rows) {
      callback(err, rows);
      connection.release(); //释放链接
      console.log(SQL);
    });
  });
};

//正常操作
export function query(SQL, callback) {
  pool.getConnection(function (err, connection) {
    //console.log(err)
    if (err) return callback(err, "");

    // Use the connection
    connection.query(SQL, function (err, rows) {
      callback(err, rows);
      connection.release(); //释放链接
      console.log(SQL);
    });
  });
}

const _mysql = mysql;
export { _mysql as mysql };
