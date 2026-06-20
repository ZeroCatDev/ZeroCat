#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_API_URL = "http://localhost:3000";

const SAFE_PROBES = [
  {
    scope: "user:read",
    label: "读取账户资料",
    method: "GET",
    path: "/user/me",
  },
  {
    scope: "user:update",
    label: "修改账户资料",
    method: "POST",
    path: "/user/change-username",
    body: {},
  },
  {
    scope: "notification:read",
    label: "读取通知",
    method: "GET",
    path: "/notifications/unread-count",
  },
  {
    scope: "notification:update",
    label: "更新通知状态",
    method: "PUT",
    path: "/notifications/read",
    body: {},
  },
  {
    scope: "asset:read",
    label: "读取素材",
    method: "GET",
    path: "/assets/list?limit=1",
  },
  {
    scope: "asset:create",
    label: "上传素材",
    method: "POST",
    path: "/assets/upload",
    body: {},
  },
  {
    scope: "post:create",
    label: "发布推文/图片",
    method: "POST",
    path: "/posts/upload-image",
    body: {},
  },
  {
    scope: "post:interact",
    label: "推文互动",
    method: "POST",
    path: "/posts/0/like",
    body: {},
  },
  {
    scope: "post:delete",
    label: "删除推文",
    method: "DELETE",
    path: "/posts/0",
  },
  {
    scope: "project:read",
    label: "读取项目分析",
    method: "GET",
    path: "/project/analytics/0?start_date=2020-01-01&end_date=2020-01-02",
  },
  {
    scope: "project:create",
    label: "创建项目/分支",
    method: "POST",
    path: "/project/branches",
    body: {},
  },
  {
    scope: "project:update",
    label: "修改项目",
    method: "PUT",
    path: "/project/id/0",
    body: {},
  },
  {
    scope: "project:delete",
    label: "删除项目",
    method: "DELETE",
    path: "/project/0",
  },
  {
    scope: "project:manage",
    label: "管理项目设置",
    method: "PUT",
    path: "/project/changevisibility/0",
    body: {},
  },
  {
    scope: "token:read",
    label: "读取令牌列表",
    method: "GET",
    path: "/tokens",
  },
  {
    scope: "oauth_app:manage",
    label: "管理 OAuth 应用",
    method: "POST",
    path: "/oauth/applications",
    body: {},
  },
];

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_API_URL).trim();
  return raw.replace(/\/+$/, "");
}

function formatScope(scope, catalogMap) {
  const item = catalogMap.get(scope);
  return item?.title ? `${item.title} (${scope})` : scope;
}

function statusIcon(result) {
  if (result.kind === "allowed") return "OK";
  if (result.kind === "denied") return "NO";
  if (result.kind === "auth_failed") return "AUTH";
  if (result.kind === "error") return "ERR";
  return "WARN";
}

function firstText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(firstText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return value.message || value.error || value.description || value.code || "";
  }
  return String(value);
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(baseUrl, token, probe) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  const init = {
    method: probe.method || "GET",
    headers,
  };

  if (probe.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(probe.body);
  }

  try {
    const response = await fetch(`${baseUrl}${probe.path}`, init);
    const data = await readResponse(response);
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { message: error.message },
      networkError: true,
    };
  }
}

function classify(result) {
  const code = result.data?.code;
  const message = firstText(result.data);

  if (result.networkError) {
    return {
      kind: "error",
      detail: message || "网络请求失败",
    };
  }

  if (result.status === 401 || code === "ZC_ERROR_NEED_LOGIN" || code === "ZC_ERROR_NEED_LOGOUT") {
    return {
      kind: "auth_failed",
      detail: message || "令牌无效或未登录",
    };
  }

  if (code === "ZC_ERROR_INSUFFICIENT_SCOPE" || result.data?.required) {
    return {
      kind: "denied",
      detail: result.data?.required ? `缺少 ${result.data.required}` : message || "权限不足",
    };
  }

  if (result.status === 403 && String(code || "").startsWith("SUDO_")) {
    return {
      kind: "allowed",
      detail: `${code}: scope 已通过，后续需要 Sudo`,
    };
  }

  if (result.status >= 200 && result.status < 300) {
    return {
      kind: "allowed",
      detail: `HTTP ${result.status}`,
    };
  }

  if ([400, 404, 409, 422].includes(result.status)) {
    return {
      kind: "allowed",
      detail: `HTTP ${result.status}: scope 已通过，接口返回业务校验错误`,
    };
  }

  if (result.status === 403) {
    return {
      kind: "warning",
      detail: message || "403，但不是 scope 中间件返回的权限不足",
    };
  }

  return {
    kind: "warning",
    detail: message ? `HTTP ${result.status}: ${message}` : `HTTP ${result.status}`,
  };
}

