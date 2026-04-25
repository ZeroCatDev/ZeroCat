import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthorCard } from "@/components/blog/author-card";
import { PostCard } from "@/components/blog/post-card";
import  PostsFilterBar from "@/components/blog/posts-filter-bar";
import { EmptyState } from "@/components/blog/empty-state";
import { buildPostsHref, normalizeAuthorParam } from "@/lib/blog-links";
import { listPosts, search } from "@/lib/api";

export const revalidate = 30;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = pick(params.q).trim();
  if (!q) {
    return {
      title: "全部文章",
      description: "浏览 ZeroCat Blog 的全部文章，按关键词、作者、标签与热度筛选。",
    };
  }

  return {
    title: `搜索: ${q}`,
    description: `查看与 ${q} 相关的文章和作者结果。`,
  };
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const tag = pick(params.tag);
  const author = normalizeAuthorParam(pick(params.author));
  const sort = pick(params.sort) === "popular" ? "popular" : "latest";
  const page = Math.max(Number.parseInt(pick(params.page) || "1", 10) || 1, 1);
  const limit = 18;

  const [posts, searchResult] = await Promise.all([
    listPosts({
      page,
      limit,
      keyword: q || undefined,
      author: author || undefined,
      tag: tag || undefined,
      sort,
    }),
    q ? search(q) : Promise.resolve({ users: [] }),
  ]);

  const totalPages = Math.max(Math.ceil(posts.total / limit), 1);
  const users = (searchResult.users ?? []).slice(0, 6);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-mono-label text-muted-foreground/70">Discover</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.025em]">
            {q ? "搜索文章与作者" : "全部文章"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {q
              ? `当前关键词“${q}”的全部结果，支持继续按标签、作者与热度收窄。`
              : "支持标签、作者、关键词与热度排序，快速定位社区内容。"}
          </p>
        </div>

        <PostsFilterBar initialKeyword={q} tag={tag} author={author} sort={sort} />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Button asChild variant={sort === "latest" ? "default" : "outline"} size="sm">
          <Link href={buildPostsHref({ q, author, tag, sort: "latest" })}>最新发布</Link>
        </Button>
        <Button asChild variant={sort === "popular" ? "default" : "outline"} size="sm">
          <Link href={buildPostsHref({ q, author, tag, sort: "popular" })}>热门阅读</Link>
        </Button>
        {(q || tag || author) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/posts">清除筛选</Link>
          </Button>
        )}
      </div>

      {q && users.length > 0 && (
        <div className="mb-10 space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold tracking-[-0.02em]">相关作者</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <AuthorCard key={user.id} user={user} variant="compact" />
            ))}
          </div>
        </div>
      )}

      {posts.posts.length === 0 ? (
        <EmptyState
          icon={Search}
          title={q ? "没有找到匹配结果" : "没有找到匹配文章"}
          description={q ? "尝试调整关键词、标签或作者筛选。" : "尝试调整关键词、标签或切换排序方式。"}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between rounded-xl bg-card p-4 ring-border">
        <p className="text-sm text-muted-foreground">
          第 {page} / {totalPages} 页 · 共 {posts.total} 篇
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={buildPostsHref({ q, author, tag, sort, page: page - 1 })}>
              <ArrowLeft className="h-4 w-4" /> 上一页
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={buildPostsHref({ q, author, tag, sort, page: page + 1 })}>
              下一页 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function pick(value?: string | string[]) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}
