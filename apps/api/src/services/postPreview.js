import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import axios from "axios";
import metascraper from "metascraper";
import metascraperAuthor from "metascraper-author";
import metascraperDate from "metascraper-date";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperLogo from "metascraper-logo";
import metascraperPublisher from "metascraper-publisher";
import metascraperTitle from "metascraper-title";
import metascraperUrl from "metascraper-url";
import metascraperAmazon from "metascraper-amazon";
import metascraperBluesky from "metascraper-bluesky";
import metascraperDribbble from "metascraper-dribbble";
import metascraperInstagram from "metascraper-instagram";
import metascraperSoundCloud from "metascraper-soundcloud";
import metascraperSpotify from "metascraper-spotify";
import metascraperTelegram from "metascraper-telegram";
import metascraperTikTok from "metascraper-tiktok";
import metascraperUol from "metascraper-uol";
import metascraperX from "metascraper-x";
import metascraperYouTube from "metascraper-youtube";
import logger from "./logger.js";
import redisClient from "./redis.js";
import memoryCache from "./memoryCache.js";
import { prisma } from "./prisma.js";

const scraper = metascraper([
  metascraperAuthor(),
  metascraperDate(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperAmazon(),
  metascraperBluesky(),
  metascraperDribbble(),
  metascraperInstagram(),
  metascraperSoundCloud(),
  metascraperSpotify(),
  metascraperTelegram(),
  metascraperTikTok(),
  metascraperUol(),
  metascraperX(),
  metascraperYouTube(),
  metascraperPublisher(),
  metascraperTitle(),
  metascraperUrl(),
]);

const PREVIEW_CACHE_VERSION = "v1";
const PREVIEW_CACHE_KEY_PREFIX = `post:url_preview:${PREVIEW_CACHE_VERSION}:`;
const PREVIEW_TTL_SUCCESS_SECONDS = 6 * 60 * 60;
const PREVIEW_TTL_ERROR_SECONDS = 5 * 60;
const MAX_HTML_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

const inFlightRequests = new Map();

class UrlPreviewError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_REQUEST") {
    super(message);
    this.name = "UrlPreviewError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parseBooleanFlag(value) {
  if (value === undefined || value === null) return false;
  return String(value).trim().toLowerCase() === "true";
}

