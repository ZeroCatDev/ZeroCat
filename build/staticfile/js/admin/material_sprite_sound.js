var table = layui.table;
var upload = layui.upload;
var _table_render_Sound = table.render({
    elem: '#TableOne'
    , url: '/admin/material/sprite/setSound/data'
    , where:{id: _id}
    , toolbar: '#TableOne_bar'
    , defaultToolbar:[]
    , cols: [[
        {type:'numbers'}
        , { field: 'name', width: 240, title: '名称'}
        , { field: 'md5ext', title: '文件名'}
        , { title: '操作', width: 240, toolbar: '#TableOne_tool'}
    ]]
    , parseData: function (res) {
        if (res.data == '') { return {code: 0, msg: '', count: 0, data: []}; }

        const json = JSON.parse(res.data).sounds;
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
    if (obj.event === 'AddSpriteSound') {
        layer.confirm(`添加一个声音？`,{title:'提示',shadeClose:true, offset:'180px'}, function (index) {
            AjaxFn('/admin/material/sprite/setSound/add', {id: _id}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render_Sound.reload({where: {id: _id}});
                    layer.close(index);
                }
            });
        });
    }
});

//监听行工具事件
table.on('tool(TableOne)', function (obj) {
    if (obj.event == 'playSoundMate') {
        if (obj.data.format !== ''){ 
            layer.msg({buttonText: '关闭', message: "此格式暂不支持试听，请直接在Scratch中体验！"});
            return;
        }
        document.getElementById(`PlayWav${obj.data.index}`).play();
    } else if (obj.event === 'DelSpriteSound') {
        if (obj.data.len < 2){
            layer.msg({buttonText: '关闭', message: '角色最少有一个声音'});
            return;
        }

        layer.confirm(`移除 ${obj.data.name} ？`,{title:'重要提示',shadeClose:true, offset:'180px'}, function (index) {
            AjaxFn('/admin/material/sprite/setSound/del', {id: _id, index: obj.data.index, md5: obj.data.md5ext}, function (res){
                layer.msg(res.msg);
                if ('ok' == res.status){
                    _table_render_Sound.reload({where: {id: _id}});
                    layer.close(index);
                }
            })
        });
    }
});



// 添加声音窗口
function onSearchInput(e){ // 搜索
    if(e.keyCode == "13") {  
        const searchText = $('#search_input').val();
		_table_thr.reload({where: {text: searchText}, page: {curr: 1}});
    } 
};
function AddSpriteSound(){
    var select_data=[];
    layer.open({
        type: 1
        ,shadeClose: true
        ,title: '请选择一个声音'
        ,btn: ['确定','取消']
        ,area: ['580px', '650px']
        ,content:`<div style="margin:12px">
                    <input id="search_input" type="text" maxlength="32" placeholder="搜索：请输入声音名称并回车" class="layui-input" onkeypress="onSearchInput(event)">
                    <table class="layui-hide" id="TableThr" lay-filter="TableThr"></table>
                  </div>`
        ,success:function(){
            //设置被选中的选项
            _table_thr = table.render({
                elem: '#TableThr'
                , url: '/admin/material/sprite/setSound/select'
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
			AjaxFn('/admin/material/sprite/setSound/add', {sid: _id, cid: select_data.id}, function (res){
                layer.msg(res.msg);
				if ('ok' == res.status){
                    _table_render_Sound.reload({where: {id: _id}});
                    layer.close(index);
                }
            })
        }
    }); 
};
