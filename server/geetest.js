const express = require("express");

const app = express();
var querystring = require("querystring");
const crypto = require("crypto");
var axios = require("axios");

const CAPTCHA_ID = process.env.GEE_CAPTCHA_ID;
const CAPTCHA_KEY = process.env.GEE_CAPTCHA_KEY;
const API_SERVER = process.env.GEE_API_SERVER;
const API_URL = API_SERVER + "/validate" + "?captcha_id=" + CAPTCHA_ID;

app.use((req, res, next) => {
    var geetest = {};
    if (req.body.captcha) {
        geetest = JSON.parse(req.body.captcha);
    } else if (querystring.parse(req.url.split("?")[1]).captcha) {
        geetest = JSON.parse(querystring.parse(req.url.split("?")[1]).captcha);
    } else {
        if (req.method == "GET") {
            geetest = querystring.parse(req.url.split("?")[1]);
        } else {
            geetest = req.body;
        }
    }
    console.log(geetest);

    // 生成签名, 使用标准的hmac算法，使用用户当前完成验证的流水号lot_number作为原始消息message，使用客户验证私钥作为key
    // 采用sha256散列算法将message和key进行单向散列生成最终的 “sign_token” 签名
    // use lot_number + CAPTCHA_KEY, generate the signature
    // var sign_token = hmac_sha256_encode(geetest.lot_number, CAPTCHA_KEY);

    // 向极验转发前端数据 + “sign_token” 签名
    // send web parameter and “sign_token” to geetest server
    var datas = {
        lot_number: geetest.lot_number,
        captcha_output: geetest.captcha_output,
        pass_token: geetest.pass_token,
        gen_time: geetest.gen_time,
        sign_token: hmac_sha256_encode(geetest.lot_number, CAPTCHA_KEY),
    };

    // post request
    // 根据极验返回的用户验证状态, 网站主进行自己的业务逻辑
    // According to the user authentication status returned by the geetest, the website owner carries out his own business logic
    post_form(datas, API_URL)
        .then((result) => {
            if (result["result"] == "success") {
                //console.log('validate success');
                //res.send('success');
                next();
            } else {
                console.log("validate fail:" + result["reason"]);
                res.send({ code: 500, msg: "请完成验证码/" + result["reason"], message: "请完成验证码/" + result["reason"], status: "请完成验证码/" + result["reason"] });
            }
        })
        .catch((err) => {
            // 当请求Geetest服务接口出现异常，应放行通过，以免阻塞正常业务。
            // When the request geetest service interface is abnormal, it shall be released to avoid blocking normal business.
            console.log("Geetest server error:" + err);
            console.error("Geetest server error:" + err);
            next();
        });
});

// 生成签名
// Generate signature
function hmac_sha256_encode(value, key) {
    var hash = crypto
        .createHmac("sha256", key)
        .update(value, "utf8")
        .digest("hex");
    return hash;
}

// 发送post请求, 响应json数据如：{"result": "success", "reason": "", "captcha_args": {}}
// Send a post request and respond to JSON data, such as: {result ":" success "," reason ":" "," captcha_args ": {}}
async function post_form(datas, url) {
    var options = {
        url: url,
        method: "POST",
        params: datas,
        timeout: 5000,
    };

    var result = await axios(options);

    if (result.status != 200) {
        // geetest服务响应异常
        // geetest service response exception
        console.log("Geetest Response Error, StatusCode:" + result.status);
        throw new Error("Geetest Response Error");
    }
    return result.data;
}

module.exports = app;
