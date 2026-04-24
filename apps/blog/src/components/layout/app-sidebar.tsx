"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BookOpen,
    Compass,
    FilePenLine,
    Home,
    Inbox,
    Settings,
    Cat,
    Bell,
    GitBranch,
    Sparkles,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
} from "@/components/ui/sidebar"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import { CommandMenu } from "./command-menu"
import { SidebarQuickAccess } from "./sidebar-quick-access"
import { useUnreadNotifications } from "@/hooks/use-unread-notifications"

const itemsNav = [
    { title: "首页", url: "/", icon: Home },
    { title: "探索", url: "/explore", icon: Compass },
    { title: "文章", url: "/posts", icon: BookOpen },
]

const itemsAuthor = [
    { title: "写作", url: "/write", icon: FilePenLine },
    { title: "草稿", url: "/drafts", icon: Inbox },
    { title: "GitHub 同步", url: "/studio/sync", icon: GitBranch },
]

const itemsSecondary = [
    { title: "设置", url: "/studio/search", icon: Settings },
]

export function AppSidebar() {
    const pathname = usePathname()
    const { unread } = useUnreadNotifications()

    return (
        <Sidebar className="border-r border-sidebar-border">
            <SidebarHeader className="px-4 py-4 h-14 flex flex-row items-center">
                <Link href="/" className="flex flex-row items-center gap-2.5 w-full group">
                    <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-preview)] text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                        <Cat className="h-4.5 w-4.5" strokeWidth={2.25} />
                    </span>
                    <span className="font-semibold font-sans text-[15px] tracking-tight truncate">
                        ZeroCat Blog
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="gap-0">
                <SidebarGroup className="pt-0">
                    <div className="px-2 mb-3">
                        <CommandMenu />
                    </div>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {itemsNav.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.url}
                                        tooltip={item.title}
                                        className="transition-colors"
                                    >
                                        <Link href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <div className="px-3 mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-muted-foreground/70" />
                        <span className="text-[10.5px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">创作者</span>
                    </div>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {itemsAuthor.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))}
                                        tooltip={item.title}
                                        className="transition-colors"
                                    >
                                        <Link href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarQuickAccess />
            </SidebarContent>

            <SidebarFooter className="pb-3">
                <SidebarGroup className="py-0">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname.startsWith("/notifications")}
                                tooltip="通知"
                                className="transition-colors"
                            >
                                <Link href="/notifications">
                                    <Bell />
                                    <span>通知</span>
                                </Link>
                            </SidebarMenuButton>
                            {unread > 0 && (
                                <SidebarMenuBadge className="bg-[var(--color-brand)] text-white font-semibold">
                                    {unread > 99 ? "99+" : unread}
                                </SidebarMenuBadge>
                            )}
                        </SidebarMenuItem>
                        {itemsSecondary.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === item.url}
                                    tooltip={item.title}
                                    className="transition-colors"
                                >
                                    <Link href={item.url}>
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                <div className="mt-1 px-3 pt-3 flex items-center justify-between border-t border-sidebar-border/60">
                    <UserNav />
                    <ThemeToggle />
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
