const {encode,decode} = require('html-entities');

const escapedHtml = decode("&lt;!doctype html &gt;&lt;html &gt;&lt;head &gt;&lt;!-- Recommended meta tags --&gt;&lt;meta charset=&quot;UTF-8 &quot;&gt;&lt;meta name=&quot;viewport &quot;content=&quot;width=device-width,initial-scale=1.0 &quot;&gt;&lt;!-- PyScript CSS --&gt;&lt;link rel=&quot;stylesheet &quot;href=&quot;https://pyscript.net/releases/2024.1.1/core.css &quot;&gt;&lt;!-- CSS for examples --&gt;&lt;link rel=&quot;stylesheet &quot;href=&quot;./assets/css/examples.css &quot;/&gt;&lt;!-- This script tag bootstraps PyScript --&gt;&lt;script type=&quot;module &quot;src=&quot;https://pyscript.net/releases/2024.1.1/core.js &quot;&gt;&lt;/script &gt;&lt;!-- Custom CSS --&gt;&lt;link href=&quot;https://fonts.googleapis.com/css?family=Indie+Flower &quot;rel=&quot;stylesheet &quot;&gt;&lt;link rel=&quot;stylesheet &quot;href=&quot;./assets/css/tictactoe.css &quot;/&gt;&lt;!-- for splashscreen --&gt;&lt;style &gt;#loading { outline: none; border: none; background: transparent }         &lt;/style &gt;&lt;script type=&quot;module &quot;&gt;const loading = document.getElementById(&apos;loading &apos;);             addEventListener(&apos;py:ready &apos;, () =&gt;loading.close());             loading.showModal();         &lt;/script &gt;&lt;title &gt;Tic Tac Toe &lt;/title &gt;&lt;link rel=&quot;icon &quot;type=&quot;image/png &quot;href=&quot;./assets/favicon.png &quot;/&gt;&lt;link rel=&quot;manifest &quot;href=&quot;./psadc-manifest.json &quot;&gt;&lt;/head &gt;&lt;body &gt;&lt;dialog id=&quot;loading &quot;&gt;&lt;h1 &gt;Loading...&lt;/h1 &gt;&lt;/dialog &gt;&lt;nav class=&quot;navbar &quot;style=&quot;background-color: #000000 &quot;&gt;&lt;div class=&quot;app-header &quot;&gt;&lt;a href=&quot;/&quot;&gt;&lt;img src=&quot;./assets/logo.png &quot;class=&quot;logo &quot;/&gt;&lt;/a &gt;&lt;a class=&quot;title &quot;href=&quot;&quot;style=&quot;color: #f0ab3c &quot;&gt;Tic Tac Toe &lt;/a &gt;&lt;/div &gt;&lt;/nav &gt;&lt;section class=&quot;pyscript &quot;&gt;&lt;h1 &gt;Tic-Tac-Toe &lt;/h1 &gt;&lt;script type=&quot;py &quot;src=&quot;./main.py &quot;config=&quot;./pyscript.toml &quot;&gt;&lt;/script &gt;&lt;table id=&quot;board &quot;&gt;&lt;tr &gt;&lt;td &gt;&lt;div id=&quot;cell00 &quot;data-x=&quot;0 &quot;data-y=&quot;0 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell01 &quot;data-x=&quot;0 &quot;data-y=&quot;1 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell02 &quot;data-x=&quot;0 &quot;data-y=&quot;2 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;tr &gt;&lt;td &gt;&lt;div id=&quot;cell10 &quot;data-x=&quot;1 &quot;data-y=&quot;0 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell11 &quot;data-x=&quot;1 &quot;data-y=&quot;1 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell12 &quot;data-x=&quot;1 &quot;data-y=&quot;2 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;/tr &gt;&lt;tr &gt;&lt;td &gt;&lt;div id=&quot;cell20 &quot;data-x=&quot;2 &quot;data-y=&quot;0 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell21 &quot;data-x=&quot;2 &quot;data-y=&quot;1 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;td &gt;&lt;div id=&quot;cell22 &quot;data-x=&quot;2 &quot;data-y=&quot;2 &quot;class=&quot;cell &quot;py-click=&quot;GAME.click &quot;&gt;&lt;/div &gt;&lt;/td &gt;&lt;/tr &gt;&lt;/table &gt;&lt;h2 id=&quot;status &quot;&gt;&lt;/h2 &gt;&lt;button id=&quot;btn-new-game &quot;py-click=&quot;GAME.new_game &quot;&gt;New game &lt;/button &gt;&lt;button id=&quot;btn-toggle-terminal &quot;py-click=&quot;GAME.toggle_terminal &quot;&gt;Hide/show terminal &lt;/button &gt;&lt;div id=&quot;terminal &quot;hidden=&quot;hidden &quot;&gt;&lt;script id=&quot;console &quot;type=&quot;py &quot;terminal &gt;&lt;/script &gt;&lt;/div &gt;&lt;/section &gt;&lt;svg style=&quot;z-index:9997;position:fixed;bottom:0;right:0 &quot;viewBox=&quot;0 0 315 27 &quot;width=&quot;315 &quot;height=&quot;27 &quot;&gt;&lt;path d=&quot;M143.905 0.043004L85.585 0.105C75.385 0.0870005 66.415 1.866 58.655 5.535C50.765 9.265 42.855 12.989 34.975 16.73C27.165 20.443 26.057 22.638 15.778 22.501C5.775 22.368 2.44 26.781 0 26.781L0.545006 26.693C22.005 26.672 43.455 26.676 64.915 26.676C90.655 26.676 116.395 26.665 142.135 26.699C143.115 26.699 143.915 26.259 143.915 25.707C143.855 11.729 143.855 14.026 143.915 0.0490007L143.905 0.043004Z &quot;fill=&quot;#292929 &quot;&gt;&lt;/path &gt;&lt;path d=&quot;M140.258 0L315 0.340524L314.966 27L140 26.9616L140.258 0Z &quot;fill=&quot;#292929 &quot;&gt;&lt;/path &gt;&lt;/svg &gt;&lt;div style=&quot;z-index:9998;font-family:sans-serif;background-color:#292929;padding:2px 8px;position:fixed;bottom:0;right:0;left:0 &quot;&gt;&lt;/div &gt;&lt;div style=&quot;z-index:9999;color:white;font-size: 0.7rem;font-family:sans-serif;padding: 5px;position:fixed;bottom:0;right:0 &quot;&gt;&lt;a href=&quot;https://pyscript.com/@wuyuan &quot;id=&quot;made-on &quot;target=&quot;_blank &quot;style=&quot;color:#FFF;text-decoration:none;&quot;&gt;Made on pyscript.com &lt;/a &gt;&amp;nbsp;│&amp;nbsp;&lt;a href=&quot;https://pyscript.com/@wuyuan/tic-tac-toe-copy/latest &quot;id=&quot;view-code &quot;target=&quot;_blank &quot;style=&quot;color:#FFF;text-decoration:none;&quot;&gt;View Code &lt;/a &gt;&lt;span id=&quot;install-pwa-section &quot;hidden &gt;&amp;nbsp;│&amp;nbsp; &lt;a id=&quot;install-pwa &quot;style=&quot;cursor:pointer; color:#FFF;&quot;&gt;Install &lt;/a &gt;&lt;/span &gt;&amp;nbsp;&amp;nbsp &lt;/div &gt;&lt;script &gt;let installPrompt = null; const installSection = document.querySelector(&quot;#install-pwa-section &quot;) const installButton = document.querySelector(&quot;#install-pwa &quot;);  window.addEventListener(&quot;beforeinstallprompt &quot;, (event) =&gt;{   if (&quot;onappinstalled &quot;in window) {     installSection.removeAttribute(&quot;hidden &quot;)   }   event.preventDefault();   installPrompt = event; });  installButton.addEventListener(&quot;click &quot;, async () =&gt;{   if (!installPrompt) {     return;   }   const result = await installPrompt.prompt();   disableInAppInstallPrompt(); });  function disableInAppInstallPrompt() {   installPrompt = null;   installButton.setAttribute(&quot;hidden &quot;, &quot;&quot;); }; &lt;/script &gt;&lt;script &gt;const heap_app_id = &quot;758475466 &quot;;   // Only add analytics if we got an id   if (heap_app_id) {     // Analytics code     window.heap=window.heap||[],heap.load=function(e,t){window.heap.appid=e,window.heap.config=t=t||{};var r=document.createElement(&quot;script &quot;);r.type=&quot;text/javascript &quot;,r.async=!0,r.src=&quot;https://cdn.heapanalytics.com/js/heap-&quot;+e+&quot;.js &quot;;var a=document.getElementsByTagName(&quot;script &quot;)[0];a.parentNode.insertBefore(r,a);for(var n=function(e){return function(){heap.push([e].concat(Array.prototype.slice.call(arguments,0)))}},p=[&quot;addEventProperties &quot;,&quot;addUserProperties &quot;,&quot;clearEventProperties &quot;,&quot;identify &quot;,&quot;resetIdentity &quot;,&quot;removeEventProperty &quot;,&quot;setEventProperties &quot;,&quot;track &quot;,&quot;unsetEventProperty &quot;],o=0;o &lt;p.length;o++)heap[p[o]]=n(p[o])};     heap.load(heap_app_id);      // Add event listener to the made-on link     document.querySelector(&quot;#made-on &quot;).addEventListener(&quot;click &quot;, () =&gt;{       heap.track(&quot;PSADC - Make on Pyscript &quot;);     });     // Add event listener to the view-code link     document.querySelector(&quot;#view-code &quot;).addEventListener(&quot;click &quot;, () =&gt;{       heap.track(&quot;PSADC - View Code &quot;);     });     // Add event listener to the install-pwa link     document.querySelector(&quot;#install-pwa &quot;).addEventListener(&quot;click &quot;, () =&gt;{       heap.track(&quot;PSADC - Install PWA &quot;);     });   } &lt;/script &gt;&lt;/body &gt;&lt;/html &gt;");
console.log(escapedHtml);

