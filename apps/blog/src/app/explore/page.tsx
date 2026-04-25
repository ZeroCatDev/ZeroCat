import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { AuthorCard } from "@/components/blog/author-card";
import { EmptyState } from "@/components/blog/empty-state";
import { listPosts, listTags } from "@/lib/api";
import type { BlogPostAuthor } from "@/lib/types";

export default async function ExplorePage() {
  const [latest, popular, tags] = await Promise.all([
    listPosts({ limit: 12, sort: "latest" }),
    listPosts({ limit: 8, sort: "popular" }),
    listTags(),
  ]);

  const activeAuthors = dedupeAuthors([...popular.posts, ...latest.posts]).slice(0, 9);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
      <div className="mb-10 grid gap-6 rounded-2xl bg-[radial-gradient(ellipse_700px_260px_at_20%_0%,color-mix(in_oklab,var(--color-brand)_13%,transparent),transparent),radial-gradient(ellipse_620px_240px_at_100%_10%,color-mix(in_oklab,var(--color-preview)_10%,transparent),transparent)] dark:bg-[radial-gradient(ellipse_700px_260px_at_20%_0%,color-mix(in_oklab,var(--color-brand)_22%,transparent),transparent),radial-gradient(ellipse_620px_240px_at_100%_10%,color-mix(in_oklab,var(--color-preview)_18%,transparent),transparent)] p-8 ring-border md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-medium text-[var(--color-brand)] ring-border-light dark:bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)]">
            <Sparkles className="h-3 w-3" />
            Discovery / 社区发现
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold leading-[1.06] tracking-[-0.025em]">
            探索技术作者
            <br />
            和高质量文章
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
            在一个页面快速浏览热门文章、最新发布、活跃作者与话题标签。
            所有内容都来自 ZeroCat 社区实时数据。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/posts">
                浏览文章流 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tags">进入标签库</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl bg-card/90 p-5 ring-border">
          <p className="mb-4 text-mono-label text-muted-foreground/70">
            Trending Authors
          </p>
          {activeAuthors.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无活跃作者数据。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeAuthors.slice(0, 6).map((author) => (
                <AuthorCard key={author.id} user={author} variant="compact" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-12 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-mono-label text-muted-foreground/70">Popular</p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">热门文章</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/posts?sort=popular">查看更多</Link>
          </Button>
        </div>

        {popular.posts.length === 0 ? (
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
          <div>
            <p className="text-mono-label text-muted-foreground/70">Latest</p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">最新发布</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/posts?sort=latest">查看时间线</Link>
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {latest.posts.slice(0, 9).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl bg-card p-6 ring-border">
        <div>
          <p className="text-mono-label text-muted-foreground/70">Topics</p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]">话题标签</h2>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有标签，欢迎成为第一个发布者。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 30).map((tag) => (
              <TagChip key={tag.id} tag={tag} size="lg" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function dedupeAuthors(posts: Array<{ author?: BlogPostAuthor }>) {
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

