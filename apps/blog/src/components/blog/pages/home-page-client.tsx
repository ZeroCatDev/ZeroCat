"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Hash, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { AuthorCard } from "@/components/blog/author-card";
import { EmptyState } from "@/components/blog/empty-state";
import { AuthorGridSkeleton, CardGridSkeleton, PageLoadError, TagListSkeleton } from "@/components/blog/public-page-primitives";
import { listPosts, listTags } from "@/lib/api";
import type { BlogPostAuthor, PostsResponse, Tag } from "@/lib/types";

const EMPTY_POSTS: PostsResponse = { posts: [], total: 0, page: 1, limit: 20 };

export function HomePageClient() {
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
          listPosts({ limit: 10, sort: "latest" }),
          listPosts({ limit: 5, sort: "popular" }),
          listTags(),
        ]);
        if (cancelled) return;
        setLatest(latestData);
        setPopular(popularData);
        setTags(tagsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载首页内容失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const featured = latest.posts[0];
  const rest = latest.posts.slice(1);
  const featuredAuthors = dedupeAuthors(popular.posts.slice(0, 6));

  return (
    <>
      <Hero total={latest.total} />

      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 pt-16 pb-12">
        <SectionHeader
          title="编辑推荐"
          trailing={
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/posts">
                查看全部 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-6">
            <CardGridSkeleton count={1} className="grid" />
            <CardGridSkeleton count={6} />
          </div>
        ) : error && latest.posts.length === 0 ? (
          <PageLoadError
            title="首页内容加载失败"
            description="请检查网络或稍后重试。"
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : latest.posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="暂时还没有文章"
            description="社区的第一位作者即将出现，或者就从你开始。"
            action={
              <Button asChild className="mt-2">
                <Link href="/write">
                  <PenSquare className="h-4 w-4" />
                  开始写作
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {featured ? <PostCard post={featured} variant="prominent" /> : null}

            {rest.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border-t border-border/80">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-16 grid gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">热门话题</h2>
            </div>
            {loading ? (
              <TagListSkeleton count={12} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 20).map((tag) => (
                  <TagChip key={tag.id} tag={tag} size="sm" />
                ))}
                {tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    还没有标签，成为第一个吧。
                  </p>
                )}
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/tags">
                <Hash className="h-3.5 w-3.5" />
                浏览全部标签
              </Link>
            </Button>
          </aside>

          <div className="space-y-12">
            <div>
              <SectionHeader
                title="本周阅读"
                size="sm"
                trailing={
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <Link href="/posts?sort=popular">
                      更多 <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                }
              />
              {loading ? (
                <CardGridSkeleton count={4} className="grid gap-6 sm:grid-cols-2" />
              ) : popular.posts.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 rounded-lg border bg-card">
                  暂无数据。
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {popular.posts.slice(0, 4).map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div>
                <SectionHeader title="活跃创作者" size="sm" />
                <AuthorGridSkeleton />
              </div>
            ) : featuredAuthors.length > 0 ? (
              <div>
                <SectionHeader title="活跃创作者" size="sm" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredAuthors.slice(0, 6).map((author) => (
                    <AuthorCard key={author.id} user={author} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeader({
  title,
  trailing,
  size = "default",
}: {
  kicker?: string;
  title: string;
  trailing?: React.ReactNode;
  size?: "default" | "sm";
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h2
        className={
          size === "sm"
            ? "text-2xl font-semibold tracking-[-0.02em]"
            : "text-3xl md:text-4xl font-semibold tracking-[-0.025em]"
        }
      >
        {title}
      </h2>
      {trailing}
    </div>
  );
}

function Hero({ total }: { total: number }) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-16 md:py-24">
        <h1 className="font-semibold tracking-[-0.04em] text-5xl md:text-7xl leading-[1.02] max-w-4xl">
          Think. Write.
          <br />
          <span className="text-[var(--color-brand)]">
            Ship to the world.
          </span>
        </h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/write">
              <PenSquare className="h-4 w-4" />
              开始写作
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/posts">浏览文章</Link>
          </Button>
        </div>
        {total > 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            {total.toLocaleString()} 篇文章
          </p>
        )}
      </div>
    </section>
  );
}

function dedupeAuthors(posts: PostsResponse["posts"]) {
  const seen = new Set<number>();
  const out: BlogPostAuthor[] = [];
  for (const post of posts) {
    if (!post.author) continue;
    if (seen.has(post.author.id)) continue;
    seen.add(post.author.id);
    out.push(post.author);
  }
  return out;
}
