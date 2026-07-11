"use client";

import * as React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { EmptyState } from "@/components/blog/empty-state";
import { CardGridSkeleton, PageLoadError, TagListSkeleton } from "@/components/blog/public-page-primitives";
import { listPosts, listTags } from "@/lib/api";
import type { PostsResponse, Tag } from "@/lib/types";

const EMPTY_POSTS: PostsResponse = { posts: [], total: 0, page: 1, limit: 20 };

export function ExplorePageClient() {
  const [latest, setLatest] = React.useState<PostsResponse>(EMPTY_POSTS);
  const [popular, setPopular] = React.useState<PostsResponse>(EMPTY_POSTS);
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
        const [latestData, popularData, tagsData] = await Promise.all([
          listPosts({ limit: 12, sort: "latest" }),
          listPosts({ limit: 8, sort: "popular" }),
          listTags(),
        ]);
        if (cancelled) return;
        setLatest(latestData);
        setPopular(popularData);
        setTags(tagsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载探索页失败");
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
    <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
      {error && !loading && latest.posts.length === 0 && popular.posts.length === 0 ? (
        <PageLoadError
          title="探索页加载失败"
          description="请检查网络连接后重试。"
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : (
        <>
          <div className="mb-12 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">热门文章</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/posts?sort=popular">查看更多</Link>
              </Button>
            </div>

            {loading ? (
              <CardGridSkeleton count={6} />
            ) : popular.posts.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="暂时没有热门内容"
                description="等社区产生更多访问数据后，这里会出现热门文章。"
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {popular.posts.slice(0, 6).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          <div className="mb-12 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">最新发布</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/posts?sort=latest">查看时间线</Link>
              </Button>
            </div>
            {loading ? (
              <CardGridSkeleton count={9} />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latest.posts.slice(0, 9).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">话题标签</h2>
            {loading ? (
              <TagListSkeleton count={20} />
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有标签，欢迎成为第一个发布者。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 30).map((tag) => (
                  <TagChip key={tag.id} tag={tag} size="lg" />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
