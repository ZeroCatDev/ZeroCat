
//----------
function showTEXT(txt,title){//显示说明与描述
	layer.alert(txt,{title:title,shadeClose:true})
}
function like(){//点赞
	if (!isLogin){ mdui.snackbar({buttonText: '关闭', message: '请先登录'}); return; }
	AjaxFn('/scratch/play/like', {pid:_pid},function (res) {
		mdui.snackbar(res['msg']);
		if ('1' == res['status']){
			like_count += 1;
			if (res['opt']==1){
				txt = `已赞(${like_count})`;
			} else {
				txt = `点赞(${like_count})`;
			}
			$('#like').text(txt);	
		}
	});
};
function favo(){//收藏
	if (!isLogin){ mdui.snackbar({buttonText: '关闭', message: '请先登录'}); return; }
	AjaxFn('/scratch/play/favo', {pid:_pid},function (res) {
		mdui.snackbar(res['msg']);
		if ('1' == res['status']){
			favo_count = favo_count + res['opt'];
			if (res['opt']==1){
				txt = `已收藏(${favo_count})`;
			} else {
				txt = `收藏(${favo_count})`;
			}
			$('#favo').text(txt);	
		}
	});
};

//显示、隐藏虚拟键盘
$('#switchVK').click(function () {
	if ($('#vk').css('display') == 'none') {
		$('#vk').show();
	} else {
		$('#vk').hide();
	}
});
$('.green-flag-box').click(function(){
    $('#container_main').hide();
    
	$('#loading-progress').show();
	$('#container_play').show();
	$('#greenFlag').show();
	$('#stopAll').show();
	//$('#switchVK').show();

	runBenchmark();
    window.focus();
});
//复制地址功能
$(window).load(function () {
	var pageUrl = window.location.href;
	$('.copylink').attr('data-clipboard-text', pageUrl);
});
var clipboard = new ClipboardJS('.copylink');
clipboard.on('success', function (e) {
	mdui.snackbar({buttonText: '关闭', message: '复制成功'})
});
clipboard.on('error', function (e) {
	mdui.snackbar({buttonText: '关闭', message: '当前浏览器不支持此功能'})
});
//生成分享二维码
var cosId = $('#proid').val();
let _href = window.location.href;
new QRCode(document.getElementById("qrcode"), _href);



//------------------------------------------------------------------------------------
/* https://www.npmjs.com/package/get-user-media-promise */
!function(e) {
    "use strict";
    function n() {
        this.name = "NotSupportedError",
        this.message = "getUserMedia is not implemented in this browser"
    }
    function i() {
        this.then = function() {
            return this
        };
        var i = new n;
        this.
        catch = function(e) {
            setTimeout(function() {
                e(i)
            })
        }
    }
    n.prototype = Error.prototype;
    var r = "undefined" != typeof Promise,
    t = "undefined" != typeof navigator,
    a = t && navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    o = t && (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    function s(t) {
        return r ? a ? navigator.mediaDevices.getUserMedia(t) : new Promise(function(e, i) {
            if (!o) return i(new n);
            o.call(navigator, t, e, i)
        }) : new i
    }
    s.NotSupportedError = n,
    s.isSupported = !(!r || !a && !o),
    "function" == typeof define && define.amd ? define([],
    function() {
        return s
    }) : "object" == typeof module && module.exports ? module.exports = s: (e.navigator || (e.navigator = {}), e.navigator.mediaDevices || (e.navigator.mediaDevices = {}), e.navigator.mediaDevices.getUserMedia || (e.navigator.mediaDevices.getUserMedia = s))
} (this);
/* https://github.com/LLK/scratch-gui/blob/7b658c60c7c04055e575601a861195fe6c9933f3/src/lib/video/camera.js */
const requestStack = [];
const requestVideoStream = videoDesc => {
    let streamPromise;
    if (requestStack.length === 0) {
        streamPromise = navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoDesc
        });
        requestStack.push(streamPromise);
    } else if (requestStack.length > 0) {
        streamPromise = requestStack[0];
        requestStack.push(true);
    }
    return streamPromise;
};