function sanitizePreviewText(value, maxLen = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}...` : text;
}

function normalizeInputUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new UrlPreviewError("url 不能为空", 400, "EMPTY_URL");
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new UrlPreviewError("url 不能为空", 400, "EMPTY_URL");
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlPreviewError("无效的 URL", 400, "INVALID_URL");
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new UrlPreviewError("仅支持 http/https URL", 400, "UNSUPPORTED_PROTOCOL");
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";

  const removableTrackingParams = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
  ]);

  for (const key of [...parsed.searchParams.keys()]) {
    if (removableTrackingParams.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

function isPrivateIPv4(ip) {
  const segments = ip.split(".").map((v) => Number(v));
  if (segments.length !== 4 || segments.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  if (segments[0] === 10) return true;
  if (segments[0] === 127) return true;
  if (segments[0] === 0) return true;
  if (segments[0] === 169 && segments[1] === 254) return true;
  if (segments[0] === 172 && segments[1] >= 16 && segments[1] <= 31) return true;
  if (segments[0] === 192 && segments[1] === 168) return true;
  if (segments[0] === 100 && segments[1] >= 64 && segments[1] <= 127) return true;
  return false;
}

function isPrivateIpAddress(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateIPv4(ip);
  }

  if (version === 6) {
    const compact = ip.toLowerCase();
    if (compact === "::1") return true;
    if (compact.startsWith("fe80:")) return true;
    if (compact.startsWith("fc") || compact.startsWith("fd")) return true;
    if (compact.startsWith("::ffff:")) {
      const ipv4 = compact.slice("::ffff:".length);
      if (net.isIP(ipv4) === 4) {
        return isPrivateIPv4(ipv4);
      }
    }
    return false;
  }

  return true;
}

async function assertUrlIsPublicNetwork(urlString) {
  const parsed = new URL(urlString);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new UrlPreviewError("不允许访问内网地址", 400, "BLOCKED_HOST");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new UrlPreviewError("不允许访问内网地址", 400, "BLOCKED_IP");
    }
    return;
  }

  let lookupResults;
  try {
    lookupResults = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UrlPreviewError("域名解析失败", 400, "DNS_LOOKUP_FAILED");
  }

  if (!lookupResults || lookupResults.length === 0) {
    throw new UrlPreviewError("域名解析失败", 400, "DNS_LOOKUP_FAILED");
  }

  for (const item of lookupResults) {
    if (isPrivateIpAddress(item.address)) {
      throw new UrlPreviewError("不允许访问内网地址", 400, "BLOCKED_IP");
    }
  }
}

function makeCacheKey(urlString) {
  const hash = crypto.createHash("sha256").update(urlString).digest("hex");
  return `${PREVIEW_CACHE_KEY_PREFIX}${hash}`;
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveAbsoluteUrl(maybeUrl, baseUrl) {
  const value = sanitizePreviewText(maybeUrl, 2048);
  if (!value) return null;

  try {
    if (baseUrl) {
      return new URL(value, baseUrl).toString();
    }
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function extractIconFromHtml(html, baseUrl) {
  if (!html || typeof html !== "string") return null;

  // 优先匹配显式 icon，再兜底 apple-touch-icon。
  const iconLinkRegex = /<link\b[^>]*\brel\s*=\s*['\"]([^'\"]*)['\"][^>]*\bhref\s*=\s*['\"]([^'\"]+)['\"][^>]*>/gi;
  const iconCandidates = [];
  let match;

  while ((match = iconLinkRegex.exec(html)) !== null) {
    const rel = String(match[1] || "").toLowerCase();
    const href = match[2];
    if (!rel.includes("icon")) continue;

    const absolute = resolveAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;

    const score = rel.includes("apple-touch-icon") ? 1 : 2;
    iconCandidates.push({ url: absolute, score });
  }

  if (iconCandidates.length === 0) return null;
  iconCandidates.sort((a, b) => b.score - a.score);
  return iconCandidates[0].url;
}

function buildFaviconFallback(urlString) {
  try {
    const parsed = new URL(urlString);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function buildPreviewPayload({ requestedUrl, fetchedUrl, metadata, contentType, html }) {
  const canonicalUrl = sanitizePreviewText(metadata.url || fetchedUrl || requestedUrl, 2048) || requestedUrl;
  let fallbackTitle = null;
  try {
    fallbackTitle = new URL(canonicalUrl).hostname;
  } catch {
    fallbackTitle = null;
  }

  const image = sanitizePreviewText(metadata.image, 2048);
  const icon =
    resolveAbsoluteUrl(metadata.logo, fetchedUrl || canonicalUrl) ||
    extractIconFromHtml(html, fetchedUrl || canonicalUrl) ||
    buildFaviconFallback(fetchedUrl || canonicalUrl);

  return {
    requested_url: requestedUrl,
    url: canonicalUrl,
    title: sanitizePreviewText(metadata.title, 300) || fallbackTitle,
    description: sanitizePreviewText(metadata.description, 600),
    image,
    icon,
    author: sanitizePreviewText(metadata.author, 120),
    publisher: sanitizePreviewText(metadata.publisher, 120),
    published_at: parseMaybeDate(metadata.date),
    content_type: sanitizePreviewText(contentType, 120),
  };
}

async function readCachedPreview(cacheKey) {
  const now = Date.now();

  if (redisClient?.isConnected) {
    const redisValue = await redisClient.get(cacheKey);
    if (redisValue && typeof redisValue === "object") {
      const cachedAt = Number(redisValue.cached_at || 0);
      const ttl = Number(redisValue.ttl || 0);
      if (cachedAt > 0 && ttl > 0 && cachedAt + ttl * 1000 > now) {
        return { ...redisValue, cache_source: "redis" };
      }
    }
  }

  const memoryValue = memoryCache.get(cacheKey);
  if (memoryValue && typeof memoryValue === "object") {
    return { ...memoryValue, cache_source: "memory" };
  }

  try {
    const row = await prisma.ow_post_url_previews.findUnique({
      where: { cache_key: cacheKey },
      select: {
        payload: true,
        expires_at: true,
      },
    });

    if (row && row.payload && row.expires_at && row.expires_at.getTime() > now) {
      const payload = row.payload;
      if (payload && typeof payload === "object") {
        const ttl = Math.max(Math.floor((row.expires_at.getTime() - now) / 1000), 1);
        const hydrated = {
          ...payload,
          ttl,
          cached_at: now,
          cache_source: "db",
        };

        memoryCache.set(cacheKey, payload, ttl);
        if (redisClient?.isConnected) {
          await redisClient.set(cacheKey, payload, ttl);
        }

        return hydrated;
      }
    }
  } catch (error) {
    logger.warn(`[postPreview] 读取数据库缓存失败 key=${cacheKey}: ${error.message}`);
  }

  return null;
}

async function writeCachedPreview(cacheKey, payload, ttlSeconds, normalizedUrl) {
  const record = {
    ...payload,
    cached_at: Date.now(),
    ttl: ttlSeconds,
  };

  memoryCache.set(cacheKey, record, ttlSeconds);

  if (redisClient?.isConnected) {
    await redisClient.set(cacheKey, record, ttlSeconds);
  }

  try {
    await prisma.ow_post_url_previews.upsert({
      where: { cache_key: cacheKey },
      create: {
        cache_key: cacheKey,
        url: String(payload?.data?.preview?.url || normalizedUrl || ""),
        ok: Boolean(payload?.ok),
        payload: record,
        expires_at: new Date(Date.now() + ttlSeconds * 1000),
      },
      update: {
        url: String(payload?.data?.preview?.url || normalizedUrl || ""),
        ok: Boolean(payload?.ok),
        payload: record,
        expires_at: new Date(Date.now() + ttlSeconds * 1000),
      },
    });
  } catch (error) {
    logger.warn(`[postPreview] 写入数据库缓存失败 key=${cacheKey}: ${error.message}`);
  }
}

async function fetchPageHtml(urlString) {
  try {
    const response = await axios.get(urlString, {
      timeout: REQUEST_TIMEOUT_MS,
      responseType: "stream",
      maxRedirects: 5,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent": "ZeroCatBot/1.0 (+https://zerocat.top)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const finalUrl = response?.request?.res?.responseUrl || urlString;
    const stream = response?.data;
    const chunks = [];
    let bytesRead = 0;
    let endedByLimit = false;
    let headProbe = "";

    await new Promise((resolve, reject) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      stream.on("data", (chunk) => {
        if (settled) return;

        const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = MAX_HTML_BYTES - bytesRead;

        if (remaining <= 0) {
          endedByLimit = true;
          stream.destroy();
          return finish();
        }

        if (chunkBuffer.length <= remaining) {
          chunks.push(chunkBuffer);
          bytesRead += chunkBuffer.length;
        } else {
          chunks.push(chunkBuffer.subarray(0, remaining));
          bytesRead += remaining;
          endedByLimit = true;
          stream.destroy();
          return finish();
        }

        headProbe = (headProbe + chunkBuffer.toString("utf8")).slice(-16384);
        if (/<\/head\s*>/i.test(headProbe)) {
          stream.destroy();
          return finish();
        }
      });

      stream.on("end", finish);
      stream.on("close", finish);
      stream.on("error", (error) => {
        if (settled) return;
        const isExpectedClose = endedByLimit || /premature close/i.test(String(error?.message || ""));
        if (isExpectedClose) {
          return finish();
        }
        fail(error);
      });
    });

    const html = Buffer.concat(chunks).toString("utf8");
    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();

    if (!html) {
      throw new UrlPreviewError("目标页面无可解析内容", 422, "EMPTY_HTML");
    }

    if (contentType && !contentType.includes("text/html") && !html.includes("<html")) {
      throw new UrlPreviewError("目标 URL 不是可预览网页", 422, "UNSUPPORTED_CONTENT_TYPE");
    }

    return {
      html,
      finalUrl,
      contentType,
    };
  } catch (error) {
    if (error instanceof UrlPreviewError) {
      throw error;
    }

    if (String(error?.message || "").includes("maxContentLength")) {
      throw new UrlPreviewError("目标页面体积过大", 422, "CONTENT_TOO_LARGE");
    }

    if (error?.code === "ECONNABORTED") {
      throw new UrlPreviewError("抓取超时，请稍后重试", 504, "FETCH_TIMEOUT");
    }

    const upstreamStatus = Number(error?.response?.status || 0);
    if (upstreamStatus === 403 || upstreamStatus === 429) {
      throw new UrlPreviewError("目标站点拒绝抓取，请稍后重试", 502, "UPSTREAM_BLOCKED");
    }
    logger.error(error);
    throw new UrlPreviewError("抓取预览失败", 502, "FETCH_FAILED");
  }
}

async function scrapeUrlPreview(urlString) {
  await assertUrlIsPublicNetwork(urlString);

  const { html, finalUrl, contentType } = await fetchPageHtml(urlString);
  const metadata = await scraper({ html, url: finalUrl });
  const preview = buildPreviewPayload({
    requestedUrl: urlString,
    fetchedUrl: finalUrl,
    metadata: metadata || {},
    contentType,
    html,
  });

  if (!preview.title && !preview.description && !preview.image) {
    throw new UrlPreviewError("未能提取可用预览信息", 422, "NO_PREVIEW_DATA");
  }

  return preview;
}

export async function getPostUrlPreview(rawUrl, options = {}) {
  const normalizedUrl = normalizeInputUrl(rawUrl);
  const forceRefresh = parseBooleanFlag(options.forceRefresh);
  const cacheKey = makeCacheKey(normalizedUrl);

  if (!forceRefresh) {
    const cached = await readCachedPreview(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        cache: {
          hit: true,
          source: cached.cache_source,
          ttl: cached.ttl,
          cached_at: cached.cached_at,
        },
      };
    }
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const preview = await scrapeUrlPreview(normalizedUrl);
      const payload = {
        ok: true,
        data: {
          preview,
        },
      };

      await writeCachedPreview(cacheKey, payload, PREVIEW_TTL_SUCCESS_SECONDS, normalizedUrl);

      return {
        ...payload.data,
        cache: {
          hit: false,
          source: null,
          ttl: PREVIEW_TTL_SUCCESS_SECONDS,
          cached_at: Date.now(),
        },
      };
    } catch (error) {
      if (error instanceof UrlPreviewError) {
        const errorPayload = {
          ok: false,
          data: {
            error_code: error.code,
            error_message: error.message,
          },
        };

        if (error.statusCode >= 500) {
          await writeCachedPreview(cacheKey, errorPayload, PREVIEW_TTL_ERROR_SECONDS, normalizedUrl);
        }

        throw error;
      }

      logger.error("[postPreview] 未知错误:", error);
      throw new UrlPreviewError("抓取预览失败", 502, "FETCH_FAILED");
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export { UrlPreviewError, PREVIEW_TTL_SUCCESS_SECONDS, PREVIEW_TTL_ERROR_SECONDS };
