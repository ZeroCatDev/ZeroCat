import { API_URL } from "./api";

const FP_KEY = "zc_analytics_fp";
const SESSION_KEY = "zc_analytics_session";
const LAST_SENT_KEY = "zc_analytics_last_sent";
const POST_DEDUP_INTERVAL_MS = 30_000;

type SentMap = Record<string, number>;

function safeGet(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `zc_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fp = safeGet(window.localStorage, FP_KEY);
  if (!fp) {
    fp = generateId();
    safeSet(window.localStorage, FP_KEY, fp);
  }
  return fp;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = safeGet(window.sessionStorage, SESSION_KEY);
  if (!sessionId) {
    sessionId = generateId();
    safeSet(window.sessionStorage, SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getLastSentMap(): SentMap {
  if (typeof window === "undefined") return {};
  const text = safeGet(window.sessionStorage, LAST_SENT_KEY);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SentMap;
    }
    return {};
  } catch {
    return {};
  }
}

function setLastSentMap(map: SentMap): void {
  safeSet(window.sessionStorage, LAST_SENT_KEY, JSON.stringify(map));
}

function shouldSkipByInterval(dedupeKey: string, minIntervalMs: number): boolean {
  const sentMap = getLastSentMap();
  const lastTs = Number(sentMap[dedupeKey] || 0);
  const currentTs = Date.now();
  if (lastTs && currentTs - lastTs < minIntervalMs) {
    return true;
  }
  sentMap[dedupeKey] = currentTs;
  setLastSentMap(sentMap);
  return false;
}

function buildBasePayload() {
  if (typeof window === "undefined") return {};
  return {
    fingerprint: getOrCreateFingerprint(),
    hostname: window.location.hostname,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    url: window.location.href,
    referrer: document.referrer || null,
    page_title: document.title,
  };
}

export interface SendAnalyticsOptions {
  targetType: string;
  targetId: string | number;
  url?: string;
  pageTitle?: string;
  referrer?: string | null;
  minIntervalMs?: number;
  dedupeKey?: string;
}

export async function sendAnalyticsEvent({
  targetType,
  targetId,
  url,
  pageTitle,
  referrer,
  minIntervalMs = 0,
  dedupeKey,
}: SendAnalyticsOptions): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
  if (typeof window === "undefined") {
    return { success: false, skipped: true, reason: "no_window" };
  }
  if (!targetType || targetId === undefined || targetId === null || String(targetId) === "") {
    return { success: false, skipped: true, reason: "invalid_target" };
  }

  const sessionId = getOrCreateSessionId();
  const finalDedupeKey = dedupeKey || `${targetType}:${targetId}:session:${sessionId}`;

  if (minIntervalMs > 0 && shouldSkipByInterval(finalDedupeKey, minIntervalMs)) {
    return { success: true, skipped: true, reason: "deduped" };
  }

  const payload: Record<string, unknown> = {
    ...buildBasePayload(),
    target_type: targetType,
    target_id: targetId,
  };

  if (url) payload.url = url;
  if (pageTitle) payload.page_title = pageTitle;
  if (referrer !== undefined) payload.referrer = referrer;

  try {
    await fetch(`${API_URL}/analytics/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function reportPostView(
  postId: string | number,
  options: Partial<SendAnalyticsOptions> = {}
) {
  return sendAnalyticsEvent({
    targetType: "post",
    targetId: postId,
    minIntervalMs: POST_DEDUP_INTERVAL_MS,
    dedupeKey: `post:${postId}:session:${getOrCreateSessionId()}`,
    ...options,
  });
}

export async function reportProjectView(
  projectId: string | number,
  options: Partial<SendAnalyticsOptions> = {}
) {
  return sendAnalyticsEvent({
    targetType: "project",
    targetId: projectId,
    minIntervalMs: POST_DEDUP_INTERVAL_MS,
    dedupeKey: `project:${projectId}:session:${getOrCreateSessionId()}`,
    ...options,
  });
}