const requestDisableVideo = () => {
    requestStack.pop();
    if (requestStack.length > 0) return false;
    return true;
};

/* https://github.com/LLK/scratch-gui/blob/7b658c60c7c04055e575601a861195fe6c9933f3/src/lib/video/video-provider.js */
WIDTH = 480;
HEIGHT = 360;
class VideoProvider {
    constructor () {
        this.mirror = true;
        this._frameCacheTimeout = 16;
        this._video = null;
        this._track = null;
        this._workspace = [];
    }

    static get FORMAT_IMAGE_DATA () {return 'image-data';}
    static get FORMAT_CANVAS () {return 'canvas';}
    static get DIMENSIONS () {return [WIDTH, HEIGHT];}
    static get ORDER () { return 1; }
    get video () { return this._video; }

    enableVideo () { this.enabled = true; return this._setupVideo(); }
    disableVideo () {
        this.enabled = false;
        if (this._singleSetup) {
            this._singleSetup
                .then(this._teardown.bind(this))
                .catch(err => this.onError(err));
        }
    }
    _teardown () {
        if (this.enabled === false) {
            const disableTrack = requestDisableVideo();
            this._singleSetup = null;
            this._video = null;
            if (this._track && disableTrack) {
                this._track.stop();
            }
            this._track = null;
        }
    }
    getFrame ({
        dimensions = VideoProvider.DIMENSIONS,
        mirror = this.mirror,
        format = VideoProvider.FORMAT_IMAGE_DATA,
        cacheTimeout = this._frameCacheTimeout
    }) {
        if (!this.videoReady) {
            return null;
        }
        const [width, height] = dimensions;
        const workspace = this._getWorkspace({dimensions, mirror: Boolean(mirror)});
        const {videoWidth, videoHeight} = this._video;
        const {canvas, context, lastUpdate, cacheData} = workspace;
        const now = Date.now();

        if (lastUpdate + cacheTimeout < now) {

            if (mirror) {
                context.scale(-1, 1);
                context.translate(width * -1, 0);
            }

            context.drawImage(this._video,
                0, 0, videoWidth, videoHeight,
                0, 0, width, height
            );

            context.setTransform(1, 0, 0, 1, 0, 0);
            workspace.lastUpdate = now;
        }

        if (!cacheData[format]) {
            cacheData[format] = {lastUpdate: 0};
        }
        const formatCache = cacheData[format];

        if (formatCache.lastUpdate + cacheTimeout < now) {
            if (format === VideoProvider.FORMAT_IMAGE_DATA) {
                formatCache.lastData = context.getImageData(0, 0, width, height);
            } else if (format === VideoProvider.FORMAT_CANVAS) {
                formatCache.lastUpdate = Infinity;
                formatCache.lastData = canvas;
            } else {
                console.error(`video io error - unimplemented format ${format}`);
                formatCache.lastUpdate = Infinity;
                formatCache.lastData = null;
            }

            formatCache.lastUpdate = Math.max(workspace.lastUpdate, formatCache.lastUpdate);
        }

        return formatCache.lastData;
    }
    onError (error) { console.error('Unhandled video io device error', error); }
    _setupVideo () {
        if (this._singleSetup) {
            return this._singleSetup;
        }

        this._singleSetup = requestVideoStream({
            width: {min: WIDTH, ideal: 480 * WIDTH / HEIGHT},
            height: {min: HEIGHT, ideal: 480}
        })
            .then(stream => {
                this._video = document.createElement('video');

                try {
                    this._video.srcObject = stream;
                } catch (error) {
                    this._video.src = window.URL.createObjectURL(stream);
                }
                this._video.play();
                this._track = stream.getTracks()[0];
                return this;
            })
            .catch(error => {
                this._singleSetup = null;
                this.onError(error);
            });

        return this._singleSetup;
    }

