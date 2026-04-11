import axios from '@/axios/axios';

const FP_KEY = 'zc_analytics_fp';
const SESSION_KEY = 'zc_analytics_session';
const LAST_SENT_KEY = 'zc_analytics_last_sent';
const POST_DEDUP_INTERVAL_MS = 30_000;

const now = () => Date.now();

const safeStorageGet = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `zc_${Math.random().toString(36).slice(2)}_${Date.now()}`;
};

export const getOrCreateFingerprint = () => {
  let fp = safeStorageGet(window.localStorage, FP_KEY);
  if (!fp) {
    fp = generateId();
    safeStorageSet(window.localStorage, FP_KEY, fp);
  }
  return fp;
};

export const getOrCreateSessionId = () => {
  let sessionId = safeStorageGet(window.sessionStorage, SESSION_KEY);
  if (!sessionId) {
    sessionId = generateId();
    safeStorageSet(window.sessionStorage, SESSION_KEY, sessionId);
  }
  return sessionId;
};

const getLastSentMap = () => {
  const text = safeStorageGet(window.sessionStorage, LAST_SENT_KEY);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (Object.prototype.toString.call(parsed) !== '[object Object]') return {};
    return parsed;
  } catch {
    return {};
  }
};

const setLastSentMap = (map) => {
  safeStorageSet(window.sessionStorage, LAST_SENT_KEY, JSON.stringify(map));
};

const shouldSkipByInterval = (dedupeKey, minIntervalMs) => {
  const sentMap = getLastSentMap();
  const lastTs = Number(sentMap[dedupeKey] || 0);
  const currentTs = now();
  if (lastTs && currentTs - lastTs < minIntervalMs) {
    return true;
  }
  sentMap[dedupeKey] = currentTs;
  setLastSentMap(sentMap);
  return false;
};

const buildBasePayload = () => ({
  fingerprint: getOrCreateFingerprint(),
  hostname: window.location.hostname,
  screen: `${window.screen.width}x${window.screen.height}`,
  language: navigator.language,
  url: window.location.href,
  referrer: document.referrer || null,
  page_title: document.title,
});

export const sendAnalyticsEvent = async ({
  targetType,
  targetId,
  url,
  pageTitle,
  referrer,
  minIntervalMs = 0,
  dedupeKey,
}) => {
  if (!targetType || targetId === undefined || targetId === null || `${targetId}` === '') {
    return { success: false, skipped: true, reason: 'invalid_target' };
  }

  const sessionId = getOrCreateSessionId();
  const finalDedupeKey = dedupeKey || `${targetType}:${targetId}:session:${sessionId}`;

  if (minIntervalMs > 0 && shouldSkipByInterval(finalDedupeKey, minIntervalMs)) {
    return { success: true, skipped: true, reason: 'deduped' };
  }

  const payload = {
    ...buildBasePayload(),
    target_type: targetType,
    target_id: targetId,
  };

  if (url) payload.url = url;
  if (pageTitle) payload.page_title = pageTitle;
  if (referrer !== undefined) payload.referrer = referrer;

  try {
    const response = await axios.post('/analytics/send', payload);
    return response.data ?? { success: true };
  } catch {
    return { success: false };
  }
};

export const reportPostView = async (postId, options = {}) => {
  return sendAnalyticsEvent({
    targetType: 'post',
    targetId: postId,
    minIntervalMs: POST_DEDUP_INTERVAL_MS,
    dedupeKey: `post:${postId}:session:${getOrCreateSessionId()}`,
    ...options,
  });
};

export default {
  getOrCreateFingerprint,
  getOrCreateSessionId,
  sendAnalyticsEvent,
  reportPostView,
};
