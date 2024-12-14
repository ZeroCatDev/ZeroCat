import logger from "./logger.js";
// 连接MySQL
import mysql, { createPool } from "mysql";
var pool = createPool(process.env.DATABASE_URL);

export const qww = function query_with_w(SQL, W, callback) {
  pool.getConnection(function (err, connection) {
    //logger.debug(err)
    if (err) return callback(err, "");

    // Use the connection
    connection.query(SQL, W, function (err, rows) {
      callback(err, rows);
      connection.release(); //释放链接
      logger.debug(SQL);
    });
  });
};

//正常操作
export function query(SQL, callback) {
  pool.getConnection(function (err, connection) {
    //logger.debug(err)
    if (err) return callback(err, "");

    // Use the connection
    connection.query(SQL, function (err, rows) {
      callback(err, rows);
      connection.release(); //释放链接
      logger.debug(SQL);
    });
  });
}

export default mysql;