    get videoReady () {
        if (!this.enabled) {
            return false;
        }
        if (!this._video) {
            return false;
        }
        if (!this._track) {
            return false;
        }
        const {videoWidth, videoHeight} = this._video;
        if (typeof videoWidth !== 'number' || typeof videoHeight !== 'number') {
            return false;
        }
        if (videoWidth === 0 || videoHeight === 0) {
            return false;
        }
        return true;
    }

    _getWorkspace ({dimensions, mirror}) {
        let workspace = this._workspace.find(space => (
            space.dimensions.join('-') === dimensions.join('-') &&
            space.mirror === mirror
        ));
        if (!workspace) {
            workspace = {
                dimensions,
                mirror,
                canvas: document.createElement('canvas'),
                lastUpdate: 0,
                cacheData: {}
            };
            workspace.canvas.width = dimensions[0];
            workspace.canvas.height = dimensions[1];
            workspace.context = workspace.canvas.getContext('2d');
            this._workspace.push(workspace);
        }
        return workspace;
    }
}

//项目数据下载URL：
function getProjectUrl(asset) {
var assetIdParts = asset.assetId.split('.');
var assetUrlParts = ["//"+window.location.host+"/", 'scratch/play/project/', assetIdParts[0]];
if (assetIdParts[1]) {assetUrlParts.push(assetIdParts[1]);}
return assetUrlParts.join('');
};
//项目资源文件下载URL
function getAssetUrl(asset) {
var assetUrlParts = [qiniuurl+'/material/asset/', asset.assetId, '.', asset.dataFormat];
return assetUrlParts.join('');
};

