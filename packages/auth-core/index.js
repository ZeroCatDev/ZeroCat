export const AUTH_STORAGE_KEYS = {
  token: "token",
  tokenExpiresAt: "tokenExpiresAt",
  refreshTokenExpiresAt: "refreshTokenExpiresAt",
  userInfo: "userInfo",
  refreshLock: "authRefreshLock",
  refreshResult: "authRefreshResult",
};

export const AUTH_EVENTS = {
  tokenRefreshed: "auth:token-refreshed",
  userRefreshed: "auth:user-refreshed",
  forceLogout: "forceLogout",
};

const DEFAULT_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_LOCK_TTL_MS = 12_000;
const DEFAULT_WAIT_TIMEOUT_MS = 15_000;
const WAIT_POLL_MS = 50;

function getDefaultStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getDefaultFetch() {
  if (typeof fetch === "function") return fetch.bind(globalThis);
  return null;
}

function makeOwnerId() {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `zc-auth:${Date.now()}:${random}`;
}

function normalizeApiUrl(apiUrl) {
  return String(apiUrl || "").replace(/\/+$/, "");
}

function isAbsoluteUrl(path) {
  return /^https?:\/\//i.test(String(path || ""));
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value < 1e12 ? value * 1000 : value);
  }
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function parseStoredTimestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTimestampExpiring(value, marginMs, now) {
  const expiresAt = parseStoredTimestamp(value);
  if (!expiresAt) return false;
  return expiresAt - now() <= marginMs;
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function mergeHeaders(init, token) {
  const provided =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
        ? Object.fromEntries(init.headers)
        : { ...(init.headers || {}) };

  const headers = {
    ...(isFormDataBody(init.body) ? {} : { "Content-Type": "application/json" }),
    Accept: "application/json",
    ...provided,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    delete headers.Authorization;
  }

  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createBrowserAuthClient(options = {}) {
  const apiUrl = normalizeApiUrl(options.apiUrl);
  const storage = options.storage || getDefaultStorage();
  const fetchImpl = options.fetch || getDefaultFetch();
  const now = options.now || (() => Date.now());
  const refreshMarginMs = options.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS;
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const persistTokenToStorage = options.persistTokenToStorage === true;
  const ownerId = options.ownerId || makeOwnerId();

  let refreshPromise = null;
  let memoryToken = getStorageValue(AUTH_STORAGE_KEYS.token);
  let memoryTokenExpiresAt = getStorageValue(AUTH_STORAGE_KEYS.tokenExpiresAt);
  let memoryRefreshTokenExpiresAt = getStorageValue(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);

  function getStorageValue(key) {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function setStorageValue(key, value) {
    if (!storage) return;
    try {
      if (value === null || value === undefined || value === "") {
        storage.removeItem(key);
      } else {
        storage.setItem(key, String(value));
      }
    } catch {}
  }

  function emitAuthEvents(detail = {}) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.tokenRefreshed, { detail }));
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.userRefreshed, { detail }));
  }

  function getStoredToken() {
    return memoryToken || getStorageValue(AUTH_STORAGE_KEYS.token);
  }

  function persistToken(payload) {
    if (!payload?.token) return;
    const tokenExpiresAt = normalizeTimestamp(payload.expires_at);
    const refreshTokenExpiresAt = normalizeTimestamp(payload.refresh_expires_at);

    memoryToken = payload.token;
    memoryTokenExpiresAt = tokenExpiresAt;
    memoryRefreshTokenExpiresAt = refreshTokenExpiresAt;

    if (persistTokenToStorage) {
      setStorageValue(AUTH_STORAGE_KEYS.token, payload.token);
      setStorageValue(AUTH_STORAGE_KEYS.tokenExpiresAt, tokenExpiresAt);
      setStorageValue(AUTH_STORAGE_KEYS.refreshTokenExpiresAt, refreshTokenExpiresAt);
    }

    setStorageValue(
      AUTH_STORAGE_KEYS.refreshResult,
      JSON.stringify({
        token: payload.token,
        expires_at: tokenExpiresAt,
        refresh_expires_at: refreshTokenExpiresAt,
        written_at: now(),
      })
    );
    emitAuthEvents(payload);
  }

  function clearStoredAuthState() {
    memoryToken = null;
    memoryTokenExpiresAt = null;
    memoryRefreshTokenExpiresAt = null;
    setStorageValue(AUTH_STORAGE_KEYS.token, null);
    setStorageValue(AUTH_STORAGE_KEYS.tokenExpiresAt, null);
    setStorageValue(AUTH_STORAGE_KEYS.refreshTokenExpiresAt, null);
    setStorageValue(AUTH_STORAGE_KEYS.userInfo, null);
    emitAuthEvents({ token: null });
  }

  function isRefreshTokenExpired() {
    return isTimestampExpiring(memoryRefreshTokenExpiresAt, 0, now);
  }

  function isAccessTokenExpiring() {
    return isTimestampExpiring(
      memoryTokenExpiresAt,
      refreshMarginMs,
      now
    );
  }

  function getLock() {
    const lock = safeJsonParse(getStorageValue(AUTH_STORAGE_KEYS.refreshLock));
    if (!lock || typeof lock !== "object") return null;
    if (!lock.owner || !Number.isFinite(Number(lock.expiresAt))) return null;
    return lock;
  }

  function acquireRefreshLock() {
    if (!storage) return true;

    const existing = getLock();
    if (existing && Number(existing.expiresAt) > now() && existing.owner !== ownerId) {
      return false;
    }

    setStorageValue(
      AUTH_STORAGE_KEYS.refreshLock,
      JSON.stringify({ owner: ownerId, expiresAt: now() + lockTtlMs })
    );

    const current = getLock();
    return current?.owner === ownerId;
  }

  function releaseRefreshLock() {
    const current = getLock();
    if (current?.owner === ownerId) {
      setStorageValue(AUTH_STORAGE_KEYS.refreshLock, null);
    }
  }

  async function waitForPeerRefresh(previousToken) {
    const deadline = now() + waitTimeoutMs;

    while (now() < deadline) {
      const currentToken = getStoredToken();
      const refreshResult = safeJsonParse(getStorageValue(AUTH_STORAGE_KEYS.refreshResult));
      if (refreshResult?.token && refreshResult.token !== previousToken) {
        persistToken({
          token: refreshResult.token,
          expires_at: refreshResult.expires_at,
          refresh_expires_at: refreshResult.refresh_expires_at,
        });
        return refreshResult.token;
      }
      const lock = getLock();
      if (currentToken && currentToken !== previousToken) return currentToken;
      if (!lock || Number(lock.expiresAt) <= now()) return null;
      await sleep(WAIT_POLL_MS);
    }

    return getStoredToken() !== previousToken ? getStoredToken() : null;
  }

  async function performRefreshRequest() {
    if (!fetchImpl) return null;

    const response = await fetchImpl(`${apiUrl}/account/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      cache: "no-store",
    });

    if (!response?.ok) {
      if ([400, 401, 403].includes(Number(response?.status))) {
        clearStoredAuthState();
      }
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.status !== "success" || !payload.token) return null;

    persistToken(payload);
    return payload.token;
  }

  async function refreshStoredAuthToken() {
    if (isRefreshTokenExpired()) {
      clearStoredAuthState();
      return null;
    }

    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const previousToken = getStoredToken();

      if (!acquireRefreshLock()) {
        const peerToken = await waitForPeerRefresh(previousToken);
        if (peerToken) return peerToken;
        if (!acquireRefreshLock()) return getStoredToken();
      }

      try {
        return await performRefreshRequest();
      } finally {
        releaseRefreshLock();
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  async function getFreshAuthToken(token = null, refreshOptions = {}) {
    const storedToken = getStoredToken();
    const currentToken =
      token && token === storedToken ? token : storedToken || token || null;

    if (!refreshOptions.force && currentToken && !isAccessTokenExpiring()) {
      return currentToken;
    }

    const refreshedToken = await refreshStoredAuthToken();
    if (refreshOptions.force) return refreshedToken;
    return refreshedToken || currentToken;
  }

  async function authedFetch(path, init = {}, token = null) {
    const url = isAbsoluteUrl(path) ? String(path) : `${apiUrl}${path}`;
    let useToken = await getFreshAuthToken(token);

    let response = await fetchImpl(url, {
      ...init,
      credentials: "include",
      headers: mergeHeaders(init, useToken),
      cache: "no-store",
    });

    if (response.status === 401) {
      const refreshedToken = await getFreshAuthToken(useToken, { force: true });
      if (refreshedToken) {
        useToken = refreshedToken;
        response = await fetchImpl(url, {
          ...init,
          credentials: "include",
          headers: mergeHeaders(init, useToken),
          cache: "no-store",
        });
      }
    }

    return response;
  }

  return {
    authedFetch,
    clearStoredAuthState,
    getFreshAuthToken,
    getStoredToken,
    isRefreshInFlight: () => refreshPromise !== null,
    persistToken,
    refreshStoredAuthToken,
  };
}
