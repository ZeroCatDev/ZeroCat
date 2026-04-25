import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getServerStaticBase } from "@/lib/site-config";

function ThemeScript() {
  const script = `
    (() => {
      try {
        const storageKey = "theme";
        const stored = localStorage.getItem(storageKey);
        const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const resolved = theme === "system" ? systemTheme : theme;
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolved);
        root.style.colorScheme = resolved;
        root.style.backgroundColor = resolved === "dark" ? "oklch(0.13 0 0)" : "oklch(1 0 0)";
      } catch {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function RuntimeConfigScript({ staticBase }: { staticBase: string }) {
  const script = `window.__ZC_STATIC_URL__ = ${JSON.stringify(staticBase)};`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "ZeroCat Blog — 创作者的现代化博客社区",
    template: "%s · ZeroCat Blog",
  },
  description:
    "一个属于创作者的现代化博客平台，基于 ZeroCat 生态，支持 Markdown、版本化写作与社区互动。",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000"
  ),
  openGraph: {
    type: "website",
    siteName: "ZeroCat Blog",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staticBase = await getServerStaticBase();

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      data-zc-static-url={staticBase || undefined}
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <head>
        <ThemeScript />
        <RuntimeConfigScript staticBase={staticBase} />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background flex flex-col">
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="app-shell flex-1 flex flex-col w-full min-w-0 bg-background">
              <TopNav />
              <main className="flex-1 flex flex-col w-full">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
