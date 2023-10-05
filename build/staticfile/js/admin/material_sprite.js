var table = layui.table;
var upload = layui.upload;
var _tagId = 0;
var _img_id = 0;
var _img_md5 = '';

var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/material/sprite/data'
    , where:{tagId:0}
    , toolbar: '#TableOne_bar'
    , page: true
    , defaultToolbar:[]
    , cols: [[
        { field: 'img', width: 240, title: '图片', align: "center", templet: "#imgTemp" }
        , { field: 'name', title: '名称', edit: 'text' }
        , { field: 'c', width: 120, title: '造型数',}
        , { field: 's', width: 120, title: '声音数',}
        , { title: '操作', width: 360, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        for (var i=res.data.length-1; i>=0; i--){
            let json = JSON.parse(res.data[i].json);
            res.data[i].costumes = json.costumes;
            res.data[i].sounds = json.sounds;
            res.data[i].md5 = json.costumes[0].md5ext
            res.data[i].c = json.costumes.length;
            res.data[i].s = json.sounds.length;
        }
        return {
            "code": 0,
            "msg": "",
            "count": res.count,
            "data": res.data
        };
    }
    ,done: function(res, curr, count){
        if (_tagId==0){return;}

        $(`#tag_btn${_tagId}`).addClass('layui-btn-warm').siblings().removeClass('layui-btn-warm');
        $("#add_mate_btn").removeClass("layui-hide");
    }
});

table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'showMates') {
        _tagId =  $(this).data('id');
        _table_render.reload({where: {tagId: _tagId}, page:{curr:1}});
    } else if (obj.event === 'AddMate') {
        if (_tagId == 0){ layer.msg({buttonText: '关闭', message: "请先选择一个标签"}); return; }

        layer.confirm(`添加一个角色？`,{title:'提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/sprite/add', {tagId: _tagId}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render.reload({where: {tagId: _tagId}, page:{curr:1}});
                    layer.close(index);
                }
            });
        });
    }
});

//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event === 'DelMate') {
        layer.confirm(`删除 ${obj.data.name} ？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/sprite/del', {id: obj.data.id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    } else if (obj.event == 'setState') {
        AjaxFn('/admin/material/sprite/setState', {id: obj.data.id, v: $(this).attr('data-v')}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload();
            }
        })
    } else if (obj.event == 'CostumeManage'){
        layer.open({
            type: 2,
            title: "造型管理："+obj.data.name,
            area: ['100%', '100%'],
            offset: ['0px', '0px'],
            fixed: true, 
            content: `/admin/material/sprite/setCostume?id=${obj.data.id}`,
            cancel: function(){// 右上角关闭事件的逻辑
                _table_render.reload();
            }    
        });
    } else if (obj.event == 'SoundManage'){
        layer.open({
            type: 2,
            title: "声音管理："+obj.data.name,
            area: ['100%', '100%'],
            offset: ['0px', '0px'],
            fixed: true, 
            content: `/admin/material/sprite/setSound?id=${obj.data.id}`,
            cancel: function(){ // 右上角关闭事件的逻辑
                _table_render.reload();
            }    
        });
    }
});
//监听单元格编辑
table.on('edit(TableOne)', function(obj){
    var value = obj.value.trim() //得到修改后的值
    var field = obj.field; //得到字段
    if (value==''){ layer.msg({buttonText: '关闭', message: '不能为空'}); return; }

    if (field == 'name') {
        AjaxFn('/admin/material/sprite/modName', {id: obj.data.id, v:value}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({where: {tagId: _tagId}});
            }
        });
    }
});