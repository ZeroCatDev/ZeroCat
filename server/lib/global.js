//公用小函数库
const crypto = require("crypto");
const jwt = require("jsonwebtoken"); // 首先确保安装了jsonwebtoken库
const { PasswordHash } = require('phpass');
const pwdHash = new PasswordHash();

var fs = require("fs");

//prisma client
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
exports.prisma =prisma;


const { S3Client, PutObjectCommand } =require('@aws-sdk/client-s3');
// Create an S3 client
const s3 = new S3Client({
  endpoint: global.config.s3.endpoint,
  region: global.config.s3.region,
  credentials: {
    accessKeyId: global.config.s3.AWS_ACCESS_KEY_ID,
    secretAccessKey: global.config.s3.AWS_SECRET_ACCESS_KEY,
  }
});


exports.S3update = function ow(name, file) {
  console.log(name);
try {
  s3.send(new PutObjectCommand({
    Bucket: global.config.s3.bucket,
    Key: name,
    Body: fs.readFileSync(file)
  })).catch((err) => {
    console.log(err);
  }).then((data) => {
    console.log(data);
    console.log(`用户 ${res.locals.email} 成功上传了文件 ${global.config.s3.bucket}/${name}`);

  })

} catch (err) {
  console.log("S3 update Error: ", err);
}

};

//以md5的格式创建一个哈希值
exports.md5 = function md5(data) {
  let hash = crypto.createHash("md5");
  return hash.update(data).digest("base64");
};
exports.hash = function hash(data) {
  return pwdHash.hashPassword(data);
};

exports.checkhash = function checkhash(pwd,storeHash) {
  return pwdHash.checkPassword(pwd,storeHash);
};
//检查用户密码格式
exports.userpwTest = function (pw) {
  var reg = /^(?:\d+|[a-zA-Z]+|[!@#$%^&*]+){6,16}$/;
  return reg["test"](pw);
};

exports.emailTest = function (No) {
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
  var password = "";
  for (var i = 0; i < len; i++) {
    password += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  password = password + "@Aa1";
  return password;
};

exports.jwt = function (data) {
  var token = jwt.sign(data, "test");

  console.log(token);
  return token;
};
exports.GenerateJwt = function (json) {
  token = jwt.sign(
    json,
    global.config.security.jwttoken
  );
  return token;
};
exports.isJSON = function (str) {
  if (typeof str == 'string') {
      try {
          var obj=JSON.parse(str);
          if(typeof obj == 'object' && obj ){
              return true;
          }else{
              return false;
          }

      } catch(e) {
          console.log('error：'+str+'!!!'+e);
          return false;
      }
  }
}
