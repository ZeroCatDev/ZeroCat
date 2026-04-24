"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Hash,
  Home,
  PenSquare,
  Search,
  User,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { search } from "@/lib/api";
import type { BlogPost, User as UserType } from "@/lib/types";

type Result = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  href: string;
  group: string;
};

const NAV_ITEMS: Result[] = [
  { icon: Home, label: "首页", href: "/", group: "导航" },
  { icon: FileText, label: "全部文章", href: "/posts", group: "导航" },
  { icon: Hash, label: "浏览标签", href: "/tags", group: "导航" },
  { icon: PenSquare, label: "开始写作", href: "/write", group: "导航" },
  { icon: Search, label: "创作搜索", href: "/studio/search", group: "导航" },
  { icon: User, label: "草稿箱", href: "/drafts", group: "导航" },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "/" && !open) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (!query.trim()) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) {
        setLoading(true);
      }
      try {
        const { projects, users } = await search(query.trim());
        if (cancelled) return;
        const mapped: Result[] = [];
        (users ?? []).slice(0, 5).forEach((u: UserType) => {
          mapped.push({
            icon: User,
            label: u.display_name || u.username,
            hint: `@${u.username}`,
            href: `/${u.username}`,
            group: "用户",
          });
        });
        (projects ?? []).slice(0, 8).forEach((p: BlogPost) => {
          const postSlug = p.blogConfig?.slug || p.id;
          mapped.push({
            icon: FileText,
            label: p.title || p.name,
            hint: p.author?.display_name || p.author?.username || "",
            href: p.author?.username
              ? `/${p.author.username}/${postSlug}`
              : `/posts/${p.id}`,
            group: "文章",
          });
        });
        setResults(mapped);
      } catch {
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex h-9 items-center gap-2 rounded-md bg-background px-3 text-sm text-muted-foreground ring-border hover:text-foreground transition-colors w-full max-w-xs"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">搜索文章 & 作者…</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="搜索文章、作者、标签…"
        />
        <CommandList>
          {!query && (
            <>
              <CommandGroup heading="导航">
                {NAV_ITEMS.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="提示">
                <div className="px-3 py-4 text-xs text-muted-foreground space-y-1.5">
                  <p className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    输入关键字搜索文章与用户
                  </p>
                  <p>
                    <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
                    {" "}
                    随时呼出命令台
                  </p>
                </div>
              </CommandGroup>
            </>
          )}
          {query && (
            <>
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  搜索中…
                </div>
              )}
              {!loading && results.length === 0 && (
                <CommandEmpty>没有匹配结果</CommandEmpty>
              )}
              {results.length > 0 && (
                <>
                  {groupBy(results).map(([group, items]) => (
                    <CommandGroup key={group} heading={group}>
                      {items.map((r, i) => (
                        <CommandItem
                          key={`${r.href}-${i}`}
                          value={`${r.label} ${r.hint ?? ""}`}
                          onSelect={() => go(r.href)}
                        >
                          <r.icon className="h-4 w-4" />
                          <span className="flex-1 truncate">{r.label}</span>
                          {r.hint && (
                            <CommandShortcut>{r.hint}</CommandShortcut>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value={`在全文搜索页打开 ${query}`}
                  onSelect={() => go(`/search?q=${encodeURIComponent(query)}`)}
                >
                  <Search className="h-4 w-4" />
                  <span>
                    查看全部「{query}」的结果
                  </span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function groupBy<T extends { group: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.group) ?? [];
    arr.push(item);
    map.set(item.group, arr);
  }
  return Array.from(map.entries());
}
