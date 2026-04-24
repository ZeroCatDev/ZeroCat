import { ref } from "vue";
import { defineStore } from "pinia";
import axiosInstance, {
  requestTokenRefresh,
  handleNeedLogout,
  TOKEN_REFRESHED_EVENT_NAME,
} from "@/axios/axios";
import { get } from "@/services/serverConfig";
import { pushNotificationService } from "@/services/pushNotificationService.js";

// Constants for storage keys
const USER_INFO_KEY = "userInfo";
const TOKEN_KEY = "token";
const TOKEN_EXPIRES_AT_KEY = "tokenExpiresAt";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "refreshTokenExpiresAt";
const AUTH_REDIRECT_URL_KEY = "auth_redirect_url";

// Token refresh configuration
const AUTO_REFRESH_ENABLED = true;
const MAX_REFRESH_RETRIES = 2;
const MAX_SCHEDULE_INTERVAL_MS = 30 * 60 * 1000; // Cap timer at 30 minutes
const UNKNOWN_EXP_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 min if exp unknown
const RETRY_BACKOFF_BASE_MS = 10_000; // 10 seconds base for retry backoff
const RETRY_BACKOFF_CAP_MS = 30_000; // 30 seconds max retry delay
const FALLBACK_RETRY_INTERVAL_MS = 60_000; // 60 seconds fallback after max retries

// Adaptive threshold: refresh at 25% of token lifetime remaining,
// clamped between 30s and 5min.  For a 5-min token → 75s before expiry.
const MIN_REFRESH_THRESHOLD_SEC = 30;
const MAX_REFRESH_THRESHOLD_SEC = 5 * 60;
const REFRESH_THRESHOLD_RATIO = 0.25;

// --- Internal helpers (not exported) ---

const AUTH_REDIRECT_ALLOWLIST_RAW =
  import.meta.env.VITE_AUTH_REDIRECT_ALLOWED_ORIGINS ||
  import.meta.env.VITE_AUTH_REDIRECT_ALLOWLIST ||
  "";

const AUTH_REDIRECT_ALLOWLIST = String(AUTH_REDIRECT_ALLOWLIST_RAW)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const isPrivateIpv4 = (hostname) => {
  const match = String(hostname).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const octets = match.slice(1).map((value) => Number.parseInt(value, 10));
  if (octets.some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 169 && second === 254)
  );
};

const isLocalHostname = (hostname) => {
  if (!hostname) return false;
  const normalized = String(hostname).toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
  if (normalized === "::1" || normalized === "::ffff:127.0.0.1") {
    return true;
  }
  return isPrivateIpv4(normalized);
};

const getRootDomain = (hostname) => {
  if (!hostname) return null;
  const normalized = String(hostname).toLowerCase();
  if (isLocalHostname(normalized) || /^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)) {
    return null;
  }

  const parts = normalized.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join(".");
};

const safeDecodeURIComponent = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const isAllowedByAllowlist = (targetUrl) => {
  if (!AUTH_REDIRECT_ALLOWLIST.length) return false;

  const targetHostname = targetUrl.hostname.toLowerCase();
  const targetOrigin = targetUrl.origin.toLowerCase();

  return AUTH_REDIRECT_ALLOWLIST.some((entry) => {
    const rule = String(entry).trim().toLowerCase();
    if (!rule) return false;

    if (rule.startsWith("http://") || rule.startsWith("https://")) {
      try {
        return new URL(rule).origin.toLowerCase() === targetOrigin;
      } catch {
        return false;
      }
    }

    if (rule.startsWith(".")) {
      const suffix = rule.slice(1);
      return targetHostname === suffix || targetHostname.endsWith(`.${suffix}`);
    }

    return targetHostname === rule || targetHostname.endsWith(`.${rule}`);
  });
};

