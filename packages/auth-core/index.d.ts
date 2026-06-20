export declare const AUTH_STORAGE_KEYS: {
  token: string;
  tokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenLifetimeSec: string;
  userInfo: string;
  refreshLock: string;
  refreshResult: string;
};

export declare const AUTH_EVENTS: {
  tokenRefreshed: string;
  userRefreshed: string;
  forceLogout: string;
};

export type RefreshPayload = {
  status?: string;
  token?: string;
  refresh_token?: string;
  expires_at?: string | number | null;
  refresh_expires_at?: string | number | null;
};

export type BrowserAuthClientOptions = {
  apiUrl?: string;
  storage?: Storage;
  fetch?: typeof fetch;
  now?: () => number;
  refreshMarginMs?: number;
  lockTtlMs?: number;
  waitTimeoutMs?: number;
  persistTokenToStorage?: boolean;
  ownerId?: string;
};

export type BrowserAuthClient = {
  authedFetch(path: string, init?: RequestInit, token?: string | null): Promise<Response>;
  clearStoredAuthState(): void;
  getFreshAuthToken(
    token?: string | null,
    options?: { force?: boolean }
  ): Promise<string | null>;
  getStoredToken(): string | null;
  getStoredRefreshToken(): string | null;
  isRefreshInFlight(): boolean;
  persistToken(payload: RefreshPayload): void;
  refreshStoredAuthToken(): Promise<string | null>;
};

export declare function isCrossOriginAuth(
  apiUrl: string,
  pageOrigin?: string | null
): boolean;

export declare function createBrowserAuthClient(
  options?: BrowserAuthClientOptions
): BrowserAuthClient;
