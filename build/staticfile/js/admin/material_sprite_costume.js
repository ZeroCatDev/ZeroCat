var table = layui.table;
var upload = layui.upload;
var _table_render_costume = table.render({
    elem: '#TableOne'
    , url: '/admin/material/sprite/setCostume/data'
    , where:{id: _id}
    , toolbar: '#TableOne_bar'
    , defaultToolbar:[]
    , cols: [[
        {type:'numbers'}
        , { field: 'img', width: 240, title: '图片', align: "center", templet: "#imgTemp" }
        , { field: 'name', title: '名称'}
        , { field: 'md5ext', title: '文件名'}
        , { title: '操作', width: 240, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        if (res.data == '') { return {code: 0, msg: '', count: 0, data: []}; }

        const json = JSON.parse(res.data).costumes;
        json.map((item,index)=>{
            item.len = json.length;
            item.index = index;
        });

        return {
            code: 0,
            msg: '',
            count: json.length,
            data: json
        };
    }
});

table.on('toolbar(TableOne)', function (obj) {
    if (obj.event === 'AddSpriteCostume') {
        layer.confirm(`添加一个造型？`,{title:'提示',shadeClose:true, offset:'180px'}, function (index) {
            AjaxFn('/admin/material/sprite/setCostume/add', {id: _id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render_costume.reload({where: {id: _id}});
                    layer.close(index);
                }
            });
        });
    }
});

//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event === 'DelSpriteCostume') {
        if (obj.data.len < 2){
            layer.msg({buttonText: '关闭', message: '角色最少有一个造型'});
            return;
        }

        layer.confirm(`移除 ${obj.data.name} ？`,{title:'重要提示',shadeClose:true, offset:'180px'}, function (index) {
            AjaxFn('/admin/material/sprite/setCostume/del', {id: _id, index: obj.data.index, md5: obj.data.md5ext}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render_costume.reload({where: {id: _id}});
                    layer.close(index);
                }
            })
        });
    }
});



// 添加造型窗口
function onSearchInput(e){ // 搜索
    if(e.keyCode == "13") {  
        const searchText = $('#search_input').val();
		_table_thr.reload({where: {text: searchText}, page: {curr: 1}});
    } 
};
function AddSpriteCostume(){
    var select_data=[];
    layer.open({
        type: 1
        ,shadeClose: true
        ,title: '请选择一个造型'
        ,btn: ['确定','取消']
        ,area: ['580px', '650px']
        ,content:`<div style="margin:12px">
                    <input id="search_input" type="text" maxlength="32" placeholder="搜索：请输入造型名称并回车" class="layui-input" onkeypress="onSearchInput(event)">
                    <table class="layui-hide" id="TableThr" lay-filter="TableThr"></table>
                  </div>`
        ,success:function(){
            //设置被选中的选项
            _table_thr = table.render({
                elem: '#TableThr'
                , url: '/admin/material/sprite/setCostume/select'
                , where: {text: ''}
                , page: true
                , cols: [[
                    { field: 'tag', width:150, title: '所属分类'}, 
                    { field: 'name', title: '名称'}
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
            //监听行单击事件（双击事件为：rowDouble）
            table.on('row(TableThr)', function(obj){
                select_data = obj.data;
				obj.tr.siblings().attr({ "style": "background:#FFFFFF" });//其他tr恢复原样
                obj.tr.attr({ "style": "background:#5FB878" });//改变当前tr颜色
            });
        }
        ,yes:function(index){
            if (select_data.length==0){return;}

            //保存到服务器
			AjaxFn('/admin/material/sprite/setCostume/add', {sid: _id, cid: select_data.id}, function (res){
                layer.msg(res.msg);
				if ('ok' == res.status){
                    _table_render_costume.reload({where: {id: _id}});
                    layer.close(index);
                }
            })
        }
    }); 
};
