"use client";

import * as React from "react";
import { Check, Hash, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api";

type TagCandidate = {
  name: string;
  count: number;
};

export function PostTagSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<TagCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);

  const normalizedValue = React.useMemo(
    () => Array.from(new Set(value.map(normalizeTag).filter(Boolean))),
    [value]
  );

  const addTag = React.useCallback(
    (input: string) => {
      const next = normalizeTag(input);
      if (!next) return;
      if (normalizedValue.includes(next)) {
        setQuery("");
        return;
      }
      onChange([...normalizedValue, next]);
      setQuery("");
    },
    [normalizedValue, onChange]
  );

  const removeTag = React.useCallback(
    (name: string) => {
      onChange(normalizedValue.filter((item) => item !== name));
    },
    [normalizedValue, onChange]
  );

  React.useEffect(() => {
    if (!open) return;

    const keyword = query.trim();
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("scope", "tags");
        qs.set("type", "article");
        qs.set("state", "public");
        qs.set("page", "1");
        qs.set("perPage", "12");
        if (keyword) qs.set("keyword", keyword);

        const res = await apiFetch<{ tags?: TagCandidate[] }>(
          `/searchapi?${qs.toString()}`,
          { cache: "no-store" }
        );

        if (cancelled) return;

        const next = (res.tags ?? [])
          .map((tag) => ({
            name: normalizeTag(tag.name),
            count: Number(tag.count ?? 0),
          }))
          .filter((tag) => Boolean(tag.name));

        setOptions(next);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const canCreate = Boolean(query.trim()) && !normalizedValue.includes(normalizeTag(query));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {normalizedValue.length > 0 ? (
          normalizedValue.map((tag) => (
            <Badge key={tag} variant="secondary" className="h-7 gap-1 rounded-full px-2.5">
              <Hash className="h-3 w-3" />
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                aria-label={`移除标签 ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">还没有标签。可从推荐中选择，也可直接创建。</p>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start">
            <Plus className="h-4 w-4" />
            添加标签
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="搜索或创建标签"
            />
            <CommandList>
              {canCreate && (
                <CommandGroup heading="创建">
                  <CommandItem
                    value={`create-${query}`}
                    onSelect={() => {
                      addTag(query);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span>创建标签 “{normalizeTag(query)}”</span>
                  </CommandItem>
                </CommandGroup>
              )}

              <CommandGroup heading="推荐标签">
                {loading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">加载中…</div>
                ) : options.length === 0 ? (
                  <CommandEmpty>没有匹配标签</CommandEmpty>
                ) : (
                  options.map((tag) => {
                    const selected = normalizedValue.includes(tag.name);
                    return (
                      <CommandItem
                        key={tag.name}
                        value={tag.name}
                        onSelect={() => {
                          if (!selected) addTag(tag.name);
                        }}
                      >
                        <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                        <span className="flex-1">#{tag.name}</span>
                        <span className="text-xs text-muted-foreground">{tag.count}</span>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs leading-relaxed text-muted-foreground">
        输入关键词可检索已有标签；按创建可补充新标签。建议控制在 3 到 5 个，优先使用短词。
      </p>
    </div>
  );
}

function normalizeTag(value: string) {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
