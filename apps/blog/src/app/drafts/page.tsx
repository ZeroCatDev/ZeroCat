"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileStack,
  Loader2,
  PenSquare,
  Search as SearchIcon,
  MoreHorizontal,
  Trash2,
  Rocket,
  FileText,
  Globe,
  Eye,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/blog/empty-state";

import { buildZcLoginUrl, useAuthToken, useCurrentUser } from "@/lib/auth";
import {
  discardDraft,
  listDrafts,
  listPostsByAuthorId,
  publishDraft,
} from "@/lib/api";
import { cn, formatDate, formatNumber, truncate } from "@/lib/utils";
import { getPostHref } from "@/lib/blog-links";
import type { BlogPost, DraftListItem } from "@/lib/types";

type TabValue = "drafts" | "published";

export default function DraftsPage() {
  const router = useRouter();
  const { token, ready, isAuthed } = useAuthToken();
  const currentUser = useCurrentUser();

  const [tab, setTab] = React.useState<TabValue>("drafts");
  const [drafts, setDrafts] = React.useState<DraftListItem[]>([]);
  const [published, setPublished] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [busyMap, setBusyMap] = React.useState<
    Record<string, "publishing" | "deleting" | undefined>
  >({});
  const [pendingDelete, setPendingDelete] = React.useState<DraftListItem | null>(null);

  const refresh = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const draftsPromise = listDrafts(token);
      const publishedPromise = currentUser?.id
        ? listPostsByAuthorId(currentUser.id, { limit: 50 }).then((r) => r.posts)
        : Promise.resolve<BlogPost[]>([]);

      const [draftsData, publishedData] = await Promise.all([
        draftsPromise,
        publishedPromise,
      ]);
      setDrafts(draftsData);
      setPublished(publishedData);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [token, currentUser?.id]);

  React.useEffect(() => {
    if (!ready || !isAuthed || !token) return;
    void refresh();
  }, [ready, isAuthed, token, refresh]);

  const setBusy = (id: number | string, value?: "publishing" | "deleting") => {
    setBusyMap((prev) => ({ ...prev, [String(id)]: value }));
  };

  const handlePublish = async (item: DraftListItem) => {
    if (!token) return;
    setBusy(item.projectId, "publishing");
    try {
      await publishDraft(item.projectId, "从草稿箱发布", token);
      setDrafts((prev) => prev.filter((d) => d.projectId !== item.projectId));
      await refresh();
      toast.success("发布成功");
    } catch {
      toast.error("发布失败");
    } finally {
      setBusy(item.projectId);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !token) return;
    const item = pendingDelete;
    setPendingDelete(null);
    setBusy(item.projectId, "deleting");
    try {
      const removed = await discardDraft(item.projectId, token);
      if (removed) {
        setDrafts((prev) => prev.filter((d) => d.projectId !== item.projectId));
        toast.success("草稿已删除");
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setBusy(item.projectId);
    }
  };

  const filteredDrafts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((item) => {
      const title = (
        item.draft.title ||
        item.project.title ||
        `草稿 #${item.projectId}`
      ).toLowerCase();
      const summary = (item.draft.description || "").toLowerCase();
      return title.includes(q) || summary.includes(q);
    });
  }, [drafts, searchQuery]);

  const filteredPublished = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return published;
    return published.filter((post) => {
      const title = (post.title || post.name || "").toLowerCase();
      const summary = (post.summary || post.description || "").toLowerCase();
      return title.includes(q) || summary.includes(q);
    });
  }, [published, searchQuery]);

  if (!ready) return <PageSkeleton />;

  if (!isAuthed) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="rounded-2xl bg-card ring-border p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-xl font-semibold">需要登录</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            登录后即可管理你的草稿与已发布文章。
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild>
              <a
                href={buildZcLoginUrl(
                  typeof window !== "undefined" ? window.location.href : ""
                )}
              >
                前往登录
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 md:px-6 py-10">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-mono-label text-muted-foreground/70">Workbench</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-[-0.025em]">
            我的文章
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {drafts.length} 篇草稿 · {published.length} 篇已发布
          </p>
        </div>
        <Button asChild>
          <Link href="/write">
            <Plus className="h-4 w-4" />
            新建文章
          </Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
          <TabsList className="rounded-full p-1">
            <TabsTrigger value="drafts" className="rounded-full">
              <FileStack className="h-3.5 w-3.5 mr-1.5" />
              草稿
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
              >
                {drafts.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="published" className="rounded-full">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              已发布
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
              >
                {published.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder={tab === "drafts" ? "搜索草稿..." : "搜索已发布文章..."}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        <TabsContent value="drafts" className="mt-0 animate-in fade-in duration-300">
          {loading ? (
            <ListSkeleton />
          ) : filteredDrafts.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title={drafts.length === 0 ? "还没有草稿" : "没有匹配的草稿"}
              description={
                drafts.length === 0
                  ? "开始写作，你的草稿会自动保存到这里。"
                  : "试试其他关键词。"
              }
              action={
                drafts.length === 0 ? (
                  <Button asChild>
                    <Link href="/write">
                      <PenSquare className="h-4 w-4" />
                      开始写作
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredDrafts.map((item) => {
                const busy = busyMap[String(item.projectId)];
                const title =
                  item.draft.title ||
                  item.project.title ||
                  `草稿 #${item.projectId}`;
                const timeRaw =
                  item.savedAt || item.draft.savedAt || item.project.time;

                return (
                  <li
                    key={item.projectId}
                    className="group relative rounded-xl bg-card ring-border p-4 transition-all hover:shadow-card"
                  >
                    <Link
                      href={`/write?draft=${item.projectId}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pr-10"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight truncate group-hover:text-[var(--color-brand)] transition-colors">
                          {truncate(title, 80)}
                        </h3>
                        {item.draft.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {item.draft.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span>编辑于 {formatDate(timeRaw)}</span>
                      </div>
                    </Link>

                    <div className="absolute top-3 right-3">
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/write?draft=${item.projectId}`}>
                                <PenSquare className="h-3.5 w-3.5" />
                                继续编辑
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePublish(item)}>
                              <Rocket className="h-3.5 w-3.5" />
                              立即发布
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setPendingDelete(item)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除草稿
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-0 animate-in fade-in duration-300">
          {loading ? (
            <ListSkeleton />
          ) : filteredPublished.length === 0 ? (
            <EmptyState
              icon={Globe}
              title={published.length === 0 ? "还没有发布文章" : "没有匹配的文章"}
              description={
                published.length === 0
                  ? "把你的第一篇草稿发布到社区吧。"
                  : "试试其他关键词。"
              }
              action={
                published.length === 0 ? (
                  <Button asChild variant="outline">
                    <Link href="/write">
                      <PenSquare className="h-4 w-4" />
                      开始写作
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredPublished.map((post) => {
                const href = getPostHref({
                  ...post,
                  author:
                    post.author ??
                    (currentUser?.username
                      ? {
                          id: currentUser.id ?? 0,
                          username: currentUser.username,
                          display_name: currentUser.display_name ?? null,
                          avatar: currentUser.avatar ?? null,
                        }
                      : undefined),
                });
                return (
                  <li
                    key={post.id}
                    className="group relative rounded-xl bg-card ring-border p-4 transition-all hover:shadow-card"
                  >
                    <Link
                      href={href}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pr-10"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight truncate group-hover:text-[var(--color-brand)] transition-colors">
                          {truncate(post.title || post.name, 80)}
                        </h3>
                        {post.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {post.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatNumber(post.view_count)}
                        </span>
                        <span>发布于 {formatDate(post.time)}</span>
                      </div>
                    </Link>

                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/write?draft=${post.id}`}>
                              <PenSquare className="h-3.5 w-3.5" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={href}>
                              <Eye className="h-3.5 w-3.5" />
                              查看
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.draft.title || pendingDelete.project.title}&rdquo; 将被永久删除，不可恢复。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <li
          key={idx}
          className="flex items-center gap-3 rounded-xl bg-card ring-border p-4"
        >
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </li>
      ))}
    </ul>
  );
}

function PageSkeleton() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 md:px-6 py-10 space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-5 w-60" />
      <ListSkeleton />
    </section>
  );
}
