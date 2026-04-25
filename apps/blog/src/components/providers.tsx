"use client";

import * as React from "react";
import { ThemeProvider } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { API_URL } from "@/lib/api";

declare global {
  interface Window {
    __ZC_STATIC_URL__?: string;
  }
}

const CONFIG_CACHE_KEY = "zc_blog_runtime_config";
const CONFIG_TTL = 10 * 60 * 1000;

function normalizeBase(value: unknown): string {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function applyStaticBase(value: unknown) {
  const normalized = normalizeBase(value);
  if (!normalized || typeof window === "undefined") return;
  window.__ZC_STATIC_URL__ = normalized;
  document.documentElement.dataset.zcStaticUrl = normalized;
}

function RuntimeConfigBootstrap() {
  React.useEffect(() => {
    let cancelled = false;

    const applyCached = () => {
      try {
        const raw = window.localStorage.getItem(CONFIG_CACHE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { expiresAt?: number; staticBase?: string };
        if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) return false;
        applyStaticBase(parsed.staticBase);
        return true;
      } catch {
        return false;
      }
    };

    const load = async () => {
      applyCached();

      try {
        const res = await fetch(`${API_URL}/api/config`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;

        const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const staticBase = normalizeBase(payload?.["s3.staticurl"]);
        if (!staticBase) return;

        applyStaticBase(staticBase);
        window.localStorage.setItem(
          CONFIG_CACHE_KEY,
          JSON.stringify({
            staticBase,
            expiresAt: Date.now() + CONFIG_TTL,
          })
        );
      } catch {
        // ignore runtime config failures and keep fallback values
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <RuntimeConfigBootstrap />
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
