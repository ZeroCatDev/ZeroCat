var table = layui.table;
var __type = 1;
var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/material/tag/data'
    , where:{t:1}
    , toolbar: '#TableOne_bar'
    , cols: [[
        { field: 'tag', width: 280, title: '标签名称' }
        , { title: '操作', toolbar: '#TableOne_tool'}
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
    ,done: function(res, curr, count){
        $(`#tag_type_btn${__type}`).addClass('layui-btn-warm').siblings().removeClass('layui-btn-warm');
    }
});
table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'showTags') {
        __type =  $(this).data('type');
        _table_render.reload({where: {t: __type}});
    } else if (obj.event === 'AddTag') {
        layer.prompt({title:'添加标签',formType:0, maxlength: 16,shadeClose:true}, function (v, index) {
            AjaxFn('/admin/material/tag/add', {t: __type, v}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render.reload({where: {t: __type}});
                    layer.close(index);
                }
            });
        });
    }
});
//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event === 'ModTag') {
        layer.prompt({title:'修改标签名', value:obj.data.tag, formType:0, maxlength: 16,shadeClose:true}, function (v, index) {
            AjaxFn('/admin/material/tag/mod', {id:obj.data.id, v}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render.reload({where: {t: __type}});
                    layer.close(index);
                }
            });
        });
    } else if (obj.event === 'DelTag') {
        layer.confirm(`删除 ${obj.data.tag} 标签？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/material/tag/del', {id: obj.data.id, t:__type}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    obj.del();
                    layer.close(index);
                }
            })
        });
    }
});
