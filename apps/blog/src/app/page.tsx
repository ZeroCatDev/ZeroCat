import Link from "next/link";
import { ArrowRight, FileText, Hash, PenSquare, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { AuthorCard } from "@/components/blog/author-card";
import { EmptyState } from "@/components/blog/empty-state";
import { listPosts, listTags } from "@/lib/api";

export default async function HomePage() {
  const [latest, popular, tags] = await Promise.all([
    listPosts({ limit: 10, sort: "latest" }),
    listPosts({ limit: 5, sort: "popular" }),
    listTags(),
  ]);

  const featured = latest.posts[0];
  const rest = latest.posts.slice(1);
  const featuredAuthors = dedupeAuthors(popular.posts.slice(0, 6));

  return (
    <>
      <Hero total={latest.total} />

      {/* Featured + latest posts in a uniform grid */}
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 pt-16 pb-12">
        <SectionHeader
          kicker="Latest"
          title="编辑推荐"
          trailing={
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/posts">
                查看全部 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />

        {latest.posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="暂时还没有文章"
            description="社区的第一位作者即将出现 — 或者就从你开始。"
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
            {featured && <PostCard post={featured} variant="prominent" />}

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

      {/* Popular + Tags + Voices */}
      <section className="border-t border-border/80">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-16 grid gap-10 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-6">
            <div>
              <p className="text-mono-label text-muted-foreground/70">Tags</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">热门话题</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                跟随标签探索领域内的优秀写作。
              </p>
            </div>
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
                kicker="Popular"
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
              {popular.posts.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 rounded-xl bg-card ring-border">
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

            {featuredAuthors.length > 0 && (
              <div>
                <SectionHeader kicker="Voices" title="活跃创作者" size="sm" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredAuthors.slice(0, 6).map((author) => (
                    <AuthorCard key={author.id} user={author} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeader({
  kicker,
  title,
  trailing,
  size = "default",
}: {
  kicker: string;
  title: string;
  trailing?: React.ReactNode;
  size?: "default" | "sm";
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div className="space-y-1.5">
        <p className="text-mono-label text-muted-foreground/70">{kicker}</p>
        <h2
          className={
            size === "sm"
              ? "text-2xl font-semibold tracking-[-0.02em]"
              : "text-3xl md:text-4xl font-semibold tracking-[-0.025em]"
          }
        >
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

function Hero({ total }: { total: number }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_900px_520px_at_15%_0%,color-mix(in_oklab,var(--color-brand)_14%,transparent),transparent),radial-gradient(ellipse_650px_400px_at_100%_30%,color-mix(in_oklab,var(--color-preview)_11%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_900px_520px_at_15%_0%,color-mix(in_oklab,var(--color-brand)_22%,transparent),transparent),radial-gradient(ellipse_650px_400px_at_100%_30%,color-mix(in_oklab,var(--color-preview)_18%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.06] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:40px_40px]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 md:px-6 py-20 md:py-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brand)]/25 bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-medium text-[var(--color-brand)] mb-6 shadow-sm dark:bg-[color-mix(in_oklab,var(--color-brand)_22%,transparent)] dark:text-[color-mix(in_oklab,var(--color-brand)_95%,white)]">
          <Sparkles className="h-3 w-3" />
          由 ZeroCat 生态提供支持
        </div>
        <h1 className="font-semibold tracking-[-0.04em] text-5xl md:text-7xl leading-[1.02] max-w-4xl">
          Think. Write.
          <br />
          <span className="bg-gradient-to-r from-[var(--color-brand)] via-[var(--color-develop)] to-[var(--color-preview)] bg-clip-text text-transparent">
            Ship to the world.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg md:text-xl text-muted-foreground leading-relaxed">
          专为开发者与创作者打造的现代博客社区。
          基于版本化的写作流程，支持 Markdown、协作与代码，
          让每一次发布都像部署一次一样优雅。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="gap-2 shadow-sm">
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
          <p className="mt-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span className="text-mono-label">
              社区现有 {total.toLocaleString()} 篇公开文章 · 持续增长中
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function dedupeAuthors(posts: Awaited<ReturnType<typeof listPosts>>["posts"]) {
  const seen = new Set<number>();
  const out: NonNullable<(typeof posts)[number]["author"]>[] = [];
  for (const p of posts) {
    if (!p.author) continue;
    if (seen.has(p.author.id)) continue;
    seen.add(p.author.id);
    out.push(p.author);
  }
  return out;
}

