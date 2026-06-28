"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_EVENTS, AUTH_STORAGE_KEYS } from "@zerocat/auth-core";
import {
  API_URL,
  clearStoredAuthState,
  getFreshAuthToken,
  getStoredToken,
} from "./api";
import { resolveAvatarUrl } from "./avatar";

const DEFAULT_ZC_WEB_URL = "http://localhost:3141";
const ANONYMOUS_SESSION_KEY = "zc_blog_auth_anonymous";

export interface StoredUserInfo {
  id?: number;
  username?: string;
  display_name?: string | null;
  avatar?: string | null;
}

/* -------------------------------- storage --------------------------------- */
// All persisted auth state lives under auth-core's keys so the token client and
// these hooks never drift; we only own the cached user profile on top of it.

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {}
}

function writeSession(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {}
}

function hasAnonymousSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ANONYMOUS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setAnonymousSession(value: boolean) {
  writeSession(ANONYMOUS_SESSION_KEY, value ? "1" : null);
}

function readStoredUser(): StoredUserInfo | null {
  try {
    const raw = readStorage(AUTH_STORAGE_KEYS.userInfo);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as StoredUserInfo) : null;
  } catch {
    return null;
  }
}

/* ------------------------------ user profile ------------------------------ */

function normalizeUser(source: Record<string, unknown>): StoredUserInfo {
  const rawId = source.id;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number.parseInt(rawId, 10)
        : NaN;

  return {
    id: Number.isFinite(id) ? Number(id) : undefined,
    username: typeof source.username === "string" ? source.username : undefined,
    display_name:
      typeof source.display_name === "string" || source.display_name === null
        ? (source.display_name as string | null)
        : undefined,
    avatar:
      typeof source.avatar === "string" || source.avatar === null
        ? resolveAvatarUrl(source.avatar as string | null)
        : undefined,
  };
}

function persistUser(user: StoredUserInfo | null) {
  const hasIdentity =
    !!user &&
    (Boolean(user.username) ||
      typeof user.id === "number" ||
      Boolean(user.display_name));
  writeStorage(AUTH_STORAGE_KEYS.userInfo, hasIdentity ? JSON.stringify(user) : null);
}

async function fetchCurrentUser(token: string): Promise<StoredUserInfo | null> {
  try {
    const res = await fetch(`${API_URL}/user/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as
      | { data?: Record<string, unknown> }
      | null;
    const data = payload?.data;
    return data && typeof data === "object" ? normalizeUser(data) : null;
  } catch {
    return null;
  }
}

/* ------------------------------- hydration -------------------------------- */
// Refresh the access token (via auth-core) and lazily backfill the cached
// profile. Deduplicated so concurrently-mounting hooks share a single pass.

let hydratePromise: Promise<void> | null = null;

async function hydrate(): Promise<void> {
  const storedToken = getStoredToken();
  let refreshedFromCookie = false;
  let token = storedToken ? await getFreshAuthToken(storedToken) : null;

  if (!token && !hasAnonymousSession()) {
    token = await getFreshAuthToken(null, { force: true });
    refreshedFromCookie = Boolean(token);
  }

  if (!token) {
    setAnonymousSession(true);
    persistUser(null);
    return;
  }
  setAnonymousSession(false);
  if (refreshedFromCookie || !readStoredUser()) {
    persistUser(await fetchCurrentUser(token));
  }
}

function hydrateOnce(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = hydrate().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

/**
 * Shared client-only auth subscription. Starts from SSR-safe state, resolves
 * stored values on mount (after a one-shot hydration when a session looks
 * present), and re-syncs on auth-core refresh events or cross-tab writes to the
 * watched key. Keeping reads in an effect — never in a render-time initializer —
 * is what avoids the server/client hydration mismatch.
 */
function useAuthSync(sync: () => void, watchKey: string, authEvent: string) {
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive) sync();
    };

    void hydrateOnce().finally(run);

    const onStorage = (event: StorageEvent) => {
      if (event.key === watchKey) run();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(authEvent, run);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(authEvent, run);
    };
    // `sync` is re-created each render but only reads fresh storage, so a single
    // subscription for the component's lifetime is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ---------------------------------- API ----------------------------------- */

export function buildZcLoginUrl(redirectUrl?: string): string {
  setAnonymousSession(false);
  const configuredBase =
    process.env.NEXT_PUBLIC_ZC_WEB_URL || process.env.NEXT_PUBLIC_WEB_URL;
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
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useAuthSync(
    () => {
      setToken(getStoredToken());
      setReady(true);
    },
    AUTH_STORAGE_KEYS.token,
    AUTH_EVENTS.tokenRefreshed
  );

  const clear = useCallback(async () => {
    const active = getStoredToken();
    if (active) {
      await fetch(`${API_URL}/account/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${active}`,
        },
        body: "{}",
        cache: "no-store",
      }).catch(() => {});
    }
    // auth-core clears token + cached user and emits the refresh events our
    // subscriptions listen for, which resets every hook instance.
    clearStoredAuthState();
    setToken(null);
  }, []);

  return { token, ready, isAuthed: Boolean(token), clear };
}

export function useCurrentUser(): StoredUserInfo | null {
  const [user, setUser] = useState<StoredUserInfo | null>(null);

  useAuthSync(
    () => setUser(readStoredUser()),
    AUTH_STORAGE_KEYS.userInfo,
    AUTH_EVENTS.userRefreshed
  );

  return user;
}
