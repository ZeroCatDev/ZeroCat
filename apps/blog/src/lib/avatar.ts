declare global {
  interface Window {
    __ZC_STATIC_URL__?: string;
  }
}

const DEFAULT_API_URL = "http://localhost:3000";
const ASSET_HASH_PATTERN = /^[a-f0-9]{32}$/i;
const ASSET_HASH_WITH_EXTENSION_PATTERN = /^([a-f0-9]{32})\.([a-z0-9]+)$/i;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeUrlBase(value?: string | null): string {
  return stripTrailingSlash(String(value ?? "").trim());
}

function getFallbackStaticBase(): string {
  return normalizeUrlBase(
      process.env.NEXT_PUBLIC_API_URL ||
      DEFAULT_API_URL
  );
}

function getConfiguredStaticBase(staticBase?: string | null): string {
  const explicit = normalizeUrlBase(staticBase);
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    const fromWindow = normalizeUrlBase(window.__ZC_STATIC_URL__);
    if (fromWindow) return fromWindow;

    const fromDataset = normalizeUrlBase(
      document.documentElement.dataset.zcStaticUrl
    );
    if (fromDataset) return fromDataset;
  }

  return getFallbackStaticBase();
}

function normalizeAbsoluteLikeUrl(raw: string): string | null {
  if (!raw) return null;
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return null;
}

function buildStaticAssetUrl(
  hash: string,
  staticBase?: string | null,
  extension = "webp"
): string {
  const base = getConfiguredStaticBase(staticBase);
  const p1 = hash.slice(0, 2);
  const p2 = hash.slice(2, 4);
  return `${base}/assets/${p1}/${p2}/${hash}.${extension}`;
}

export function resolveMediaUrl(
  value?: string | null,
  staticBase?: string | null
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const absolute = normalizeAbsoluteLikeUrl(raw);
  if (absolute) return absolute;

  if (ASSET_HASH_PATTERN.test(raw)) {
    return buildStaticAssetUrl(raw, staticBase);
  }

  const hashWithExtMatch = raw.match(ASSET_HASH_WITH_EXTENSION_PATTERN);
  if (hashWithExtMatch) {
    return buildStaticAssetUrl(hashWithExtMatch[1], staticBase, hashWithExtMatch[2]);
  }

  const base = getConfiguredStaticBase(staticBase);

  if (raw.startsWith("/assets/")) {
    return `${base}${raw}`;
  }

  if (raw.startsWith("assets/")) {
    return `${base}/${raw}`;
  }

  return raw;
}

export function resolveAvatarUrl(
  avatar?: string | null,
  staticBase?: string | null
): string | null {
  const raw = String(avatar ?? "").trim();
  if (!raw) return null;

  const absolute = normalizeAbsoluteLikeUrl(raw);
  if (absolute) return absolute;

  if (ASSET_HASH_PATTERN.test(raw)) {
    return buildStaticAssetUrl(raw, staticBase);
  }

  const hashWithExtMatch = raw.match(ASSET_HASH_WITH_EXTENSION_PATTERN);
  if (hashWithExtMatch) {
    return buildStaticAssetUrl(hashWithExtMatch[1], staticBase, hashWithExtMatch[2]);
  }

  return resolveMediaUrl(raw, staticBase);
}