function encodeHtmlInJson(jsonObj) {
  // 检查是否为对象或数组
  if (typeof jsonObj === 'object' && jsonObj !== null) {
      // 遍历对象的每个键
      for (let key in jsonObj) {
          if (jsonObj.hasOwnProperty(key)) {
              // 递归调用处理嵌套的对象或数组
              jsonObj[key] = encodeHtmlInJson(jsonObj[key]);
          }
      }
  } else if (typeof jsonObj === 'string' || typeof jsonObj === 'number') {
      // 将数值或字符串类型的值与指定的字符串连接
      return encode(jsonObj.toString());
  }
  // 返回处理后的对象
  return jsonObj;
}

function decodeHtmlInJson(jsonObj) {
  // 检查是否为对象或数组
  if (typeof jsonObj === 'object' && jsonObj !== null) {
      // 遍历对象的每个键
      for (let key in jsonObj) {
          if (jsonObj.hasOwnProperty(key)) {
              // 递归调用处理嵌套的对象或数组
              jsonObj[key] = decodeHtmlInJson(jsonObj[key]);
          }
      }
  } else if (typeof jsonObj === 'string' || typeof jsonObj === 'number') {
      // 将数值或字符串类型的值与指定的字符串连接
      return decode(jsonObj.toString());
  }
  // 返回处理后的对象
  return jsonObj;
}

// 示例使用
const inputJson = {
  "1": {
      "2": "3"
  },
  "33": "44",
  "nested": {
      "level1": {
          "level2": "<>"
      }
  }
};

const appendString = "1";
const outputJson = encodeHtmlInJson(inputJson, appendString);
console.log(outputJson);
