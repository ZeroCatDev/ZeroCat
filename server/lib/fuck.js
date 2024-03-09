//公用小函数库
const crypto = require("crypto");
const jwt = require("jsonwebtoken"); // 首先确保安装了jsonwebtoken库

var fs = require("fs");


const { S3Client, PutObjectCommand } =require('@aws-sdk/client-s3');

// Create an S3 client
//
// You must copy the endpoint from your B2 bucket details
// and set the region to match.
const s3 = new S3Client({
  endpoint: process.env.S3endpoint,
  region: process.env.S3region
});

// Create a bucket and upload something into it


exports.S3update = function S3update(name, file,username) {
  console.log(name);
try {
  s3.send(new PutObjectCommand({
    Bucket: process.env.S3bucket,
    Key: name,
    Body: fs.readFileSync(file)
  }));

  console.log(`用户 ${username} 成功上传了文件 ${process.env.S3bucket}/${name}`);
} catch (err) {
  console.log("S3 update Error: ", err);
}
  
};

//以md5的格式创建一个哈希值
exports.md5 = function md5(data) {
  let hash = crypto.createHash("md5");
  return hash.update(data).digest("base64");
};

//检查用户密码格式
exports.userpwTest = function (pw) {
  var reg = /^(?:\d+|[a-zA-Z]+|[!@#$%^&*]+){6,16}$/;
  return reg["test"](pw);
};

exports.usernameTest = function (No) {
  var reg = /^([a-zA-Z]|[0-9])(\w|\-)+@[a-zA-Z0-9]+\.([a-zA-Z]{2,4})$/;

  return reg["test"](No);
};
//检查手机号码是否正确
exports.phoneTest = function (No) {
  var reg = /^1[3456789]\d{9}$/;
  return reg["test"](No);
};

//常用数据结构
exports.msg_fail = { status: "fail", msg: "请再试一次19" };

exports.randomPassword = function randomPassword(len) {
  len = len || 12;
  len = len - 4;
  var $chars =
    "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"; /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
  var maxPos = $chars.length;
  var pwd = "";
  for (var i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  pwd = pwd + "@Aa1";
  return pwd;
};

exports.jwt = function (data) {
  var token = jwt.sign(data, "test");

  console.log(token);
  return token;
};
exports.GenerateJwt = function (id, email, nickname) {
  token = jwt.sign(
    {
      userid: id,
      username: email,
      nickname: nickname,
    },
    process.env.jwttoken
  );
  return token;
};
