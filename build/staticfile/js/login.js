//图片滑动验证
//function doGeeTest(GT_CallBack){
//    $.ajax({
//        'url': ('/user/gt_slide?t=' + new Date().getTime()),
//        'type': 'get',
//        'dataType': 'json',
//        'success': function (resD) {
//            initGeetest({
//                'gt': resD['gt'],
//                'challenge': resD['challenge'],
//                'offline': !resD['success'],
//                'new_captcha': resD['new_captcha'],
//                'product': 'bind',
//                'width': '300px'
//            }, GT_CallBack);
//        }
//    });
//}
//var _GT_Tag;
//var GT_CallBack = function (GT_Tag) {
//    _GT_Tag = GT_Tag
//    GT_Tag['appendTo']('#captcha'),
//    GT_Tag['onReady'](function () { $('#wait')['hide'](); });
//};
//doGeeTest(GT_CallBack);

//定时器:设置按钮文本
//var s = 60;
//function Timer(tag) {
//    if (0 == s) {
//        s = 60
//        $(tag).attr('disabled', !1);
//        $(tag).text('获取验证码');
//    } else {
//        s--;
//        $(tag).attr('disabled', !0);
//        $(tag).text('重新发送(' + s + ')');
//        setTimeout(function () { Timer(tag); }, 1000);
//    }
//};
//获取验证码
//function getYZM(obj) {
//	//mdui.snackbar({buttonText: '关闭', message: '开源版本，无短信接口'});
//    mdui.snackbar({buttonText: '关闭', message: '错误'});
//};

function onloadCallback() {
grecaptcha.render("recaptcha-div-login", {
    sitekey: "6Lc7viEnAAAAAI02ys4HiujqHx05u0yB9tYKnsy6",
  });
  grecaptcha.render("recaptcha-div-signup", {
    sitekey: "6Lc7viEnAAAAAI02ys4HiujqHx05u0yB9tYKnsy6",
  });grecaptcha.render("recaptcha-div-findpw", {
    sitekey: "6Lc7viEnAAAAAI02ys4HiujqHx05u0yB9tYKnsy6",
  });
}

//找回密码
function getPW() {
  var un = $("#getPW_username").val();
  if (!emailTest(un)) {
    $("#getPW_username").focus();
    mdui.snackbar({ buttonText: "关闭", message: "邮箱格式不正确" });
    return;
  }
  var re = grecaptcha.getResponse("2");
  AjaxFn("/user/repw", { un: un, re: re }, function (res) {
    if ("OK" == res.status) {
      window.location.reload();
    } else {
      mdui.snackbar(res.status);
    }
  });
  mdui.snackbar({ buttonText: "关闭", message: "请查看邮箱" });
}

//注册界面，点击注册按钮
function register() {
  if (!document.getElementById("privacy-chick").checked) {
    mdui.snackbar({
      buttonText: "关闭",
      message: "请阅读并选择是否同意隐私策略",
    });
    return;
  }
  if (!document.getElementById("shuju-chick").checked) {
    mdui.snackbar({
      buttonText: "关闭",
      message: "请阅读并选择是否同意数据跨境传输策略",
    });
    return;
  }
  if (!document.getElementById("xiugai-chick").checked) {
    mdui.snackbar({
      buttonText: "关闭",
      message: "请阅读并选择是否同意用户协议",
    });
    return;
  }
  if (!document.getElementById("zhunze-chick").checked) {
    mdui.snackbar({
      buttonText: "关闭",
      message: "请阅读并选择是否同意社区行为准则",
    });
    return;
  }
  var un = $("#reg_username").val();
  if (!usernameTest(un)) {
    $("#reg_username").focus();
    mdui.snackbar({ buttonText: "关闭", message: "账号格式：字母+数字" });
    return;
  }
  //if (phoneTest(un)) {$("#reg_username").focus();mdui.snackbar({buttonText: '关闭', message: '手机号不能直接用于注册账号'});return;}

  var pw = $("#reg_password").val();
  //if (!userpwdTest(pw)) {$("#reg_password").focus();mdui.snackbar({buttonText: '关闭', message: '密码格式:6~16长度,数字+字母+!@#$%^&*'});return;}

  var re = grecaptcha.getResponse("1");
  AjaxFn("/user/register", { un: un, pw: pw, re: re }, function (res) {
    if ("OK" == res.status) {
      window.location.reload();
    } else {
      mdui.snackbar(res.status);
    }
  });
}

//登录界面，点击登录按钮
function login() {
  var un = $("#username").val();
  if (!emailTest(un)) {
    $("#username").focus();
    mdui.snackbar({
      message: "请填写正确的账号：字母+数字",
      type: "error",
      showCloseButton: true,
    });
    return;
  }

  var pw = $("#password").val();
  if (!userpwdTest(pw)) {
    $("#password").focus();
    mdui.snackbar({ buttonText: "关闭", message: "密码不正确" });
    return;
  }
  var re = grecaptcha.getResponse("0");
  AjaxFn("/user/login", { un: un, pw: pw, re: re }, function (res) {
    if ("OK" == res.status) {
      window.location.reload();
    } else {
      mdui.snackbar(res.status);
    }
  });
}
function getQueryString(name) {
  const url_string = window.location.href;
  const url = new URL(url_string);
  return url.searchParams.get(name);
}
//登录界面，点击登录按钮
function torepw() {
  var token = getQueryString("token");

  var pw = $("#password").val();
  if (!userpwdTest(pw)) {
    $("#password").focus();
    mdui.snackbar({ buttonText: "关闭", message: "密码格式不正确" });
    return;
  }
  var re = grecaptcha.getResponse();
  AjaxFn("/user/torepw", { token: token, pw: pw, re: re }, function (res) {
    if ("OK" == res.status) {
      window.location.reload();
    } else {
      mdui.snackbar(res.status);
    }
  });
}
function switchPage(goPage) {
  $(`#${goPage}`).show().siblings().hide();
}
