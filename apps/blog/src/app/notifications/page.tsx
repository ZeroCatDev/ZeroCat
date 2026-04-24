"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCheck,
  Inbox,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { buildZcLoginUrl, useAuthToken } from "@/lib/auth";
import { resolveAvatarUrl } from "@/lib/avatar";
import { cn, formatDate, initials } from "@/lib/utils";
import {
  deleteNotifications,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationsAsRead,
  type NotificationItem,
} from "@/lib/notifications";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

const PAGE_SIZE = 20;

type TabValue = "all" | "unread";

export default function NotificationsPage() {
  const { token, ready, isAuthed } = useAuthToken();
  const { refresh: refreshUnreadCount, unread } = useUnreadNotifications();
  const [tab, setTab] = React.useState<TabValue>("all");
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loadMoreUrl, setLoadMoreUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const fetchPage = React.useCallback(
    async (reset: boolean, currentTab: TabValue = tab) => {
      if (!isAuthed || !token) return;
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await listNotifications(
          reset
            ? { limit: PAGE_SIZE, offset: 0, unread_only: currentTab === "unread" }
            : { url: loadMoreUrl || undefined },
          token
        );
        setItems((prev) =>
          reset ? page.notifications : [...prev, ...page.notifications]
        );
        setTotal(page.total_rows_notifications);
        setLoadMoreUrl(page.load_more_notifications || null);
      } catch {
        toast.error("加载通知失败");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isAuthed, loadMoreUrl, tab, token]
  );

  React.useEffect(() => {
    if (!ready || !isAuthed) return;
    void fetchPage(true, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthed, tab]);

  const handleMarkAll = async () => {
    if (!token || unread === 0) return;
    setMarkingAll(true);
    try {
      const ok = await markAllNotificationsAsRead(token);
      if (ok) {
        setItems((prev) => prev.map((item) => ({ ...item, read: true })));
        await refreshUnreadCount();
        toast.success("已标记为全部已读");
      } else {
        toast.error("操作失败");
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOne = async (id: number) => {
    if (!token) return;
    const ok = await markNotificationsAsRead([id], token);
    if (ok) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      await refreshUnreadCount();
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    const ok = await deleteNotifications([id], token);
    if (ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      await refreshUnreadCount();
      toast.success("已删除通知");
    } else {
      toast.error("删除失败");
    }
  };

  if (!ready) {
    return <NotificationsSkeleton />;
  }

  if (!isAuthed) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 py-16">
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>通知需要登录后查看</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link
                href={buildZcLoginUrl(
                  typeof window !== "undefined" ? window.location.href : ""
                )}
              >
                前往登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 md:px-6 py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <p className="text-mono-label text-muted-foreground/70">Inbox</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-[-0.025em]">
            通知
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            共 {total} 条通知
            {unread > 0 && <> · 未读 <span className="font-semibold text-foreground">{unread}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={markingAll || unread === 0}
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            全部标记已读
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList className="rounded-full p-1">
          <TabsTrigger value="all" className="rounded-full">
            全部
          </TabsTrigger>
          <TabsTrigger value="unread" className="rounded-full">
            未读
            {unread > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-4 min-w-4 rounded-full px-1 text-[10px] bg-[var(--color-brand)] text-white"
              >
                {unread > 99 ? "99+" : unread}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {loading ? (
            <NotificationsSkeleton />
          ) : items.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="space-y-2.5 animate-in fade-in duration-300">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  onMarkRead={handleMarkOne}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}

          {loadMoreUrl && !loading && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchPage(false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                加载更多
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function NotificationRow({
  item,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const avatar = resolveAvatarUrl(item.actor?.avatar ?? null);
  const actorName =
    item.actor?.display_name || item.actor?.username || "系统通知";
  const title =
    item.title ||
    (typeof item.data?.title === "string" ? (item.data.title as string) : "新通知");
  const body =
    item.content ||
    (typeof item.data?.body === "string" ? (item.data.body as string) : null);
  const href = item.url || (typeof item.data?.url === "string" ? (item.data.url as string) : "#");
  const isInternal = href.startsWith("/");

  const wrapperClassName = cn(
    "group relative flex gap-3 rounded-xl bg-card p-4 ring-border transition-all duration-200 hover:shadow-card",
    !item.read && "ring-0 bg-[var(--color-brand-soft)]/40 dark:bg-[color-mix(in_oklab,var(--color-brand)_10%,transparent)] shadow-card"
  );

  const content = (
    <>
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback>
            {item.actor ? initials(actorName) : <Bell className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        {!item.read && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)] ring-2 ring-background" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight truncate">
              {title}
            </h3>
            {item.actor && (
              <p className="text-xs text-muted-foreground truncate">
                来自 {actorName}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {formatDate(item.created_at)}
          </span>
        </div>
        {body && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
            {body}
          </p>
        )}
      </div>
    </>
  );

  return (
    <li className={wrapperClassName}>
      {isInternal ? (
        <Link
          href={href}
          className="contents"
          onClick={() => !item.read && onMarkRead(item.id)}
        >
          {content}
        </Link>
      ) : href !== "#" ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="contents"
          onClick={() => !item.read && onMarkRead(item.id)}
        >
          {content}
        </a>
      ) : (
        <div className="contents">{content}</div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40" onClick={(event) => event.stopPropagation()}>
          {!item.read && (
            <DropdownMenuItem onClick={() => onMarkRead(item.id)}>
              <CheckCheck className="h-3.5 w-3.5" />
              标记已读
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onDelete(item.id)}
            className="text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const Icon = tab === "unread" ? BellOff : Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        {tab === "unread" ? "没有未读通知" : "收件箱是空的"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {tab === "unread" ? "你已经看完所有通知了。" : "还没有通知，先去写一篇文章吧。"}
      </p>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, idx) => (
        <li
          key={idx}
          className="flex gap-3 rounded-xl bg-card p-4 ring-border"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