//运行Scratch
const Scratch = window.Scratch = window.Scratch || {};
const runBenchmark = function () {
    const vm = new window.NotVirtualMachine();
    const storage = new ScratchStorage();
    const AssetType = storage.AssetType;
    storage.addWebStore([AssetType.Project], getProjectUrl);
    storage.addWebStore([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getAssetUrl);
    vm.attachStorage(storage);
    Scratch.vm = vm;

    //加载过程
    const progress = document.getElementById('loading-progress');
    const _load = storage.webHelper.load;
    let total = 0, complete = 0;
    storage.webHelper.load = function (...args) {
        const result = _load.call(this, ...args);
        total += 1;
        progress.textContent = complete + '/' + total+' 假装有加时动画';
        result.then(() => {
            complete += 1;
            progress.textContent = complete + '/' + total;
            switch(complete){
                case 1:{progress.textContent += ' 嘻嘻，还要加载一下啦~';break;}
                case 2:{progress.textContent += ' 下面来点不一样的画面';break;}
                case 3:{progress.textContent += ' 我不是美编，做不出漂亮的图';break;}
                case 4:{progress.textContent += ' 所以，就不辣你们的眼睛了';break;}
                case 5:{progress.textContent += ' 只能和你们在此聊聊天了';break;}
                case 6:{progress.textContent += ' 这样也是可以打发时间的';break;}
                case 7:{progress.textContent += ' 如果您喜欢，请多多转发';break;}
                case 8:{progress.textContent += ' 分享给朋友，快乐你、我、她、他、它、TA';break;}
                case 9:{progress.textContent += ' 下面是空白（可能是装B失败）';break;}
                case 10:{progress.textContent += ' 此处是空白（作者装B失败）';break;}
                case 11:{progress.textContent += ' 假装成真也有点难哦';break;}
                case 12:{progress.textContent += ' 装不下去了';break;}
                case 13:{progress.textContent += ' 实在装不下去了';break;}
                case 14:{progress.textContent += ' 真的装不下去了';break;}
                case 15:{progress.textContent += ' 如果你能找源代码，可以自己来装B哟';break;}
                case 16:{progress.textContent += ' 假装有加时动画，最后一条';break;}
                default:{progress.textContent += ' 依然在加载啦~';}
            }
        });
        return result;
    };

    vm.downloadProjectId(_pid);


    let initialized = false;
    vm.on('workspaceUpdate', () => {
        if (initialized) return;

        if (progress.parentNode) {
            progress.parentNode.removeChild(progress);
        }
        
        const noop = () => null;
        vm.setVideoProvider(new VideoProvider());
        
        vm.setCloudProvider({
            updateVariable(name, value) {
            try {
                localStorage.setItem('[s3] ' + name, value);
            } catch (e) {
                console.error('Cannot use localStorage?', e);
            }
            },
            createVariable: noop,
            renameVariable: noop,
            deleteVariable: noop,
            requestCloseConnection: noop
        });

        setTimeout(() => {
            for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.slice(0, 5) === '[s3] ') {
                vm.postIOData('cloud', {
                varUpdate: {
                    name: key.slice(5),
                    value: localStorage.getItem(key)
                }
                });
            }
            }
            window.addEventListener('storage', e => {
            if (e.storageArea === localStorage && e.key.slice(0, 5) === '[s3] ') {
                vm.postIOData('cloud', {
                varUpdate: {
                    name: e.key.slice(5),
                    value: e.newValue
                }
                });
            }
            });
        });
        
        
        //COMPAT = true,
        //TURBO = false,
        vm.setCompatibilityMode(true);
        //vm.setTurboMode(false);
        vm.greenFlag();

        initialized = true;
    });

    function resize() {
        const rect = canvas.getBoundingClientRect();
        renderer.resize(rect.width, rect.height);
        monitorWrapper.style.transform = `scale(${rect.height / 360})`;
    }

    const monitorWrapper = document.getElementById('monitors');
    const canvas = document.getElementById('stage');
    const renderer = new window.ScratchRender(canvas );
    resize();
    window.addEventListener('resize', resize);

    Scratch.renderer = renderer;
    vm.attachRenderer(renderer);
    const audioEngine = new window.AudioEngine();
    vm.attachAudioEngine(audioEngine);
    vm.attachV2SVGAdapter(new ScratchSVGRenderer.SVGRenderer());
    vm.attachV2BitmapAdapter(new ScratchSVGRenderer.BitmapAdapter());


    /* https://github.com/LLK/scratch-gui/blob/develop/src/containers/stage.jsx#L176-L300 */
    const getEventXY = e => {
    if (e.touches && e.touches[0]) {
        return {x: e.touches[0].clientX, y: e.touches[0].clientY};
    } else if (e.changedTouches && e.changedTouches[0]) {
        return {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY};
    }
    return {x: e.clientX, y: e.clientY};
    };
    let mouseDown = false,
    mouseDownPosition = null,
    mouseDownTimeoutId = null,
    isDragging = false,
    dragId = null,
    dragOffset = null;
    function cancelMouseDownTimeout() {
        if (mouseDownTimeoutId !== null) {
            clearTimeout(mouseDownTimeoutId);
        }
        mouseDownTimeoutId = null;
    }
    function onStartDrag() {
        if (dragId) return;
        const drawableId = renderer.pick(...mouseDownPosition);
        if (drawableId === null) return;
        const targetId = vm.getTargetIdForDrawableId(drawableId);
        if (targetId === null) return;
        const target = vm.runtime.getTargetById(targetId);
        if (!target.draggable) return;
        target.goToFront();
        const drawableData = renderer.extractDrawable(drawableId, ...mouseDownPosition);
        vm.startDrag(targetId);
        isDragging = true;
        dragId = targetId;
        dragOffset = drawableData.scratchOffset;
    }
    function getScratchCoords(x, y, rect) {
    const nativeSize = renderer.getNativeSize();
    return [
        (nativeSize[0] / rect.width) * (x - (rect.width / 2)),
        (nativeSize[1] / rect.height) * (y - (rect.height / 2))
    ];
    }
    function mousemove(e) {
    const {x, y} = getEventXY(e);
    const rect = canvas.getBoundingClientRect();
    const mousePosition = [x - rect.left, y - rect.top];
    if (mouseDown && !isDragging) {
        const distanceFromMouseDown = Math.sqrt(
        Math.pow(mousePosition[0] - mouseDownPosition[0], 2) +
        Math.pow(mousePosition[1] - mouseDownPosition[1], 2)
        );
        if (distanceFromMouseDown > 3) {
        cancelMouseDownTimeout();
        onStartDrag();
        }
    }
    if (mouseDown && isDragging) {
        const spritePosition = getScratchCoords(mousePosition[0], mousePosition[1], rect);
        vm.postSpriteInfo({
        x: spritePosition[0] + dragOffset[0],
        y: -(spritePosition[1] + dragOffset[1]),
        force: true
        });
    }
    vm.postIOData('mouse', {
        x: mousePosition[0],
        y: mousePosition[1],
        canvasWidth: rect.width,
        canvasHeight: rect.height
    });
    }
    function mousedown(e) {
    const {x, y} = getEventXY(e);
    const rect = canvas.getBoundingClientRect();
    const mousePosition = [x - rect.left, y - rect.top];
    mouseDown = true;
    mouseDownPosition = mousePosition;
    mouseDownTimeoutId = setTimeout(onStartDrag, 400);
    vm.postIOData('mouse', {
        isDown: true,
        x: mousePosition[0],
        y: mousePosition[1],
        canvasWidth: rect.width,
        canvasHeight: rect.height
    });
    e.preventDefault();
    if (!document.body.classList.contains('asking')) {
        window.focus();
    }
    }
    function mouseup(e) {
        const {x, y} = getEventXY(e);
        const rect = canvas.getBoundingClientRect();
        cancelMouseDownTimeout();
        mouseDown = false;
        mouseDownPosition = null;
        if (isDragging) {
            vm.stopDrag(dragId);
            isDragging = false;
            dragOffset = null;
            dragId = null;
        }
        vm.postIOData('mouse', {
            isDown: false,
            x: x - rect.left,
            y: y - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        });
    }
    function mouseWheel(e){
        vm.postIOData('mouseWheel', {
            deltaX: e.deltaX,
            deltaY: e.deltaY
        });
        e.preventDefault();
    };
    canvas.addEventListener('touchstart', mousedown, {passive: false});
    document.addEventListener('touchmove', mousemove);
    document.addEventListener('touchend', mouseup, {passive: false});

    canvas.addEventListener('mousedown', mousedown);
    document.addEventListener('mousemove', mousemove);
    document.addEventListener('mouseup', mouseup);
    

    canvas.addEventListener('wheel', mouseWheel);


    /* https://github.com/LLK/scratch-gui/blob/develop/src/lib/vm-listener-hoc.jsx#L86-L115 */
    function keydown(e){
        if (e.target !== document && e.target !== document.body) return;
        const key = !e.key || e.key === 'Dead' ? e.keyCode : e.key;
        vm.postIOData('keyboard', {
            key: key,
            isDown: true
        });
        if (e.keyCode === 32 || e.keyCode >= 37 && e.keyCode <= 40) {
            e.preventDefault();
        }
    }
    function keyup(e){
        const key = !e.key || e.key === 'Dead' ? e.keyCode : e.key;
        vm.postIOData('keyboard', {
            key: key,
            isDown: false
        });
        if (e.target !== document && e.target !== document.body) {
            e.preventDefault();
        }        
    }
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);



    const askBoxWrapper = document.getElementById('asking-box');
    const question = document.getElementById('question');
    const askBox = document.getElementById('answer');
    const getVariable = (targetId, variableId) => {
        const target = targetId ?
            vm.runtime.getTargetById(targetId) :
            vm.runtime.getTargetForStage();
        return target.variables[variableId];
    };
    const monitorStates = {};
    let once = false;
    askBox.addEventListener('keydown', e => {
    if (e.keyCode === 13) {
        document.body.classList.remove('asking');
        /* submit answer after because it starts the next question synchronously */
        vm.runtime.emit('ANSWER', askBox.value);
    }
    });
    vm.runtime.addListener('QUESTION', questionData => {
    /* null means the asking was interrupted by stop script block */
    if (questionData === null) {
        document.body.classList.remove('asking');
    } else {
        document.body.classList.add('asking');
        question.textContent = questionData;
        askBox.value = '';
        askBox.focus();
    }
    });
    vm.runtime.addListener('MONITORS_UPDATE', monitors => {
    monitors.forEach((record, id) => {
        if (!monitorStates[id]) {
        const monitor = document.createElement('div');
        monitor.className = 'monitor ' + record.mode;
        monitor.style.left = record.x + 'px';
        monitor.style.top = record.y + 'px';
        if (record.mode === 'list') {
            monitor.style.width = record.width + 'px';
            monitor.style.height = record.height + 'px';
        }
        const label = document.createElement('span');
        label.className = 'monitor-label';
        let name = record.params.VARIABLE || record.params.LIST || record.opcode;
        if (record.spriteName) name = `${record.spriteName}: ${name}`;
        label.textContent = name;
        monitor.appendChild(label);
        const value = document.createElement('span');
        value.className = 'monitor-value';
        monitor.appendChild(value);
        monitorStates[id] = {monitor, value};
        if (record.mode === 'slider') {
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = record.sliderMin;
            slider.max = record.sliderMax;
            slider.step = record.isDiscrete ? 1 : 0.01;
            slider.addEventListener('input', e => {
            getVariable(record.targetId, id).value = slider.value;
            });
            slider.addEventListener('change', e => {
            getVariable(record.targetId, id).value = slider.value;
            });
            monitorStates[id].slider = slider;
            monitor.appendChild(slider);
        }
        monitorWrapper.appendChild(monitor);
        }
        monitorStates[id].monitor.style.display = record.visible ? null : 'none';
        if (record.visible) {
        let value = record.value;
        if (typeof value === 'number') {
            value = Number(value.toFixed(6));
        }
        if (typeof value === 'boolean') {
            value = value.toString();
        }
        if (Array.isArray(value)) {
            if (monitorStates[id].lastValue === JSON.stringify(value)) return;
            monitorStates[id].value.innerHTML = '';
            value.forEach(val => {
            const row = document.createElement('div');
            row.className = 'row';
            row.textContent = val;
            monitorStates[id].value.appendChild(row);
            });
        } else {
            monitorStates[id].value.textContent = value;
            if (monitorStates[id].slider) monitorStates[id].slider.value = value;
        }
        }
    });
    });
    DESIRED_USERNAME = "Desired_UserName";
    vm.postIOData('userData', {username: DESIRED_USERNAME});



    Scratch.vm.start();
    
};
function greenFlag(){Scratch.vm.greenFlag();};
function stopAll(){ Scratch.vm.stopAll();  };

function VK_key_down(key){Scratch.vm.postIOData('keyboard', { key: key, isDown: true });};
function VK_key_up(key){Scratch.vm.postIOData('keyboard', { key: key, isDown: false });};


//全屏功能
function isFullscreen() {
    return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', e => {
    fullscreenBtn.blur();
    if (isFullscreen()) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
        if (document.body.requestFullscreen) document.body.requestFullscreen();
        else if (document.body.msRequestFullscreen) document.body.msRequestFullscreen();
        else if (document.body.mozRequestFullScreen) document.body.mozRequestFullScreen();
        else if (document.body.webkitRequestFullscreen) document.body.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
});
function onFullscreenChange() {
    if (isFullscreen()) {
    document.body.classList.add('fullscreen');
    } else {
    document.body.classList.remove('fullscreen');
    }
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('mozfullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);
document.addEventListener('msfullscreenchange', onFullscreenChange);

