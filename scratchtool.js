const apiHost = localStorage.getItem("ZeroCat_Apihost") || "<%= process.env.APIHOST %>";
const assetHost = "<%= process.env.ASSETSHOST %>";

window.apiHost = apiHost;
window.apihost = apiHost;
window.assetHost = assetHost;
window.assethost = assetHost;

let _pid = 0;
let logText,
  zctab,
  userinfo = {},
  projectjson = "null",
  projectinfo = {};
window.projectinfo = projectinfo;

const buttons = [
  {
    id: "open-zerocat-tab",
    text: "信息",
    onclick: () => (zctab.open = true),
  },
  { id: "push-button", text: "推送", onclick: () => pushProject() },
  { id: "save-button", text: "保存", onclick: () => saveproject({force:false}) },
];

function getQueryString(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function getTime() {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
}

function removeQuery(url, query) {
  const urlObj = new URL(url);
  urlObj.searchParams.delete(query);
  return urlObj.toString();
}

function snackbar(text) {
  mdui.snackbar({ message: text, closeable: true });
}

// JWT 解析函数
function jwtDecode(token) {
  function b64DecodeUnicode(str) {
    return decodeURIComponent(
      atob(str).replace(/(.)/g, (m, p) => {
        let code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
          code = "0" + code;
        }
        return "%" + code;
      })
    );
  }

  function base64UrlDecode(str) {
    let output = str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw new Error("base64 string is not of the correct length");
    }
    try {
      return b64DecodeUnicode(output);
    } catch (err) {
      return atob(output);
    }
  }

  if (typeof token !== "string") {
    throw new Error("Invalid token specified: must be a string");
  }

  const part = token.split(".")[1];
  if (typeof part !== "string") {
    throw new Error(`Invalid token specified: missing part #2`);
  }

  let decoded;
  try {
    decoded = base64UrlDecode(part);
  } catch (e) {
    throw new Error(
      `Invalid token specified: invalid base64 for part #2 (${e.message})`
    );
  }

  try {
    return JSON.parse(decoded);
  } catch (e) {
    throw new Error(
      `Invalid token specified: invalid json for part #2 (${e.message})`
    );
  }
}

function loaduserinfo() {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const decoded = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        mdui.confirm(
          "Token 已过期，是否删除？",
          "Token 过期",
          () => {
            localStorage.removeItem("token");
            snackbar("Token 已删除");
          },
          () => {
            userinfo = decoded;
            localStorage.setItem("zc:id", String(decoded.userid));
            localStorage.setItem("zc:username", decoded.display_name);
          }
        );
      } else {
        userinfo = decoded;
        localStorage.setItem("zc:id", String(decoded.userid));
        localStorage.setItem("zc:username", decoded.display_name);
      }
    } catch (error) {
      snackbar("Token 解析失败");
    }
  } else {
    snackbar("未登录");
  }
}

function uploadAssets() {
  $.each(vm.assets, function (index, asset) {
    if (!asset.clean) {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([asset.data], { type: asset.assetType.contentType }),
        `${asset.assetId}.${asset.dataFormat}`
      );

      $.ajax({
        url: `${apiHost}/scratch/assets/${asset.assetId}.${
          asset.dataFormat
        }?token=${localStorage.getItem("token")}`,
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        success: function () {
          logText.innerText += `[${getTime()}]文件上传成功${asset.assetId}.${
            asset.dataFormat
          }\n`;
          asset.clean = true;
        },
        error: function (xhr, status, error) {
          logText.innerText += `[${getTime()}]文件上传失败${asset.assetId}.${
            asset.dataFormat
          }\nerror:${error}\n`;
        },
      });
    } else {
      logText.innerText += `[${getTime()}]文件未修改${asset.assetId}.${
        asset.dataFormat
      }\n`;
    }
  });
  snackbar("媒体库保存完成");
}

