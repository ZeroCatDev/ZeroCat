var table = layui.table;
var upload = layui.upload;
var _tagId = 0;
var _mate_id = 0;

var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/material/sound/data'
    , where:{tagId:0}
    , toolbar: '#TableOne_bar'
    , page: true
    , defaultToolbar:[]
    , cols: [[
        { field: 'name', width: 200, title: '名称', edit: 'text' }
        , { field: 'sampleCount', width: 100, title: '样例数', edit: 'text' }
        , { field: 'md5',  width: 320,  title: '文件名'}
        , { title: '操作',toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
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

        upload.render({
            elem: '.modSoundMate'
            ,url: '/admin/material/sound/modWav'
            ,size: 2048 //限制文件大小，单位 KB
            ,exts: 'wav'
            ,accept: 'audio'
            ,data: {
                id: function(){return _mate_id;}
            }
            ,done: function(res, index, upload){
                layer.msg(res.msg);
            }
        });        
    }
});

table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'showMates') {
        _tagId =  $(this).data('id');
        _table_render.reload({where: {tagId: _tagId}, page:{curr:1}});
    } else if (obj.event === 'AddMate') {
        if (_tagId == 0){ layer.msg({buttonText: '关闭', message: "请先选择一个标签"}); return; }

        layer.confirm(`添加一个声音素材？`,{title:'提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/sound/add', {tagId: _tagId}, function (res){
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
    if(obj.event === 'modSoundMate'){
        _mate_id = obj.data.id;
    } else if (obj.event === 'DelMate') {
        layer.confirm(`删除 ${obj.data.name} ？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/sound/del', {id: obj.data.id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    } else if (obj.event == 'setState') {
        AjaxFn('/admin/material/sound/setState', {id: obj.data.id, v: $(this).attr('data-v')}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload();
            }
        })
    } else if (obj.event == 'playSoundMate') {
        if (obj.data.format !== ''){ 
            layer.msg({buttonText: '关闭', message: "此格式暂不支持试听，请直接在Scratch中体验！"});
            return;
        }
        document.getElementById(`PlayWav${obj.data.id}`).play();
    }
});

//监听单元格编辑
table.on('edit(TableOne)', function(obj){
    var value = obj.value.trim() //得到修改后的值
    var field = obj.field; //得到字段
    if (value==''){ layer.msg({buttonText: '关闭', message: '不能为空'}); return; }

    if (field == 'name') {
        AjaxFn('/admin/material/sound/modName', {id: obj.data.id, v:value}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({where: {tagId: _tagId}});
            }
        });
    } else if (field == 'sampleCount') {
        if (!numberTest(value)){ layer.msg({buttonText: '关闭', message: "请输入纯数"}); return; }

        let v = parseInt(value);

        if (v<1 || 10000000<v){
            layer.msg({buttonText: '关闭', message: "此参数建议值：1~1000,0000 之间"});
            return;
        }

        AjaxFn('/admin/material/sound/modMateAttr', {id: obj.data.id, t:field, v}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({where: {tagId: _tagId}});
            }
        });
    }
});