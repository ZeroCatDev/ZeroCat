var phoneTest = function(No) {
    var reg = /^1[3456789]\d{9}$/;
    return reg['test'](No);
};
var usernameTest = function(pw) {
    var reg = /^([a-zA-Z]|[0-9])(\w|\-)+@[a-zA-Z0-9]+\.([a-zA-Z]{2,4})$/;
    return reg['test'](pw);
};
var userpwdTest = function(pw) {
    var reg = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=])(?=\S+$).{8,16}$/;
    return reg['test'](pw);
};
var spaceTest = function(str) {
    var reg = /^\s*$/;
    return reg['test'](str);
};
var emailTest = function(EMail) {
    var reg = /^[A-Za-z\d]+([-_.][A-Za-z\d]+)*@([A-Za-z\d]+[-.])+[A-Za-z\d]{2,4}$/;
    return reg['test'](EMail);
};
var strTest = function(v) {
    var reg = new RegExp("[`~!@%#$^&*()=|{}':;',\\[\\]<>/?\\.；：%……+￥‘”“'。，？]");
    return reg.test(v);
};
var codeTest = function(v) {
    var reg = /^([A-Za-z0-9]+){6,10}$/;
    return reg['test'](v);
};
var domainTest = function(v) {
    var reg = /^([a-z0-9]+){1,16}$/;
    return reg['test'](v);
};
var numberTest = function(v) {
    var reg = /^([0-9]+){1,24}$/;
    return reg['test'](v);
};


function AjaxFn(url, data, callbackFn) {
    $.ajax({
        'url': url,
        'type': 'POST',
        'data': data,
        'error': function(err) {},
        'success': function(res) {
            callbackFn(res);
        }
    });
}

//微信分享时的签名
function wx_sign(url,title,desc,imgUrl){
	$.ajax({url: "/wx_sign",type: 'post',data: { url: url},
		success: function (res) {
			wx.config({
				debug: false,
				appId: res.appId,
				timestamp: res.timestamp,
				nonceStr: res.nonceStr,
				signature: res.signature,
				jsApiList: [
                    "updateAppMessageShareData" ,
                    "updateTimelineShareData",
                ]
            });
			wx.ready(function () {
				var shareData = {
					title: title,
					desc: desc,
					link: url,
                    imgUrl: 'https://ourworld.wuyuan.dev/'+imgUrl
                };
                //自定义“分享给朋友”及“分享到QQ”按钮的分享内容（1.4.0）
                wx.updateAppMessageShareData(shareData);
                //自定义“分享到朋友圈”及“分享到QQ空间”按钮的分享内容（1.4.0）
				wx.updateTimelineShareData(shareData);
            });
            
			wx.error(function (res) {
				console.log(res.errMsg);  // 正式环境记得关闭啊！！！！
			});
		}
    });
}
