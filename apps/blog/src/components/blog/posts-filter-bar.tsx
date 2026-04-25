"use client";

import * as React from "react";
import { Hash, Search, User as UserIcon, X, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TagCandidate {
  name: string;
  count: number;
}

interface User {
  id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
}

interface PostSearchBarProps {
  initialKeyword?: string;
  tag?: string;
  author?: string;
  sort?: "latest" | "popular";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildPostsHref(params: {
  q?: string;
  tag?: string;
  author?: string;
  sort?: string;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.tag) sp.set("tag", params.tag);
  if (params.author) sp.set("author", params.author);
  if (params.sort && params.sort !== "latest") sp.set("sort", params.sort);
  const qs = sp.toString();
  return `/posts${qs ? `?${qs}` : ""}`;
}

function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PostSearchBar({
  initialKeyword = "",
  tag,
  author,
  sort = "latest",
}: PostSearchBarProps) {
  const router = useRouter();

  // Keyword
  const [keyword, setKeyword] = React.useState(initialKeyword);

  // Tag chip popover
  const [tagChipOpen, setTagChipOpen] = React.useState(false);
  const [tagQuery, setTagQuery] = React.useState("");
  const [tagOptions, setTagOptions] = React.useState<TagCandidate[]>([]);
  const [tagLoading, setTagLoading] = React.useState(false);
  const tagChipRef = React.useRef<HTMLButtonElement>(null);
  const tagPopoverRef = React.useRef<HTMLDivElement>(null);

  // Author chip popover
  const [authorChipOpen, setAuthorChipOpen] = React.useState(false);
  const [authorQuery, setAuthorQuery] = React.useState("");
  const [authorOptions, setAuthorOptions] = React.useState<User[]>([]);
  const [authorLoading, setAuthorLoading] = React.useState(false);
  const authorChipRef = React.useRef<HTMLButtonElement>(null);
  const authorPopoverRef = React.useRef<HTMLDivElement>(null);

  // Resolved author profile (for the active chip)
  const [resolvedAuthor, setResolvedAuthor] = React.useState<User | null>(null);

  /* ---------- Click outside handlers ---------- */
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagChipOpen &&
        tagChipRef.current &&
        !tagChipRef.current.contains(e.target as Node) &&
        tagPopoverRef.current &&
        !tagPopoverRef.current.contains(e.target as Node)
      ) {
        setTagChipOpen(false);
        setTagQuery("");
      }

      if (
        authorChipOpen &&
        authorChipRef.current &&
        !authorChipRef.current.contains(e.target as Node) &&
        authorPopoverRef.current &&
        !authorPopoverRef.current.contains(e.target as Node)
      ) {
        setAuthorChipOpen(false);
        setAuthorQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagChipOpen, authorChipOpen]);

  /* ---------- Resolve author when `author` prop changes ---------- */
  React.useEffect(() => {
    if (!author) {
      setResolvedAuthor(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("scope", "users");
        qs.set("keyword", author);
        qs.set("page", "1");
        qs.set("perPage", "1");

        const res = await apiFetch<{ users?: User[] }>(
          `/searchapi?${qs.toString()}`,
          { cache: "no-store" }
        );

        if (cancelled) return;

        const match = (res.users ?? []).find(
          (u) => u.username.toLowerCase() === author.toLowerCase()
        );

        setResolvedAuthor(
          match ?? {
            id: 0,
            username: author,
            display_name: null,
            avatar: null,
            bio: null,
          }
        );
      } catch {
        if (!cancelled) {
          setResolvedAuthor({
            id: 0,
            username: author,
            display_name: null,
            avatar: null,
            bio: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [author]);

  /* ---------- Tag search debounce ---------- */
  React.useEffect(() => {
    if (!tagChipOpen) return;

    const kw = tagQuery.trim();
    if (!kw) {
      setTagOptions([]);
      setTagLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) setTagLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("scope", "tags");
        qs.set("type", "article");
        qs.set("state", "public");
        qs.set("keyword", kw);
        qs.set("page", "1");
        qs.set("perPage", "10");

        const res = await apiFetch<{ tags?: TagCandidate[] }>(
          `/searchapi?${qs.toString()}`,
          { cache: "no-store" }
        );

        if (cancelled) return;
        setTagOptions(
          (res.tags ?? [])
            .map((t) => ({
              name: String(t.name || "").trim(),
              count: Number(t.count ?? 0),
            }))
            .filter((t) => Boolean(t.name))
        );
      } catch {
        if (!cancelled) setTagOptions([]);
      } finally {
        if (!cancelled) setTagLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tagQuery, tagChipOpen]);

  /* ---------- Author search debounce ---------- */
  React.useEffect(() => {
    if (!authorChipOpen) return;

    const kw = authorQuery.trim();
    if (!kw) {
      setAuthorOptions([]);
      setAuthorLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) setAuthorLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("scope", "users");
        qs.set("keyword", kw);
        qs.set("page", "1");
        qs.set("perPage", "10");

        const res = await apiFetch<{ users?: User[] }>(
          `/searchapi?${qs.toString()}`,
          { cache: "no-store" }
        );

        if (cancelled) return;
        setAuthorOptions(res.users ?? []);
      } catch {
        if (!cancelled) setAuthorOptions([]);
      } finally {
        if (!cancelled) setAuthorLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authorQuery, authorChipOpen]);

  /* ---------- Apply helpers ---------- */
  const applyTag = (name: string) => {
    const normalized = String(name || "")
      .trim()
      .replace(/^#+/, "");
    if (!normalized) return;
    router.push(buildPostsHref({ q: keyword, author, tag: normalized, sort }));
    setTagQuery("");
    setTagChipOpen(false);
  };

  const applyAuthor = (username: string) => {
    const normalized = String(username || "")
      .trim()
      .replace(/^@+/, "");
    if (!normalized) return;
    router.push(buildPostsHref({ q: keyword, author: normalized, tag, sort }));
    setAuthorQuery("");
    setAuthorChipOpen(false);
  };

  const removeTag = () => {
    router.push(buildPostsHref({ q: keyword, author, sort }));
  };

  const removeAuthor = () => {
    router.push(buildPostsHref({ q: keyword, tag, sort }));
  };

  /* ---------- Render ---------- */
  return (
    <div className="w-full max-w-3xl space-y-3">
      {/* -------- Search form with filter chips -------- */}
      <form action="/posts" method="GET" className="w-full">
        <div className="flex w-full flex-col gap-2">
          {/* Search input and filter chips row */}
          <div className="flex items-center gap-2">
            {/* Keyword input */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索标题、摘要..."
                className="pl-9"
              />
              {tag && <input type="hidden" name="tag" value={tag} />}
              {author && <input type="hidden" name="author" value={author} />}
              <input type="hidden" name="sort" value={sort} />
            </div>

            <Button type="submit" className="shrink-0">
              搜索
            </Button>
          </div>

          {/* Filter chips row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tag chip */}
            <div className="relative">
              {tag ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-sm font-normal"
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="max-w-[200px] truncate">{tag}</span>
                  <button
                    type="button"
                    onClick={removeTag}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-muted-foreground/20"
                    aria-label="移除标签筛选"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : (
                <button
                  ref={tagChipRef}
                  type="button"
                  onClick={() => setTagChipOpen(!tagChipOpen)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Hash className="h-3.5 w-3.5 opacity-60" />
                  <span>标签</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              )}

              {/* Tag popover */}
              {tagChipOpen && !tag && (
                <div
                  ref={tagPopoverRef}
                  className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
                >
                  <div className="p-2">
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={tagQuery}
                        onChange={(e) => setTagQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (tagOptions.length > 0) {
                            applyTag(tagOptions[0].name);
                            return;
                          }
                          const raw = tagQuery.trim();
                          if (raw) applyTag(raw);
                        }}
                        placeholder="输入标签名称..."
                        className="h-9 pl-8"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="border-t">
                    {tagLoading && (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">
                        搜索中…
                      </div>
                    )}
                    {!tagLoading && tagQuery.trim() && tagOptions.length === 0 && (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">
                        没有匹配标签
                      </div>
                    )}
                    {!tagLoading && tagOptions.length > 0 && (
                      <div className="max-h-64 overflow-auto p-1">
                        {tagOptions.slice(0, 10).map((t) => (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => applyTag(t.name)}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                          >
                            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-left">
                              #{t.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatNumber(t.count)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!tagLoading && !tagQuery.trim() && (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">
                        输入标签名称进行搜索
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Author chip */}
            <div className="relative">
              {author ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 rounded-full py-1 pl-1 pr-1 text-sm font-normal"
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    {resolveAvatarUrl(resolvedAuthor?.avatar) ? (
                      <AvatarImage
                        src={resolveAvatarUrl(resolvedAuthor?.avatar) ?? ""}
                        alt=""
                      />
                    ) : null}
                    <AvatarFallback className="text-[9px]">
                      {initials(
                        resolvedAuthor?.display_name ||
                          resolvedAuthor?.username ||
                          author
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[200px] truncate">
                    {resolvedAuthor?.display_name ||
                      resolvedAuthor?.username ||
                      author}
                  </span>
                  <button
                    type="button"
                    onClick={removeAuthor}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-muted-foreground/20"
                    aria-label="移除作者筛选"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : (
                <button
                  ref={authorChipRef}
                  type="button"
                  onClick={() => setAuthorChipOpen(!authorChipOpen)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <UserIcon className="h-3.5 w-3.5 opacity-60" />
                  <span>作者</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              )}

              {/* Author popover */}
              {authorChipOpen && !author && (
                <div
                  ref={authorPopoverRef}
                  className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
                >
                  <div className="p-2">
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={authorQuery}
                        onChange={(e) => setAuthorQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (authorOptions.length > 0) {
                            applyAuthor(authorOptions[0].username);
                            return;
                          }
                          const raw = authorQuery.trim();
                          if (raw) applyAuthor(raw);
                        }}
                        placeholder="输入作者名称..."
                        className="h-9 pl-8"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="border-t">
                    {authorLoading && (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">
                        搜索中…
                      </div>
                    )}
                    {!authorLoading &&
                      authorQuery.trim() &&
                      authorOptions.length === 0 && (
                        <div className="px-3 py-2.5 text-xs text-muted-foreground">
                          没有匹配作者
                        </div>
                      )}
                    {!authorLoading && authorOptions.length > 0 && (
                      <div className="max-h-64 overflow-auto p-1">
                        {authorOptions.slice(0, 10).map((u) => {
                          const avatarSrc = resolveAvatarUrl(u.avatar);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => applyAuthor(u.username)}
                              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            >
                              <Avatar className="h-7 w-7 shrink-0">
                                {avatarSrc ? (
                                  <AvatarImage src={avatarSrc} alt="" />
                                ) : null}
                                <AvatarFallback className="text-[10px]">
                                  {initials(u.display_name || u.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium leading-tight">
                                  {u.display_name || u.username}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  @{u.username}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!authorLoading && !authorQuery.trim() && (
                      <div className="px-3 py-2.5 text-xs text-muted-foreground">
                        输入作者名称进行搜索
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}