const normalizeAuthRedirectUrl = (value) => {
  if (typeof window === "undefined") return "/";

  const raw = safeDecodeURIComponent(value);
  if (!raw) return "/";

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  let targetUrl;
  try {
    targetUrl = new URL(raw);
  } catch {
    return "/";
  }

  const protocol = targetUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return "/";
  }

  const currentUrl = new URL(window.location.href);
  if (targetUrl.origin === currentUrl.origin) {
    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  }

  const currentHostname = currentUrl.hostname.toLowerCase();
  const targetHostname = targetUrl.hostname.toLowerCase();

  if (isLocalHostname(currentHostname) && isLocalHostname(targetHostname)) {
    return targetUrl.toString();
  }

  if (isAllowedByAllowlist(targetUrl)) {
    return targetUrl.toString();
  }

  const currentRoot = getRootDomain(currentHostname);
  const targetRoot = getRootDomain(targetHostname);
  if (currentRoot && targetRoot && currentRoot === targetRoot) {
    return targetUrl.toString();
  }

  return "/";
};

const isExternalHttpUrl = (url) => {
  if (!url || typeof window === "undefined") return false;
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return false;
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const setStorageValue = (key, value) => {
  if (value === undefined || value === null || value === "") {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, String(value));
};

const parseDateTime = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).trim();
  const isNumericTs = /^\d+$/.test(raw);
  const numericValue = Number(raw);
  const date =
    isNumericTs && Number.isFinite(numericValue)
      ? new Date(numericValue < 1e12 ? numericValue * 1000 : numericValue)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// JWT exp parsing (no signature verification, local scheduling only)
const base64UrlToJson = (base64Url) => {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const str = atob(padded);
  const jsonStr = decodeURIComponent(
    Array.from(str)
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
  return JSON.parse(jsonStr);
};

const getJwtExpSeconds = (jwt) => {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = base64UrlToJson(parts[1]);
    const exp = payload?.exp;
    if (!Number.isFinite(exp)) return null;
    return exp; // seconds
  } catch {
    return null;
  }
};

const DEFAULT_USER = {
  id: 0,
  display_name: "未登录",
  bio: "未登录用户",
  avatar: "",
  regTime: "",
  sex: "0",
  username: "virtual",
};

/**
 * Token refresh scheduler.
 *
 * Manages a single setTimeout for proactive token refresh.
 * Tracks the target fire time so we can detect when the browser
 * has throttled the timer (e.g., backgrounded tab) and act on
 * visibility change.
 */
const TokenRefreshScheduler = {
  _timer: null,
  _targetTime: null,

  clear() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    this._targetTime = null;
  },

  schedule(callback, delayMs) {
    this.clear();
    const d = Math.max(0, Math.round(delayMs));
    this._targetTime = Date.now() + d;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._targetTime = null;
      Promise.resolve(callback()).catch((err) => {
        console.error("[TokenRefresh] Scheduled callback error:", err);
      });
    }, d);
  },

  /** True if the timer should have fired but hasn't (browser throttled). */
  isOverdue() {
    if (this._targetTime === null) return false;
    return Date.now() > this._targetTime + 5000;
  },

  isActive() {
    return this._timer !== null;
  },
};

// Prevent duplicate window event binding (HMR / multiple instances)
let _listenersInstalled = false;