async function promptForConfig() {
  const rl = readline.createInterface({ input, output });
  try {
    const envUrl = process.env.ZC_API_URL;
    const envToken = process.env.ZC_TOKEN;
    const urlAnswer = envUrl || await rl.question(`后端地址 [${DEFAULT_API_URL}]: `);
    const tokenAnswer = envToken || await rl.question("令牌 (zc_...): ");

    return {
      baseUrl: normalizeBaseUrl(urlAnswer || DEFAULT_API_URL),
      token: String(tokenAnswer || "").trim(),
    };
  } finally {
    rl.close();
  }
}

async function main() {
  const { baseUrl, token } = await promptForConfig();

  if (!token) {
    console.error("未提供令牌。也可以使用环境变量 ZC_TOKEN。");
    process.exitCode = 1;
    return;
  }

  console.log(`\n目标后端: ${baseUrl}`);

  const health = await request(baseUrl, token, { method: "GET", path: "/check" });
  if (health.status === 0) {
    console.error(`后端不可达: ${firstText(health.data)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`健康检查: HTTP ${health.status}`);

  const catalogResult = await request(baseUrl, token, { method: "GET", path: "/tokens/scopes" });
  const catalog = Array.isArray(catalogResult.data?.data) ? catalogResult.data.data : [];
  const catalogMap = new Map(catalog.map((item) => [item.name, item]));
  console.log(`权限目录: ${catalog.length || 0} 项`);

  const introspect = await request(baseUrl, token, {
    method: "POST",
    path: "/tokens/introspect",
    body: { token },
  });
  const tokenInfo = introspect.data?.data;
  if (introspect.status === 401) {
    console.error("令牌无法通过登录校验，请检查令牌是否过期、吊销或后端地址是否正确。");
    process.exitCode = 1;
    return;
  }

  if (tokenInfo?.found) {
    console.log(`令牌状态: ${tokenInfo.active ? "有效" : "无效"} (${tokenInfo.type || "unknown"})`);
    const scopes = Array.isArray(tokenInfo.scopes) ? tokenInfo.scopes : [];
    console.log("授予权限:");
    for (const scope of scopes) {
      console.log(`  - ${formatScope(scope, catalogMap)}`);
    }
  } else {
    console.log("令牌内省: 未找到该令牌，仍会继续用接口响应判断。");
  }

  console.log("\n权限探测:");
  let deniedCount = 0;
  let errorCount = 0;

  for (const probe of SAFE_PROBES) {
    const response = await request(baseUrl, token, probe);
    const classified = classify(response);
    if (classified.kind === "denied") deniedCount += 1;
    if (classified.kind === "error" || classified.kind === "auth_failed") errorCount += 1;
    const label = `${probe.label} - ${formatScope(probe.scope, catalogMap)}`;
    console.log(`${statusIcon(classified).padEnd(4)} ${label}`);
    console.log(`     ${classified.detail}`);
  }

  console.log("\n结果说明:");
  console.log("OK 表示权限检查已通过；若详情是 400/404/Sudo，是 CLI 故意发送无效参数以避免产生副作用。");
  console.log("NO 表示后端 scope 中间件明确拒绝。AUTH/ERR 需要先修正令牌或后端连接。");

  if (deniedCount > 0) {
    console.log(`\n有 ${deniedCount} 项权限被拒绝；这代表令牌未授予对应 scope。`);
  }

  if (errorCount > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
