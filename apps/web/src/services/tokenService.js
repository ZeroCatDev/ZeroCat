import request from "@/axios/axios";

// 创建个人令牌 (需要 sudo)
export function createToken(data, sudoToken) {
  const headers = {};
  if (sudoToken) {
    headers["X-Sudo-Token"] = sudoToken;
  }
  return request({
    url: "/tokens",
    method: "post",
    data,
    headers,
  });
}

// 获取当前用户的个人令牌列表
export function getTokens() {
  return request({
    url: "/tokens",
    method: "get",
  });
}

// 获取单个令牌详情
export function getToken(id) {
  return request({
    url: `/tokens/${id}`,
    method: "get",
  });
}

// 吊销 (删除) 令牌
export function revokeToken(id) {
  return request({
    url: `/tokens/${id}`,
    method: "delete",
  });
}

// 获取可授予的 scope 目录
export function getScopeCatalog() {
  return request({
    url: "/tokens/scopes",
    method: "get",
  });
}

// 内省令牌: 输入任意令牌, 返回其归属与元数据 (调试)
export function introspectToken(token) {
  return request({
    url: "/tokens/introspect",
    method: "post",
    data: { token },
  });
}

// 当前请求令牌的权限上下文 (调试)
export function getCurrentTokenDebugContext() {
  return request({
    url: "/tokens/debug/current",
    method: "get",
  });
}

// 评估当前请求是否满足指定 scope (调试)
export function evaluateTokenScopes(scope) {
  return request({
    url: "/tokens/debug/evaluate",
    method: "post",
    data: { scope },
  });
}
