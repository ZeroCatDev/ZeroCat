"use client";

import * as React from "react";
import { Hash } from "lucide-react";
import { EmptyState } from "@/components/blog/empty-state";
import { TagChip } from "@/components/blog/tag-chip";
import { PageLoadError, TagListSkeleton } from "@/components/blog/public-page-primitives";
import { listAllTags } from "@/lib/api";
import type { Tag } from "@/lib/types";

export function TagsPageClient() {
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const tagsData = await listAllTags();
        if (cancelled) return;
        setTags(tagsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载标签失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Topics / 标签</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-[-1.9px]">全部标签</h1>
        <p className="text-sm text-muted-foreground">
          点击标签可查看相关文章流与作者内容。
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-card p-6 ring-border">
          <TagListSkeleton count={28} />
        </div>
      ) : error && tags.length === 0 ? (
        <PageLoadError
          title="标签加载失败"
          description="请稍后重试。"
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : tags.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="还没有标签"
          description="等第一批作者开始写作后，这里会快速增长。"
        />
      ) : (
        <div className="rounded-xl bg-card p-6 ring-border">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="lg" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
