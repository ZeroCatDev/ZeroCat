"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Globe, PenSquare, Sparkles } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthToken, useCurrentUser } from "@/lib/auth";
import { listDrafts, listPostsByAuthorId } from "@/lib/api";
import type { BlogPost, DraftListItem } from "@/lib/types";
import { truncate } from "@/lib/utils";

const MAX_ITEMS = 4;

export function SidebarQuickAccess() {
  const { token, ready, isAuthed } = useAuthToken();
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const [drafts, setDrafts] = React.useState<DraftListItem[]>([]);
  const [published, setPublished] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ready || !isAuthed || !token) return;
    let canceled = false;
    setLoading(true);

    const publishedPromise = currentUser?.id
      ? listPostsByAuthorId(currentUser.id, { limit: MAX_ITEMS }).then(
          (r) => r.posts
        )
      : Promise.resolve<BlogPost[]>([]);

    Promise.all([listDrafts(token), publishedPromise])
      .then(([draftsData, publishedData]) => {
        if (canceled) return;
        setDrafts(draftsData.slice(0, MAX_ITEMS));
        setPublished(publishedData.slice(0, MAX_ITEMS));
      })
      .catch(() => {})
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [ready, isAuthed, token, pathname, currentUser?.id]);

  if (!ready || !isAuthed) {
    return null;
  }

  const username = currentUser?.username;

  return (
    <>
      <SidebarGroup>
        <div className="px-3 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-muted-foreground/70" />
          <span className="text-[10.5px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">
            快捷访问
          </span>
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/drafts" || pathname.startsWith("/drafts")}
                tooltip="我的草稿"
                className="transition-colors"
              >
                <Link href="/drafts?tab=drafts">
                  <FileText />
                  <span>我的草稿</span>
                  {drafts.length > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {drafts.length}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
              {loading ? (
                <SidebarMenuSub>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <SidebarMenuSubItem key={idx}>
                      <Skeleton className="h-5 w-full" />
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              ) : drafts.length > 0 ? (
                <SidebarMenuSub>
                  {drafts.map((d) => {
                    const title =
                      d.draft.title ||
                      d.project.title ||
                      `草稿 #${d.projectId}`;
                    return (
                      <SidebarMenuSubItem key={d.projectId}>
                        <SidebarMenuSubButton asChild>
                          <Link href={`/write?draft=${d.projectId}`}>
                            <span className="truncate">{truncate(title, 28)}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              ) : null}
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/drafts?tab=published"}
                tooltip="已发布"
                className="transition-colors"
              >
                <Link href="/drafts?tab=published">
                  <Globe />
                  <span>已发布</span>
                  {published.length > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {published.length}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
              {loading ? (
                <SidebarMenuSub>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <SidebarMenuSubItem key={idx}>
                      <Skeleton className="h-5 w-full" />
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              ) : published.length > 0 ? (
                <SidebarMenuSub>
                  {published.map((post) => {
                    const slug = post.blogConfig?.slug || post.id;
                    const href = username
                      ? `/${username}/${slug}`
                      : `/posts/${post.id}`;
                    return (
                      <SidebarMenuSubItem key={post.id}>
                        <SidebarMenuSubButton asChild>
                          <Link href={href}>
                            <span className="truncate">
                              {truncate(post.title || post.name, 28)}
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              ) : null}
            </SidebarMenuItem>

            {drafts.length === 0 && published.length === 0 && !loading && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="新建文章">
                  <Link
                    href="/write"
                    className="text-muted-foreground text-xs"
                  >
                    <PenSquare />
                    <span>新建你的第一篇文章</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
