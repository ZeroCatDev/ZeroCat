import axios from "axios";
import { AUTH_EVENTS, createBrowserAuthClient } from "@zerocat/auth-core";

// 基本配置
const BASE_URL = import.meta.env.VITE_APP_BASE_API;

// 业务请求实例
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export const authClient = createBrowserAuthClient({ apiUrl: BASE_URL, cookieRefresh: true });

// 后端统一错误码
const ZC_ERROR = {
  NEED_LOGIN: "ZC_ERROR_NEED_LOGIN",   // 未携带令牌
  NEED_LOGOUT: "ZC_ERROR_NEED_LOGOUT", // 令牌无效/过期/已吊销/刷新失败
  FORBIDDEN: "ZC_ERROR_FORBIDDEN",     // 已登录但无权限
};

export const TOKEN_REFRESHED_EVENT_NAME = AUTH_EVENTS.tokenRefreshed;

// 防止并发请求触发重复跳转
let isRedirecting = false;

const getErrorCode = (error) => error?.response?.data?.code || error?.code;

/**
 * 清除本地所有认证相关状态
 */
const clearLocalAuth = () => {
  authClient.clearStoredAuthState();
  localStorage.removeItem("sudo_token");
  localStorage.removeItem("sudo_token_expires_at");
  localStorage.removeItem("sudo_token_duration");
};

/**
 * 处理 ZC_ERROR_NEED_LOGOUT：令牌已失效（过期/吊销/刷新失败等）
 * 清除本地令牌 → 通知 store → 跳转登录页
 */
export const handleNeedLogout = () => {
  if (isRedirecting) return;
  isRedirecting = true;

  clearLocalAuth();
  window.dispatchEvent(new CustomEvent("forceLogout"));
  window.location.href = "/?reason=session_expired";
};

/**
 * 处理 ZC_ERROR_NEED_LOGIN：刷新令牌也失败后
 * 清除本地登录态 → 通知 store → 跳转登录页
 */
export const handleNeedLogin = () => {
  if (isRedirecting) return;
  isRedirecting = true;

  clearLocalAuth();
  window.dispatchEvent(new CustomEvent("forceLogout"));
  window.location.href = "/";
};

export const requestTokenRefresh = async () => {
  return authClient.refreshStoredAuthToken();
};

export const isTokenRefreshInFlight = () => authClient.isRefreshInFlight();

// 请求拦截器：附加 access token
axiosInstance.interceptors.request.use(
  (config) => {
    const t = authClient.getStoredToken();

    config.headers = config.headers || {};

    if (t) {
      config.headers.Authorization = `Bearer ${t}`;
    } else {
      try {
        delete config.headers.Authorization;
      } catch {}
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：根据后端统一错误码处理认证问题
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const response = error?.response;

    // 没有响应（网络断开/超时）直接抛出
    if (!response || !originalRequest) {
      return Promise.reject(error);
    }

    const errorCode = getErrorCode(error);

    // ZC_ERROR_NEED_LOGOUT 或 ZC_ERROR_NEED_LOGIN：
    // 先尝试刷新令牌，刷新成功则重放请求；仅在刷新失败时才清除登录态并跳转
    const needsAuth =
      errorCode === ZC_ERROR.NEED_LOGOUT || errorCode === ZC_ERROR.NEED_LOGIN;

    if (needsAuth && !originalRequest._retryAfterRefresh) {
      originalRequest._retryAfterRefresh = true;

      try {
        const newToken = await requestTokenRefresh();
        if (!newToken) throw new Error("Refresh token failed");
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch {
        // 刷新令牌失败，清除登录态并跳转
        if (errorCode === ZC_ERROR.NEED_LOGOUT) {
          handleNeedLogout();
        } else {
          handleNeedLogin();
        }
        return Promise.reject(error);
      }
    }

    // 重试过仍然需要认证，直接跳转
    if (needsAuth) {
      if (errorCode === ZC_ERROR.NEED_LOGOUT) {
        handleNeedLogout();
      } else {
        handleNeedLogin();
      }
      return Promise.reject(error);
    }

    // 其他错误（包括 ZC_ERROR_FORBIDDEN）由调用方自行处理
    return Promise.reject(error);
  }
);

export default axiosInstance;
