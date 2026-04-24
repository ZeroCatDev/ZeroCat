"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { Cat, Bell } from "lucide-react"
import Link from "next/link"
import { useUnreadNotifications } from "@/hooks/use-unread-notifications"
import { cn } from "@/lib/utils"

export function TopNav() {
    const pathname = usePathname()
    const { unread } = useUnreadNotifications()
    const isWritePage = pathname.startsWith("/write")

    return (
        <header className={cn(
            "sticky top-0 z-40 flex h-14 w-full items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70",
            "md:hidden"
        )}>
            <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger />
                <Link href="/" className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-preview)] text-white">
                        <Cat className="h-4 w-4" />
                    </span>
                    <span className="font-semibold tracking-tight truncate">ZeroCat</span>
                </Link>
                {isWritePage && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">写作中</span>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                <Link
                    href="/notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
                    aria-label="通知"
                >
                    <Bell className="h-4 w-4" />
                    {unread > 0 && (
                        <span className="absolute top-1 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-brand)] px-1 text-[10px] font-semibold text-white">
                            {unread > 99 ? "99+" : unread}
                        </span>
                    )}
                </Link>
                <UserNav />
            </div>
        </header>
    )
}
