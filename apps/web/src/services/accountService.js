import request from "@/axios/axios";

export function getAccount() {
  return request({
    url: `/user/me`,
    method: "get",
  });
}

export function updateUserInfo(data) {
  return request({
    url: "/my/set/userInfo",
    method: "post",
    data,
  });
}

export function updateUsername(data, sudoToken) {
  const headers = {};
  if (sudoToken) {
    headers['X-Sudo-Token'] = sudoToken;
  }
  return request({
    url: "/my/set/username",
    method: "post",
    data,
    headers,
  });
}

export function updatePassword(data, sudoToken) {
  const headers = {};
  if (sudoToken) {
    headers['X-Sudo-Token'] = sudoToken;
  }
  return request({
    url: "/my/set/pw",
    method: "post",
    data,
    headers,
  });
}

export function uploadUserAvatar(queryParams, formData) {
  return request({
    url: `/my/set/avatar?${queryParams}`,
    method: "post",
    data: formData,
    headers: {"Content-Type": "multipart/form-data"},
  });
}
