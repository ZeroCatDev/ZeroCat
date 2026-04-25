import "server-only";

import { API_URL } from "./api";

export type SiteConfig = Record<string, unknown>;

const DEFAULT_API_URL = "http://localhost:3000";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeUrlBase(value?: string | null): string {
  return stripTrailingSlash(String(value ?? "").trim());
}

function getFallbackStaticBase(): string {
  return normalizeUrlBase(
    process.env.NEXT_PUBLIC_ZC_STATIC_URL ||
      process.env.NEXT_PUBLIC_STATIC_URL ||
      process.env.NEXT_PUBLIC_S3_STATICURL ||
      process.env.S3_STATICURL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      DEFAULT_API_URL
  );
}

export async function getServerSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${API_URL}/api/config`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return {};

    const payload = (await res.json().catch(() => null)) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {};
    }

    return payload as SiteConfig;
  } catch {
    return {};
  }
}

export async function getServerStaticBase(): Promise<string> {
  const config = await getServerSiteConfig();
  const staticUrl = config["s3.staticurl"];
  const configured = typeof staticUrl === "string" ? normalizeUrlBase(staticUrl) : "";
  return configured || getFallbackStaticBase();
}