export const useAuthStore = defineStore("auth", () => {
  // --- S3 bucket URL ---
  const s3BucketUrl = get("s3.staticurl") || "";

  // --- Reactive state ---
  const token = ref(localStorage.getItem(TOKEN_KEY));
  const tokenExpiresAt = ref(localStorage.getItem(TOKEN_EXPIRES_AT_KEY));
  const refreshTokenExpiresAt = ref(
    localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY)
  );
  const user = ref({ ...DEFAULT_USER });
  const isLogin = ref(false);
  const devices = ref([]);
  const activeTokens = ref([]);
  const currentTokenDetails = ref(null);

  // --- Dialog & redirect ---
  const loginDialogVisible = ref(false);
  const authRedirectUrl = ref(
    sessionStorage.getItem(AUTH_REDIRECT_URL_KEY) || ""
  );

  // --- Single-flight refresh lock ---
  let refreshPromise = null;
  // Retry counter for proactive refresh cycle
  let _refreshRetryCount = 0;
  // Flag to suppress event-listener rescheduling during proactive refresh
  let _inProactiveRefresh = false;

  /**
   * Compute the effective refresh threshold based on the current token's
   * actual lifetime (exp − iat).  Returns seconds before expiry at which
   * we should trigger a proactive refresh.
   *
   *   5-min token (300s) → 25% = 75s threshold → refresh at 225s after issue
   *   1-hour token       → 25% = 900s, capped at 300s (5 min)
   *   Unknown lifetime   → falls back to MAX_REFRESH_THRESHOLD_SEC (5 min)
   */
  const getEffectiveThreshold = () => {
    const t = getToken();
    if (!t) return MAX_REFRESH_THRESHOLD_SEC;
    try {
      const parts = t.split(".");
      if (parts.length < 2) return MAX_REFRESH_THRESHOLD_SEC;
      const payload = base64UrlToJson(parts[1]);
      const { exp, iat } = payload;
      if (
        Number.isFinite(exp) &&
        Number.isFinite(iat) &&
        exp > iat
      ) {
        const lifetime = exp - iat;
        const threshold = Math.floor(lifetime * REFRESH_THRESHOLD_RATIO);
        return Math.max(
          MIN_REFRESH_THRESHOLD_SEC,
          Math.min(threshold, MAX_REFRESH_THRESHOLD_SEC)
        );
      }
    } catch {
      // JWT parse failed — fall back
    }
    return MAX_REFRESH_THRESHOLD_SEC;
  };

  // ============================
  // Login dialog
  // ============================

  const showLoginDialog = (redirectUrl) => {
    if (redirectUrl) setAuthRedirectUrl(redirectUrl);
    loginDialogVisible.value = true;
  };

  const hideLoginDialog = () => {
    loginDialogVisible.value = false;
  };

  // ============================
  // Redirect URL management
  // ============================

  const setAuthRedirectUrl = (url) => {
    const normalized = normalizeAuthRedirectUrl(url);
    authRedirectUrl.value = normalized;

    if (normalized && normalized !== "/") {
      sessionStorage.setItem(AUTH_REDIRECT_URL_KEY, normalized);
    } else {
      sessionStorage.removeItem(AUTH_REDIRECT_URL_KEY);
    }
  };

  const consumeAuthRedirectUrl = () => {
    let url =
      authRedirectUrl.value ||
      sessionStorage.getItem(AUTH_REDIRECT_URL_KEY) ||
      "";

    url = normalizeAuthRedirectUrl(url);

    authRedirectUrl.value = "";
    sessionStorage.removeItem(AUTH_REDIRECT_URL_KEY);
    return url;
  };

  const navigateToAuthRedirect = (router, fallback = "/") => {
    let target = consumeAuthRedirectUrl();

    // 避免登录成功后再次落在退出页造成体验混乱
    if (!target || target === "/app/account/logout") {
      target = fallback;
    }

    if (isExternalHttpUrl(target)) {
      window.location.assign(target);
      return target;
    }

    if (router?.push) {
      router.push(target);
      return target;
    }

    window.location.assign(target);
    return target;
  };

  // ============================
  // Token helpers
  // ============================

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const syncTokenStateFromStorage = () => {
    token.value = localStorage.getItem(TOKEN_KEY);
    tokenExpiresAt.value = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
    refreshTokenExpiresAt.value = localStorage.getItem(
      REFRESH_TOKEN_EXPIRES_AT_KEY
    );
  };

  /**
   * Returns remaining seconds for the access token.
   *  > 0 : seconds remaining
   *  0   : expired
   *  -1  : unknown (unparseable exp)
   */
  const getTokenExpirationTime = () => {
    const t = getToken();
    if (!t) return 0;

    const expSec = getJwtExpSeconds(t);
    if (Number.isFinite(expSec)) {
      const nowSec = Math.floor(Date.now() / 1000);
      return Math.max(0, expSec - nowSec);
    }

    // fallback: legacy storage-based expiration
    const expiresAt = parseDateTime(
      localStorage.getItem(TOKEN_EXPIRES_AT_KEY)
    );
    if (!expiresAt) return -1;
    const diffMs = expiresAt.getTime() - Date.now();
    if (!Number.isFinite(diffMs)) return -1;
    return Math.max(0, Math.floor(diffMs / 1000));
  };

  const isTokenValid = () => {
    const t = getToken();
    if (!t) return false;

    const exp = getTokenExpirationTime();
    if (exp < 0) return true; // Unknown expiration - assume valid; 401 will catch it
    return exp > 0;
  };

  const isRefreshTokenValid = () => {
    const refreshExpiresAt = parseDateTime(
      localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY)
    );
    // HttpOnly cookie refresh - can't check expiry, assume valid
    if (!refreshExpiresAt) return true;
    return refreshExpiresAt > new Date();
  };

  // ============================
  // User loading
  // ============================

  const fetchUserInfo = async () => {
    try {
      const response = await axiosInstance({
        url: "/user/me",
        method: "get",
      });

      const data = response.data;
      if (data.status !== "success") {
        console.warn("fetchUserInfo: non-success response", data.message);
        return;
      }

      user.value = {
        id: data.data.id,
        display_name: data.data.display_name,
        bio: data.data.bio,
        avatar: data.data.avatar,
        regTime: data.data.regTime,
        sex: data.data.sex,
        username: data.data.username,
      };
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(user.value));
      isLogin.value = true;
    } catch (error) {
      console.error("fetchUserInfo failed:", error);
    }
  };

  const loadUser = async (force) => {
    const t = getToken();
    if (!t) {
      isLogin.value = false;
      user.value = { ...DEFAULT_USER };
      return;
    }

    // If token expired on load, try refreshing first
    const exp = getTokenExpirationTime();
    if (exp === 0) {
      const ok = await refreshAccessToken();
      if (!ok) return;
    }

    if (force === true) {
      await fetchUserInfo();
      return;
    }

    const cached = localStorage.getItem(USER_INFO_KEY);
    if (cached) {
      try {
        isLogin.value = true;
        user.value = JSON.parse(cached);
      } catch {
        await fetchUserInfo();
      }
    } else {
      await fetchUserInfo();
    }
  };

  // ============================
  // Token update (after login / refresh)
  // ============================

  const updateToken = (newToken, expiresAt) => {
    if (!newToken) return false;

    setStorageValue(TOKEN_KEY, newToken);
    token.value = newToken;

    const expSec = getJwtExpSeconds(newToken);
    if (Number.isFinite(expSec)) {
      setStorageValue(TOKEN_EXPIRES_AT_KEY, expSec * 1000);
      tokenExpiresAt.value = String(expSec * 1000);
    } else if (
      expiresAt !== undefined &&
      expiresAt !== null &&
      expiresAt !== ""
    ) {
      setStorageValue(TOKEN_EXPIRES_AT_KEY, expiresAt);
      tokenExpiresAt.value = String(expiresAt);
    }

    return true;
  };

  const setUser = async (data) => {
    updateToken(data.token, data.expires_at);

    setStorageValue(REFRESH_TOKEN_EXPIRES_AT_KEY, data.refresh_expires_at);
    refreshTokenExpiresAt.value = data.refresh_expires_at || null;

    await loadUser(true);

    // Start proactive refresh cycle after login
    _refreshRetryCount = 0;
    scheduleTokenRefresh();
  };

  // ============================
  // Token refresh (single-flight)
  // ============================

  /**
   * Refresh the access token. Uses single-flight pattern to prevent
   * concurrent refresh requests.
   *
   * IMPORTANT: This method does NOT reschedule the timer.
   * The caller (doRefreshCycle / event listener) handles rescheduling.
   */
  const refreshAccessToken = async () => {
    if (!getToken() && !isRefreshTokenValid()) return false;

    // Single-flight: reuse in-progress refresh
    if (refreshPromise) return await refreshPromise;

    refreshPromise = (async () => {
      try {
        await requestTokenRefresh();
        syncTokenStateFromStorage();
        return !!getToken();
      } catch (error) {
        console.error("[TokenRefresh] Refresh failed:", error);

        const code = error?.response?.data?.code || error?.code;
        if (code === "ZC_ERROR_NEED_LOGOUT") {
          handleNeedLogout();
        }
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return await refreshPromise;
  };

  // ============================
  // Proactive refresh scheduling
  // ============================

  /**
   * Calculate the optimal delay and set a single timer for the next refresh.
   *
   * Schedule rules:
   *  - No token       -> clear timer
   *  - Token expired   -> immediate (0ms)
   *  - Within threshold -> immediate (0ms)
   *  - Outside threshold -> delay until threshold boundary (capped)
   *  - Unknown exp      -> periodic check at UNKNOWN_EXP_CHECK_INTERVAL_MS
   */
  const scheduleTokenRefresh = () => {
    if (!AUTO_REFRESH_ENABLED) return;

    const t = getToken();
    if (!t) {
      TokenRefreshScheduler.clear();
      return;
    }

    const remainingSec = getTokenExpirationTime();
    const threshold = getEffectiveThreshold();
    let delayMs;

    if (remainingSec < 0) {
      // Unknown expiration - periodic check
      delayMs = UNKNOWN_EXP_CHECK_INTERVAL_MS;
    } else if (remainingSec === 0) {
      // Already expired - refresh now
      delayMs = 0;
    } else if (remainingSec <= threshold) {
      // Within threshold - refresh now
      delayMs = 0;
    } else {
      // Not yet in threshold - schedule for threshold entry
      delayMs = (remainingSec - threshold) * 1000;
      // Cap to avoid very long timers (setTimeout drift / overflow)
      delayMs = Math.min(delayMs, MAX_SCHEDULE_INTERVAL_MS);
    }

    if (delayMs > 0) {
      console.log(
        `[TokenRefresh] Scheduled in ${Math.round(delayMs / 1000)}s` +
          (remainingSec >= 0
            ? ` (token expires in ${remainingSec}s, threshold ${threshold}s)`
            : " (unknown expiration, periodic check)")
      );
    }

    TokenRefreshScheduler.schedule(() => doRefreshCycle(), delayMs);
  };

  /**
   * Timer callback: performs the refresh and reschedules.
   * On failure, retries with linear backoff up to MAX_REFRESH_RETRIES,
   * then falls back to a longer periodic check.
   */
  const doRefreshCycle = async () => {
    const t = getToken();
    if (!t) return;

    const threshold = getEffectiveThreshold();

    // If token is still well outside threshold (e.g., cap-triggered early check),
    // just reschedule for the correct time.
    const remainingSec = getTokenExpirationTime();
    if (remainingSec > threshold) {
      _refreshRetryCount = 0;
      scheduleTokenRefresh();
      return;
    }

    // Set flag so the TOKEN_REFRESHED_EVENT_NAME listener won't double-schedule
    _inProactiveRefresh = true;
    const ok = await refreshAccessToken();
    _inProactiveRefresh = false;

    if (ok) {
      _refreshRetryCount = 0;
      scheduleTokenRefresh();
    } else {
      _refreshRetryCount++;
      if (_refreshRetryCount <= MAX_REFRESH_RETRIES) {
        const retryDelay = Math.min(
          RETRY_BACKOFF_BASE_MS * _refreshRetryCount,
          RETRY_BACKOFF_CAP_MS
        );
        console.warn(
          `[TokenRefresh] Retry ${_refreshRetryCount}/${MAX_REFRESH_RETRIES} in ${retryDelay / 1000}s`
        );
        TokenRefreshScheduler.schedule(() => doRefreshCycle(), retryDelay);
      } else {
        console.error(
          "[TokenRefresh] Max retries exceeded, backing off to " +
            `${FALLBACK_RETRY_INTERVAL_MS / 1000}s`
        );
        _refreshRetryCount = 0;
        TokenRefreshScheduler.schedule(
          () => doRefreshCycle(),
          FALLBACK_RETRY_INTERVAL_MS
        );
      }
    }
  };

  const stopTokenRefreshTimer = () => {
    TokenRefreshScheduler.clear();
    _refreshRetryCount = 0;
  };

  // Backward-compatible aliases
  const startTokenRefreshTimer = () => scheduleTokenRefresh();

  const checkAndRefreshToken = async () => {
    const t = getToken();
    if (!t) return false;
    const exp = getTokenExpirationTime();
    if (exp < 0) return true;
    if (exp <= getEffectiveThreshold()) return await refreshAccessToken();
    return true;
  };

  // ============================
  // Auth status utility
  // ============================

  const isAuthenticationNeeded = () => {
    if (isTokenValid()) return false;

    if (isRefreshTokenValid()) {
      // Don't block UI: async refresh attempt
      void refreshAccessToken();
      return false;
    }

    return true;
  };

  // ============================
  // Logout
  // ============================

  const resetStoreState = () => {
    stopTokenRefreshTimer();
    token.value = null;
    tokenExpiresAt.value = null;
    refreshTokenExpiresAt.value = null;
    user.value = { ...DEFAULT_USER };
    isLogin.value = false;
    devices.value = [];
    activeTokens.value = [];
    currentTokenDetails.value = null;
    loginDialogVisible.value = false;
    authRedirectUrl.value = "";
    refreshPromise = null;
  };

  const logout = async (logoutFromServer = true) => {
    stopTokenRefreshTimer();

    if (logoutFromServer && isLogin.value && token.value) {
      try {
        await fetch(
          `${import.meta.env.VITE_APP_BASE_API}/account/logout`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${token.value}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch {
        // Continue clearing local state regardless
      }
    }

    try {
      await pushNotificationService.unsubscribe();
    } catch {
      // ignore
    }

    // Clear localStorage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
    localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem("sudo_token");
    localStorage.removeItem("sudo_token_expires_at");
    localStorage.removeItem("sudo_token_duration");

    // Clear sessionStorage
    sessionStorage.removeItem(AUTH_REDIRECT_URL_KEY);

    resetStoreState();
    return true;
  };

  const logoutAllDevices = async () => {
    try {
      const response = await axiosInstance({
        url: "/account/logout-all-devices",
        method: "post",
      });

      if (response.data.status === "success") {
        await logout(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error during logout from all devices:", error);
      return false;
    }
  };

  // ============================
  // Devices / Sessions
  // ============================

  const getDevices = async () => {
    try {
      const response = await axiosInstance({
        url: "/account/devices",
        method: "get",
      });

      if (response.data.status === "success") {
        devices.value = response.data.data;
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error("Error fetching devices:", error);
      return [];
    }
  };

  const fetchDevices = getDevices;

  const getActiveTokens = async (includeLocation = true) => {
    try {
      const response = await axiosInstance({
        url: `/account/active-tokens${includeLocation ? "?include_location=true" : ""}`,
        method: "get",
      });

      if (response.data.status === "success") {
        activeTokens.value = response.data.data;
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error("Error fetching active tokens:", error);
      return [];
    }
  };

  const fetchActiveTokens = getActiveTokens;

  const getTokenDetails = async (tokenId, includeLocation = true) => {
    try {
      const response = await axiosInstance({
        url: `/account/token-details/${tokenId}${includeLocation ? "?include_location=true" : ""}`,
        method: "get",
      });

      if (response.data.status === "success") {
        currentTokenDetails.value = response.data.data;
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error("Error fetching token details:", error);
      return null;
    }
  };

  const fetchTokenDetails = getTokenDetails;

  const revokeToken = async (tokenId) => {
    try {
      const response = await axiosInstance({
        url: "/account/revoke-token",
        method: "post",
        data: { token_id: tokenId },
      });

      if (response.data.status === "success") {
        await getActiveTokens();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error revoking token:", error);
      return false;
    }
  };

  // ============================
  // Profile
  // ============================

  const updateUserProfile = async (profileData) => {
    try {
      const response = await axiosInstance({
        url: "/user/update-profile",
        method: "post",
        data: profileData,
      });

      if (response.data.status === "success") {
        await loadUser(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating user profile:", error);
      return false;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axiosInstance({
        url: "/account/change-password",
        method: "post",
        data: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      return response.data.status === "success";
    } catch (error) {
      console.error("Error changing password:", error);
      return false;
    }
  };

  // ============================
  // Avatar
  // ============================

  const getUserAvatar = (avatar) => {
    const a = avatar ?? user.value.avatar;
    if (!a) return "";
    return `${s3BucketUrl}/assets/${a.slice(0, 2)}/${a.slice(2, 4)}/${a}.webp`;
  };

  // ============================
  // Initialization
  // ============================

  const installListenersOnce = () => {
    if (_listenersInstalled) return;
    _listenersInstalled = true;

    // Force logout: reset all store state (localStorage/redirect handled by axios layer)
    window.addEventListener("forceLogout", () => {
      resetStoreState();
    });

    // Axios layer completed a reactive token refresh (e.g., on 401 retry).
    // Sync store state. Only reschedule if this wasn't triggered by our own
    // proactive doRefreshCycle (which handles its own rescheduling).
    window.addEventListener(TOKEN_REFRESHED_EVENT_NAME, () => {
      syncTokenStateFromStorage();
      if (!_inProactiveRefresh) {
        _refreshRetryCount = 0;
        scheduleTokenRefresh();
      }
    });

    // Tab visibility: when the user returns to the tab, check if the timer
    // was throttled by the browser and reschedule if needed.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!getToken()) return;

      if (
        TokenRefreshScheduler.isOverdue() ||
        !TokenRefreshScheduler.isActive()
      ) {
        scheduleTokenRefresh();
      }
    });
  };

  /**
   * Initialize token refresh on app startup.
   * If the token is already expired or near expiry, refresh immediately,
   * then start the proactive scheduling cycle.
   */
  async function initializeTokenRefresh() {
    const t = getToken();
    if (!t) return;

    const exp = getTokenExpirationTime();
    const threshold = getEffectiveThreshold();
    if (exp >= 0 && exp <= threshold) {
      console.log("[TokenRefresh] Token near expiry on init, refreshing...");
      const ok = await refreshAccessToken();
      if (!ok && !isTokenValid()) return;
    }

    scheduleTokenRefresh();
  }

  installListenersOnce();

  // Sequential initialization: load user first, then start refresh cycle.
  // This avoids the race condition of both calling refreshAccessToken concurrently.
  loadUser()
    .then(() => initializeTokenRefresh())
    .catch((err) => console.error("[Auth] Initialization failed:", err));

  // --- Return public API ---
  return {
    // State
    token,
    tokenExpiresAt,
    refreshTokenExpiresAt,
    user,
    isLogin,
    devices,
    activeTokens,
    currentTokenDetails,

    // Dialog & redirect
    loginDialogVisible,
    authRedirectUrl,

    // User loading
    loadUser,
    fetchUserInfo,
    setUser,

    // Logout
    logout,
    logoutAllDevices,

    // Token access
    getToken,
    updateToken,

    // Token refresh
    refreshAccessToken,
    checkAndRefreshToken,

    // Token refresh scheduling
    startTokenRefreshTimer,
    stopTokenRefreshTimer,
    scheduleTokenRefresh,
    initializeTokenRefresh,

    // Token status
    isTokenValid,
    isRefreshTokenValid,
    isAuthenticationNeeded,
    getTokenExpirationTime,

    // Devices / Sessions
    getDevices,
    getActiveTokens,
    getTokenDetails,
    revokeToken,
    fetchDevices,
    fetchActiveTokens,
    fetchTokenDetails,

    // Profile
    updateUserProfile,
    changePassword,

    // Avatar
    getUserAvatar,

    // Login dialog
    showLoginDialog,
    hideLoginDialog,

    // Redirect URL
    setAuthRedirectUrl,
    consumeAuthRedirectUrl,
    navigateToAuthRedirect,

    // Constants / debug
    AUTO_REFRESH_ENABLED,
    TokenRefreshScheduler,
    DEFAULT_USER,
  };
});