function uploadProject() {
  if (_pid === 0) {
    console.log("创建作品");
    $.ajax({
      url: `${window.apiHost}/project?token=${localStorage.getItem("token")}`,
      type: "post",
      data: JSON.stringify({
        title: "Scratch新作品",
        type: "scratch",
        devsource: vm.toJSON(),
      }),
      contentType: "application/json",
      success: function (result) {
        console.log("作品创建成功");
        location.href = "/editor.html#" + result.id;
      },
      error: function (err) {
        console.log(err);
        mdui.alert({
          headline: "创建作品出错",
          description: JSON.stringify(err),
          confirmText: "关闭",
        });
      },
    });
  } else {
    $.ajax({
      url: `${window.apiHost}/project/${
        projectinfo.id
      }/source?token=${localStorage.getItem("token")}`,
      type: "put",
      data: vm.toJSON(),
      contentType: "application/json",
      success: function (result) {
        console.log("作品保存成功");
        console.log(result);
        snackbar("作品保存成功");
        // 允许一键推送
        setButton("push-button", "推送", () => pushProject());
      },
      error: function (err) {
        console.log(err);
        mdui.alert({
          headline: "保存作品出错",
          description: JSON.stringify(err),
          confirmText: "关闭",
        });
      },
    });
  }
}

function pushProject() {
  setButton("push-button", "推送中", () => pushProject());
  $.ajax({
    url: `${window.apiHost}/project/${_pid}/push?token=${localStorage.getItem(
      "token"
    )}`,
    type: "post",
    success: function () {
      snackbar("推送成功");
      setButton("push-button", "推送完成", () => pushProject());
    },
    error: function (err) {
      console.log(err);
      mdui.alert({
        headline: "推送作品出错",
        description: JSON.stringify(err),
        confirmText: "关闭",
      });
    },
  });
}

function getprojectinfo() {
  if (_pid !== 0 && Number.isInteger(_pid)) {
    $.ajax({
      url: `${apiHost}/scratch/projectinfo2?id=${_pid}`,
      type: "GET",
      data: { token: localStorage.getItem("token") },
      success: function (result) {
        if (result.status == "404") {
          location.href = "/editor.html?msg=404";
          return;
        }
        projectinfo = result;
        if (zctab) {
          zctab.headline = result.title;
          zctab.description = `用户ID：${result.author.id}，作品ID：${
            result.id
          } ，${
            String(result.author.id) === String(userinfo.userid)
              ? "是你的作品"
              : "不是你的作品"
          }`;
        }

        if (String(result.author.id) !== String(userinfo.userid)) {
          setButton("push-button", "改编", () =>
            window.open(`/projects/${_pid}/fork`)
          );
        }
      },
      error: function (err) {
        alert(err);
      },
    });
  }
}

window.onload = function () {
  const msg = getQueryString("msg");
  if (msg) {
    if (msg == "404") alert("作品不存在");
    if (msg == "401") alert("请先登录");
  }

  zctab = document.querySelector("#zerocat-tab");
  logText = document.querySelector("#log-text");

  const zerocatool = document.getElementById("zerocatool");
  zerocatool.style.display = "none";
  buttons.forEach((button) => {
    const btnElement = zerocatool.cloneNode(true);
    btnElement.id = button.id;
    btnElement.innerText = button.text;
    if (button.onclick) btnElement.onclick = button.onclick;
    btnElement.style.display = "inline-block";
    zerocatool.parentNode.appendChild(btnElement);
  });

  // Ensure buttons are created before updating them
  loaduserinfo();
  setButton(
    "push-button",
    _pid === 0 ? "新建并保存" : "推送",
    _pid === 0 ? () => saveproject({force:false}) : () => pushProject()
  );
  load();
};

function zctabopen() {
  zctab.open = true;
}
function forkdialogopen() {
  forkdialog.open = true;
}
function setinfotabopen() {
  setinfotab.open = true;
}
function pushdialogopen() {
  pushdialog.open = true;
}

window.zctabopen = zctabopen;
window.forkdialogopen = forkdialogopen;
window.setinfotabopen = setinfotabopen;
window.pushdialogopen = pushdialogopen;

let isLoading = false;

// 添加HTML创建提示框
document.body.insertAdjacentHTML('beforeend', `
  <mdui-dialog
    headline="加载中"
    description="正在加载作品，请稍候..."
    close-on-overlay-click
    class="loading-dialog"
  ></mdui-dialog>
`);

const loadingDialog = document.querySelector(".loading-dialog");

