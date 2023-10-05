var table = layui.table;
var upload = layui.upload;
var _img_id=0;


var _table_render = table.render({
    elem: '#TableOne'
    , url: '/ads/data'
    , toolbar: '#TableOne_bar'
    , page: true
    , cols: [[
        { field: 'id', width: 80, title: '头图ID'}
        , { field: 'i', width: 100, edit:'text', title: '显示顺序'}
        , { field: 'title', width: 180, edit:'text', title: '头图名称'}
        , { field: 'img', width: 120, title: '头图图片', event:'setImg', templet: "#imgTemp"}
        , { field: 'content', edit:'text', title: '头图链接', }
        //, { field: 'time', width: 180, title: '定时投放'}
        , { field: 'createtime', width: 180, title: '创建时间', templet: "#timeTemp"}
        , { title: '操作', width: 128, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        return {
            "code": 0, //解析接口状态
            "msg": "", //解析提示文本
            "count": res.count, //解析数据长度
            "data": res.data //解析数据列表
        };
    }
    ,done: function(res, curr, count){
        upload.render({
            elem: '.imgAds'
            ,url: '/ads/setImg'
            ,size: 520 //限制文件大小，单位 KB
            ,accept: 'images'
            ,data: {id: function(){return _img_id;}}
            ,done: function(res, index, upload){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    $(this.item).attr('src', `/ads/${_img_id}?t=` + Math.random());
                }
            }
        });
    }
});

table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'add') {
        AjaxFn('/ads/add', {}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({page: {curr: 1}});
            }
        })
    }
});

//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if(obj.event === 'setImg'){
        _img_id = obj.data.id;
    } else if (obj.event === 'setState') {
        AjaxFn('/ads/setState', {'id': obj.data.id,'s':$(this).data('state')}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({page: {curr: 1}});
            }
        })
    }else if (obj.event === 'del') {
        layer.confirm(`确定要删除【${obj.data.title}】？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/ads/del', {'id': obj.data.id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    layer.close(index);
                    _table_render.reload({page: {curr: 1}});
                }
            })
        });
    } else if (obj.event === 'add1000'){
        layer.confirm(`给【${obj.data.org_name}】增加 1000 个自研课程招生名额？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/org_setMaxStudentCount', {'id': obj.data.id}, function (res){
                layer.msg(res['msg']);
                if ('ok' == res['status']){
                    layer.close(index);
                    _table_render.reload();
                }
            })
        });
    }
});

//监听单元格编辑
table.on('edit(TableOne)', function(obj){
    var value = obj.value //得到修改后的值
    //,data = obj.data //得到所在行所有键值
    ,field = obj.field; //得到字段
    if (value==''){ layer.msg({buttonText: '关闭', message: '不能为空'}); return; }
    if (field=='i'){
        if (!numberTest(value)){
            layer.msg({buttonText: '关闭', message: '请输入数字'});
            return;
        }
    }

    AjaxFn('/ads/setValue', {'id':obj.data.id, 'f':field, 'v':value}, function (res){
        layer.msg(res.msg);
    })
});
