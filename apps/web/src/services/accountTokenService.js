import request from "@/axios/axios";

// 创建令牌
export function createAccountToken(data, sudoToken) {
  const headers = {};
  if (sudoToken) {
    headers['X-Sudo-Token'] = sudoToken;
  }
  return request({
    url: "/accounttoken/create",
    method: "post",
    data,
    headers,
  });
}

// 获取令牌列表
export function getAccountTokens() {
  return request({
    url: "/accounttoken/list",
    method: "get",
  });
}

// 删除令牌
export function deleteAccountToken(id) {
  return request({
    url: `/accounttoken/delete/${id}`,
    method: "delete",
  });
}

// 吊销令牌
export function revokeAccountToken(id) {
  return request({
    url: `/accounttoken/revoke/${id}`,
    method: "post",
  });
}