function load() {
  if (isLoading) return;
  isLoading = true;

  console.log("Loading project...");
  const queryId = getQueryString("id");
  if (queryId) {
    _pid = Number(queryId);
    console.log(`Project ID from query: ${_pid}`);
  }
  if (_pid === 0) {
    console.log("No project ID found, redirecting to new project page.");
    window.location.href = `${apiHost}/newproject`;
    return;
  }
  if (_pid !== 0) {
    console.log(`Fetching project info for ID: ${_pid}`);
    getprojectinfo();
    downloadAndLoadProject(_pid);
  }
  setButton("push-button", "推送", () => pushProject());
}

function downloadAndLoadProject(pid) {
  console.log(`Downloading project with ID: ${pid}`);
  loadingDialog.open = true;

  $.ajax({
    url: `${apiHost}/project/${pid}/source`,
    type: "GET",
    data: { token: localStorage.getItem("token") },
    success: function (projectData) {
      console.log("Project data downloaded successfully.");
      vm.loadProject(JSON.parse(projectData))
        .then(() => {
          console.log("Project loaded into VM successfully.");
          loadingDialog.open = false;
          isLoading = false;
        })
        .catch((err) => {
          console.error("Error loading project into VM:", err);
          loadingDialog.open = false;
          mdui.alert({
            headline: "加载失败",
            description: `作品加载失败: ${err.message}`,
            confirmText: "OK",
            onConfirm: () => console.log("confirmed"),
          });
          isLoading = false;
        });
    },
    error: function (err) {
      console.error("Error downloading project data:", err);
      loadingDialog.open = false;
      mdui.alert({
        headline: "加载失败",
        description: `作品加载失败: ${err.responseText}`,
        confirmText: "OK",
        onConfirm: () => console.log("confirmed"),
      });
      isLoading = false;
    }
  });
}

window.scratchConfig = {
  handleProjectLoaded: load,
  handleDefaultProjectLoaded: () => {
    if (isLoading) return;
    isLoading = true;

    console.log("Default project loaded.");
    const queryId = getQueryString("id");
    if (queryId) {
      _pid = Number(queryId);
      console.log(`Project ID from query: ${_pid}`);
    }
    if (_pid === 0) {
      console.log("No project ID found, redirecting to new project page.");
      window.location.href = `${apiHost}/newproject`;
      return;
    }
    setButton("push-button", "推送", () => pushProject());
    downloadAndLoadProject(_pid);
  },
};

function saveproject({force = false} = {}) {
  setButton("save-button", "保存中", () => saveproject(force));
  uploadAssets();
  if (force == true) {
    snackbar("强制保存");
    uploadProject();
  }
  if (vm.runtime.isRunning) {
    vm.runtime.stopAll();
  }
  if (projectjson == vm.toJSON()) {
    snackbar("作品未修改");
    setButton("save-button", "保存", () => saveproject({force:false}));

    return;
  }
  if (String(projectinfo.author.id) !== String(userinfo.userid)) {
    snackbar("无权限");
    setButton("save-button", "无权限", () => saveproject({force:false}));
    return;
  }
  projectjson = vm.toJSON();
  uploadProject();
  snackbar("保存完成");
  setButton("save-button", "保存完成", () => saveproject({force:false}));

  logText.innerText += `[${getTime()}]保存完成\n`;
  setButton("push-button", "推送", () => pushProject());
}

function setButton(id, text, onclick) {
  const button = document.getElementById(id);
  if (button) {
    button.innerText = text;
    button.onclick = onclick;
  }
}

function openBase64ImageInNewTab() {
  vm.renderer.requestSnapshot(dataURI => {
    const imgWindow = window.open('', '_blank');
    imgWindow.document.write('<img src="' + dataURI + '" />');
  });
}

function setProjectThumbnail() {
  vm.renderer.requestSnapshot(async dataURI => {
    try {
      const blob = await (await fetch(dataURI)).blob();
      const formData = new FormData();
      formData.append("file", blob, "thumbnail.png");

      const response = await fetch(`${apiHost}/scratch/thumbnail/${_pid}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      });

      if (response.ok) {
        snackbar("封面设置成功");
      } else {
        snackbar("封面设置失败");
      }
    } catch (error) {
      console.error("Error setting project thumbnail:", error);
      snackbar("封面设置失败");
    }
  });
}

buttons.push({ id: "set-thumbnail-button", text: "设为封面", onclick: () => setProjectThumbnail() });
