var table = layui.table;
var upload = layui.upload;
var _tagId = 0;
var _img_id = 0;
var _img_md5 = '';

var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/material/backdrop/data'
    , where:{tagId:0}
    , toolbar: '#TableOne_bar'
    , page: true
    , defaultToolbar:[]
    , cols: [[
        { field: 'img', width: 240, title: '图片', event:'modImage', align: "center", templet: "#imgTemp" }
        , { field: 'name', width: 240, title: '名称', edit: 'text' }
        , { field: 'info0', width: 80, title: '宽度', edit: 'text' }
        , { field: 'info1', width: 80, title: '高度', edit: 'text' }
        , { field: 'info2', width: 80, title: '显示', edit: 'text' }
        , { field: 'md5',  title: '文件名'}
        , { title: '操作', width: 160, toolbar: '#TableOne_tool'}
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
            elem: '.backdropImage'
            ,url: '/admin/material/backdrop/modImage'
            ,size: 2048 //限制文件大小，单位 KB
            ,exts: 'jpg|png|gif|svg|bmp'
            ,accept: 'images'
            ,data: {
                id: function(){return _img_id;},
                md5: function(){return _img_md5;}
            }
            ,done: function(res, index, upload){
                layer.msg(res.msg);
                if (res.status=='ok'){
                    var item = this.item;
                    $(item).attr('src', `/material/asset/${res.imgFile}?t=` + Math.random());
                }
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

        layer.confirm(`添加一个背景？`,{title:'提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/backdrop/add', {tagId: _tagId}, function (res){
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
    if(obj.event === 'modImage'){
        _img_id = obj.data.id;
        _img_md5 = obj.data.md5;
    } else if (obj.event === 'DelMate') {
        layer.confirm(`删除 ${obj.data.name} ？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/backdrop/del', {id: obj.data.id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    } else if (obj.event == 'setState') {
        AjaxFn('/admin/material/backdrop/setState', {id: obj.data.id, v: $(this).attr('data-v')}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload();
            }
        })
    }
});
//监听单元格编辑
table.on('edit(TableOne)', function(obj){
    var value = obj.value.trim() //得到修改后的值
    var field = obj.field; //得到字段
    if (value==''){ layer.msg({buttonText: '关闭', message: '不能为空'}); return; }

    if (field == 'name') {
        AjaxFn('/admin/material/backdrop/modName', {id: obj.data.id, v:value}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({where: {tagId: _tagId}});
            }
        });
    } else if (field == 'info0' || field == 'info1' || field == 'info2') {//修改info值
        if (!numberTest(value)){ layer.msg({buttonText: '关闭', message: "请输入纯数"}); return; }

        let v = parseInt(value);

        if ((field == 'info0' || field == 'info1') && (v<1 || 9999<v)){
            layer.msg({buttonText: '关闭', message: "宽、高大小只能在 1~9999 之间"});
            return;
        }

        if (field == 'info2' && (v<1 || 2<v)){
            layer.msg({buttonText: '关闭', message: "显示方式：1=铺开显示；2=原图显示"});
            return;
        }

        AjaxFn('/admin/material/backdrop/modMateSize', {id: obj.data.id, t:field, v}, function (res){
            layer.msg(res.msg);
            if ('ok' == res.status){
                _table_render.reload({where: {tagId: _tagId}});
            }
        });
    }
});