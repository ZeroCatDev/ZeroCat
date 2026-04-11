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

export function retrievePassword(data) {
  return request({
    url: "/account/send-code",
    method: "post",
    data,
  });
}

export function registerUser(data) {
  return request({
    url: "/account/register",
    method: "post",
    data,
  });
}

export function validateMagicLink(token) {
  return request({
    url: `/account/magiclink/validate?token=${token}`,
    method: "get",
  });
}

export function generateMagicLink(data) {
  return request({
    url: "/account/magiclink/generate",
    method: "post",
    data,
  });
}

export function loginUser(data) {
  return request({
    url: "/account/login",
    method: "post",
    data,
  });
}

export function resetPassword(data) {
  return request({
    url: "/account/reset-password",
    method: "post",
    data,
  });
}

// New authentication API functions

export function refreshToken() {
  return request({
    url: "/account/refresh-token",
    method: "post",
  });
}

export function logout() {
  return request({
    url: "/account/logout",
    method: "post",
  });
}

export function logoutAllDevices() {
  return request({
    url: "/account/logout-all-devices",
    method: "post",
  });
}

export function getDevices() {
  return request({
    url: "/account/devices",
    method: "get",
  });
}

export function getActiveTokens() {
  return request({
    url: "/account/active-tokens",
    method: "get",
  });
}

export function revokeToken(tokenId) {
  return request({
    url: "/account/revoke-token",
    method: "post",
    data: {
      token_id: tokenId
    },
  });
}

// Email verification and management methods
export function resendVerificationEmail(token) {
  return request({
    url: "/account/register/resend-verification-email",
    method: "post",
    data: {
      token
    },
  });
}

export function changeRegisterEmail(token, email) {
  return request({
    url: "/account/register/change-register-email",
    method: "post",
    data: {
      token,
      email
    },
  });
}

export function verifyEmail(email, code) {
  return request({
    url: "/account/register/verify-email",
    method: "post",
    data: {
      email,
      code
    },
  });
}
