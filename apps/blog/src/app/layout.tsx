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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body className="font-sans antialiased min-h-screen bg-background flex flex-col">
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col w-full min-w-0 bg-background">
              <TopNav />
              <main className="flex-1 flex flex-col w-full page-transition">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
