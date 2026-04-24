"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL, getStoredToken } from "./api";
import { resolveAvatarUrl } from "./avatar";

const TOKEN_KEY = "token";
const TOKEN_EXPIRES_AT_KEY = "tokenExpiresAt";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "refreshTokenExpiresAt";
const USER_INFO_KEY = "userInfo";

const TOKEN_REFRESHED_EVENT = "auth:token-refreshed";
const USER_REFRESHED_EVENT = "auth:user-refreshed";

const DEFAULT_ZC_WEB_URL = "http://localhost:3141";

let hydratePromise: Promise<void> | null = null;

type RefreshTokenResponse = {
  status?: string;
  token?: string;
  expires_at?: string | number | null;
  refresh_expires_at?: string | number | null;
};

function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value < 1e12 ? value * 1000 : value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return null;
}

function setLocalStorageValue(key: string, value: string | null) {
  try {
    if (value === null || value === "") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {}
}

function clearStoredAuthState() {
  setLocalStorageValue(TOKEN_KEY, null);
  setLocalStorageValue(TOKEN_EXPIRES_AT_KEY, null);
  setLocalStorageValue(REFRESH_TOKEN_EXPIRES_AT_KEY, null);
  setLocalStorageValue(USER_INFO_KEY, null);
}

function persistToken(payload: RefreshTokenResponse) {
  if (!payload.token) return;
  setLocalStorageValue(TOKEN_KEY, payload.token);
  setLocalStorageValue(TOKEN_EXPIRES_AT_KEY, normalizeTimestamp(payload.expires_at));
  setLocalStorageValue(
    REFRESH_TOKEN_EXPIRES_AT_KEY,
    normalizeTimestamp(payload.refresh_expires_at)
  );
}

function toStoredUserInfo(source: Record<string, unknown>): StoredUserInfo {
  const rawId = source.id;
  const parsedId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number.parseInt(rawId, 10)
        : undefined;

  const rawAvatar =
    typeof source.avatar === "string" || source.avatar === null
      ? (source.avatar as string | null)
      : undefined;

  return {
    id: Number.isFinite(parsedId) ? Number(parsedId) : undefined,
    username: typeof source.username === "string" ? source.username : undefined,
    display_name:
      typeof source.display_name === "string" || source.display_name === null
        ? (source.display_name as string | null)
        : undefined,
    avatar: rawAvatar === undefined ? undefined : resolveAvatarUrl(rawAvatar),
  };
}

function persistUserInfo(userInfo: StoredUserInfo | null) {
  if (!userInfo) {
    setLocalStorageValue(USER_INFO_KEY, null);
    return;
  }

  const hasIdentity =
    Boolean(userInfo.username) ||
    typeof userInfo.id === "number" ||
    Boolean(userInfo.display_name);
  if (!hasIdentity) {
    setLocalStorageValue(USER_INFO_KEY, null);
    return;
  }

  try {
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  } catch {}
}

async function fetchCurrentUser(token: string): Promise<StoredUserInfo | null> {
  try {
    const res = await fetch(`${API_URL}/user/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const payload = (await res.json().catch(() => null)) as
      | { data?: Record<string, unknown> }
      | null;
    const data = payload?.data;
    if (!data || typeof data !== "object") return null;

    return toStoredUserInfo(data);
  } catch {
    return null;
  }
}

async function refreshAuthFromCookie(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/account/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      cache: "no-store",
    });

    if (!res.ok) return null;

    const payload = (await res.json().catch(() => null)) as RefreshTokenResponse | null;
    if (!payload || payload.status !== "success" || !payload.token) {
      return null;
    }

    persistToken(payload);
    return payload.token;
  } catch {
    return null;
  }
}

function emitAuthRefreshEvents() {
  window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT));
  window.dispatchEvent(new CustomEvent(USER_REFRESHED_EVENT));
}

async function hydrateAuthState() {
  if (typeof window === "undefined") return;

  const currentToken = getStoredToken();
  const token = currentToken ?? (await refreshAuthFromCookie());

  if (!token) {
    persistUserInfo(null);
    emitAuthRefreshEvents();
    return;
  }

  const existingUser = readStoredUser();
  if (!existingUser?.username && !existingUser?.id) {
    const userInfo = await fetchCurrentUser(token);
    persistUserInfo(userInfo);
  }

  emitAuthRefreshEvents();
}

export function buildZcLoginUrl(redirectUrl?: string): string {
  const configuredBase = process.env.NEXT_PUBLIC_ZC_WEB_URL || process.env.NEXT_PUBLIC_WEB_URL;
  const base =
    configuredBase && /^https?:\/\//i.test(configuredBase)
      ? configuredBase.replace(/\/+$/, "")
      : DEFAULT_ZC_WEB_URL;
  const target =
    redirectUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const query = target ? `?redirect=${encodeURIComponent(target)}` : "";
  return `${base}/app/account/login${query}`;
}

export function useAuthToken() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    if (!hydratePromise) {
      hydratePromise = hydrateAuthState().finally(() => {
        hydratePromise = null;
      });
    }

    void hydratePromise.finally(() => {
      if (cancelled) return;
      setToken(getStoredToken());
      setReady(true);
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) setToken(e.newValue);
    };
    const onRefresh = () => setToken(getStoredToken());

    window.addEventListener("storage", onStorage);
    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefresh);
    };
  }, []);

  const clear = useCallback(async () => {
    const currentToken = getStoredToken();
    if (currentToken) {
      try {
        await fetch(`${API_URL}/account/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: "{}",
          cache: "no-store",
        });
      } catch {}
    }

    clearStoredAuthState();
    setToken(null);
    emitAuthRefreshEvents();
  }, []);

  return { token, ready, isAuthed: Boolean(token), clear };
}

export interface StoredUserInfo {
  id?: number;
  username?: string;
  display_name?: string | null;
  avatar?: string | null;
}

function readStoredUser(): StoredUserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("userInfo");
    if (!raw) return null;
    return JSON.parse(raw) as StoredUserInfo;
  } catch {
    return null;
  }
}

export function useCurrentUser(): StoredUserInfo | null {
  const [user, setUser] = useState<StoredUserInfo | null>(() => readStoredUser());

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    if (!hydratePromise) {
      hydratePromise = hydrateAuthState().finally(() => {
        hydratePromise = null;
      });
    }

    void hydratePromise.finally(() => {
      if (!cancelled) {
        setUser(readStoredUser());
      }
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_INFO_KEY) {
        setUser(readStoredUser());
      }
    };

    const onRefresh = () => {
      setUser(readStoredUser());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(USER_REFRESHED_EVENT, onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(USER_REFRESHED_EVENT, onRefresh);
    };
  }, []);

  return user;
}
