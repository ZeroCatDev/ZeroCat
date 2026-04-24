const DEFAULT_API_URL = "http://localhost:3000"

const AVATAR_HASH_PATTERN = /^[a-f0-9]{32}$/i

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

const API_BASE_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || DEFAULT_API_URL
)

const STATIC_BASE_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_ZC_STATIC_URL ||
    process.env.NEXT_PUBLIC_STATIC_URL ||
    API_BASE_URL
)

export function resolveAvatarUrl(avatar?: string | null): string | null {
  const raw = String(avatar ?? "").trim()
  if (!raw) return null

  if (/^(data:|blob:)/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith("//")) return `https:${raw}`

  if (AVATAR_HASH_PATTERN.test(raw)) {
    const p1 = raw.slice(0, 2)
    const p2 = raw.slice(2, 4)
    return `${STATIC_BASE_URL}/assets/${p1}/${p2}/${raw}.webp`
  }

  if (raw.startsWith("/")) {
    return `${STATIC_BASE_URL}${raw}`
  }

  return `${STATIC_BASE_URL}/${raw.replace(/^\/+/, "")}`
}