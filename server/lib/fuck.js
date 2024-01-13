//公用小函数库
const crypto = require("crypto");
var base64url = require("base64url");
const { PasswordHash } = require("phpass");
const jwt = require("jsonwebtoken"); // 首先确保安装了jsonwebtoken库

var fs = require("fs");

//七牛云有关
var qiniu = require("qiniu");
var config = new qiniu.conf.Config();
var accessKey = process.env.qiniuaccessKey;
var secretKey = process.env.qiniusecretKey;
var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

exports.qiniuupdate = function qiniuupdate(name, file) {
  var options = {
    scope: process.env.qiniubucket,
    expires: 7200,
  };
  var putPolicy = new qiniu.rs.PutPolicy(options);
  var uploadToken = putPolicy.uploadToken(mac);
  var localFile = file;
  var formUploader = new qiniu.form_up.FormUploader(config);
  var putExtra = new qiniu.form_up.PutExtra();
  var key = name;
  // 文件上传
  formUploader.putFile(
    uploadToken,
    key,
    localFile,
    putExtra,
    function (respErr, respBody, respInfo) {
      if (respErr) {
        throw respErr;
      }
      if (respInfo.statusCode == 200) {
        console.log(respBody);
        //   fs.unlink(file, function (err) { if (err) { console.log("fe"); } });
      } else {
        console.log(respInfo.statusCode);
        console.log(respBody);
      }
    }
  );
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
  //  jwt_h = "eyJhbGciOiJIUzI1NiJ9";

  //  jwt_p = base64url(data);
  //  var crypto = require("crypto");
  //  var jwt_s = jwt_h + "." + jwt_p;
  //  console.log(jwt_s);
  //  var jwt_v = base64url(
  //    crypto.createHmac("SHA256", "test").update(jwt_s).digest("bytes")
  //  );

  //  jwt = jwt_s + "." + jwt_v;
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
    , { expiresIn: '72h' });
  return token;
};

exports.hashpw = function (data) {
  var hashok = new PasswordHash().hashPassword(data);
  return hashok;
};
