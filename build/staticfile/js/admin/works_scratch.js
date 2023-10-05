var table = layui.table;
var _table_render = table.render({
    elem: '#TableOne'
    , url: '/admin/works/scratch/data'
    , toolbar: '#TableOne_bar'
    , page: true
    , cols: [[
        { field: 'username', width: 120, title: '作者' }
        , { field: 'nickname', width: 150, title: '作者昵称' }
        , { field: 'title', title: '作品名' }
        , { field: 'time', width: 180, title: '修改时间', templet: "#timeTemp"}
        , { title: '操作', width:520, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        return {
            "code": 0,
            "msg": "",
            "count": res.count,
            "data": res.data
        };
    }
});

table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'search_state0' || obj.event === 'search_state1' || obj.event === 'search_state2') {
        _table_render.reload({where: {w: obj.event},page: {curr: 1}});
    } else if (obj.event === 'search_workname') {
        layer.prompt({title:'请输入查找的作品名称',formType:0, maxlength: 32,shadeClose:true}, function (v, index) {
            _table_render.reload({where: {w:obj.event, v:v},page: {curr: 1}});
            layer.close(index);
        });
    } else if (obj.event === 'search_nickname') {
        layer.prompt({title:'请输入查找的作者昵称',formType:0, maxlength: 32,shadeClose:true}, function (v, index) {
            _table_render.reload({where: {w:obj.event, v:v},page: {curr: 1}});
            layer.close(index);
        });
    }
});
//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event === 'setState0' || obj.event === 'setState1' || obj.event === 'setState2') {
        var s = obj.event.substring(obj.event.length-1);
        AjaxFn('/admin/works/scratch/setState', {'id': obj.data.id,'s':s }, function (res){
            layer.msg(res['msg']);
            if ('success' == res['status']){
                _table_render.reload();
            }
        })     
    } else if (obj.event === 'changeTitle') {
        layer.prompt({title:'修改作品标题',formType:0, maxlength: 32, shadeClose:true, value:obj.data.title}, function (v, index) {
            AjaxFn('/admin/works/scratch/changeTitle', {'id':obj.data.id, 't': v }, function (res){
                layer.msg(res['msg']);
                if ('success' == res['status']){
                    _table_render.reload();
                    layer.close(index);
                }
            })
        });
    } else if (obj.event === 'setDefaultWork'){
        layer.confirm(`把【${obj.data.title}】复制为默认作品？`,{title:'重要提示',shadeClose:true}, function (index) {
            AjaxFn('/admin/works/setDefaultWork', {id: obj.data.id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    layer.close(index);
                }
            });
        });
    }
});

