var table = layui.table;
var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/user/data'
    , where:{s:0}
    , toolbar: '#TableOne_bar'
    , page: true
    , cols: [[
        { field: 'username', width: 120, title: '账号' }
        , { field: 'nickname', title: '昵称' }
        , { title: '作品查看', width: 100, align: "center", templet: "#tyTpl",event:'see_works'}
        , { title: '课程查看', width: 100, align: "center", templet: "#tyTpl",event:"see_course"}
        , { field: 'regTime', width: 180, title: '注册时间' }
        , { title: '操作', width:150, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        //_data = res;
        return {
            "code": 0,
            "msg": "",
            "count": res.count,
            "data": res.data
        };
    }
});
table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'getZC') {
        _table_render.reload({where: {s: 0},page: {curr: 1}});
    } else if (obj.event === 'getFH') {
        _table_render.reload({where: {s: 2},page: {curr: 1}});
    } else if (obj.event === 'search') {
        layer.prompt({title:'请输入查找的账号',formType:0, maxlength: 16,shadeClose:true}, function (v, index) {
            _table_render.reload({where: {s:9, t:v},page: {curr: 1}});
            layer.close(index);
        });
    } else if (obj.event === 'new') {
        layer.prompt({title:'添加新用户',formType:0, maxlength: 16,shadeClose:true}, function (v, index) {
            if (!usernameTest(v)) {
                layer.msg({buttonText: '关闭', message: '账号格式不正确'});
                return;
            }

            AjaxFn('/admin/user_new', {'un': v }, function (res){
                layer.msg(res.msg);
                if ('success' == res.status){
                    _table_render.reload();
                    layer.close(index);
                }
            })
        });
    } else if (obj.event === 'regist') {
        let v = 0, s = "开启"
        if ($(`#registBtn`).text().indexOf(s) >= 0){
            v=1, s="关闭"
        };

        AjaxFn('/admin/user/setRegist', {v: v}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                $(`#registBtn`).text(`${s}注册通道`);
            }
        })
    }
});
//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event === 'setpwd') {
        var vv = obj.data.username.substring(obj.data.username.length-6);
        layer.prompt({title:obj.data.username+'密码重置',value:vv,formType:0, maxlength: 12,shadeClose:true}, function (v, index) {
            if (!userpwdTest(v)) {
                layer.msg({buttonText: '关闭', message: '密码格式不正确'});
                return;
            }

            AjaxFn('/admin/user_setpwd', {'un': obj.data.username,'pw':v }, function (res){
                layer.msg(res['msg']);
                if ('success' == res['status']){
                    layer.close(index);
                }
            })
        });      
    } else if (obj.event === 'fh') {
        layer.confirm('即将对此用户封号？',{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/user_setstate', {'id': obj.data.id,'s':'2'}, function (res){
                layer.msg(res['msg']);
                if ('success' == res['status']){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    } else  if (obj.event === 'jf') {
        layer.confirm('即将对此账号进行解封？',{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/user_setstate', {'id': obj.data.id,'s':'0'}, function (res){
                layer.msg(res['msg']);
                if ('success' == res['status']){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    }
});

// 批量生成账号
function new100(){
    var select_data=[];
    layer.open({
        type: 1
        ,shadeClose: true
        ,title: '批量生成账号'
        ,btn: ['确定','取消']
        ,area: ['280px', '240px']
        ,content:`<div style="margin:12px">
                    <input id="qz_input" type="text" maxlength="8" placeholder="请输入账号前缀(长度：4~8)" class="layui-input" style="margin:12px 0;">

                    <input id="sl_input" type="text" maxlength="3" placeholder="请输入账号数量(大小：1~100)" class="layui-input">
                  </div>`
        ,success:function(){

        }
        ,yes:function(index){
            const qz = $('#qz_input').val();
            var reg = /^(?:\d+|[a-zA-Z]+){4,8}$/;
            if (!reg['test'](qz)) {
                layer.msg({buttonText: '关闭', message: '前缀格式不正确'});
                return;
            }

            const sl = $('#sl_input').val();
            reg = /^([0-9]+){1,3}$/;
            if (!reg['test'](sl)) {
                layer.msg({buttonText: '关闭', message: '数量不正确：1~100'});
                return;
            }

            if (sl== 0 || sl>100) {
                layer.msg({buttonText: '关闭', message: '数量不正确：1~100'});
                return;
            }
 
            AjaxFn('/admin/user_new100', {qz:qz, sl:sl}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    layer.close(index);
                }
            })
        }
    }); 
};
