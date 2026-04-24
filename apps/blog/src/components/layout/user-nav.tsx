"use client";

import * as React from "react";
import Link from "next/link";
import { LogIn, LogOut, PenSquare, UserRound, FileStack, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildZcLoginUrl, useAuthToken, useCurrentUser } from "@/lib/auth";
import { resolveAvatarUrl } from "@/lib/avatar";
import { initials } from "@/lib/utils";

export function UserNav() {
  const { isAuthed, ready, clear } = useAuthToken();
  const user = useCurrentUser();

  if (!ready) {
    return <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />;
  }

  if (!isAuthed) {
    const loginUrl = buildZcLoginUrl();
    return (
      <Button asChild size="sm" variant="default">
        <a href={loginUrl}>
          <LogIn className="h-4 w-4" />
          登录
        </a>
      </Button>
    );
  }

  const displayName = user?.display_name || user?.username || "Me";
  const username = user?.username || "";
  const avatarSrc = resolveAvatarUrl(user?.avatar || null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={displayName} />
            ) : null}
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{displayName}</span>
              <span className="text-xs text-muted-foreground">@{username}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {username && (
          <DropdownMenuItem asChild>
            <Link href={`/${username}`}>
              <UserRound className="mr-2 h-4 w-4" />
              <span>我的主页</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/studio/search">
            <Home className="mr-2 h-4 w-4" />
            <span>仪表盘</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={clear}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
