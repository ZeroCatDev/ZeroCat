import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { EmptyState } from "@/components/blog/empty-state";
import { buildPostsHref, normalizeAuthorParam } from "@/lib/blog-links";
import { listPosts, listTags } from "@/lib/api";

export const revalidate = 30;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const tag = pick(params.tag);
  const author = normalizeAuthorParam(pick(params.author));
  const sort = pick(params.sort) === "popular" ? "popular" : "latest";
  const page = Math.max(Number.parseInt(pick(params.page) || "1", 10) || 1, 1);
  const limit = 18;

  const [posts, tags] = await Promise.all([
    listPosts({
      page,
      limit,
      keyword: q || undefined,
      author: author || undefined,
      tag: tag || undefined,
      sort,
    }),
    listTags(),
  ]);

  const totalPages = Math.max(Math.ceil(posts.total / limit), 1);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-mono-label text-muted-foreground/70">Discover</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.025em]">
            全部文章
          </h1>
          <p className="text-sm text-muted-foreground">
            支持标签、作者、关键词与热度排序，快速定位社区内容。
          </p>
        </div>

        <form
          className="flex w-full max-w-xl flex-col sm:flex-row items-stretch sm:items-center gap-2"
          action="/posts"
          method="GET"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="搜索标题、摘要、作者..."
              className="pl-9"
            />
            {tag && <input type="hidden" name="tag" value={tag} />}
            <input type="hidden" name="sort" value={sort} />
          </div>
          <Input
            name="author"
            defaultValue={author}
            placeholder="作者用户名（可填 @xxx）"
            className="h-9 w-full sm:w-52"
          />
          <Button type="submit">搜索</Button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link
          href={buildPostsHref({ q, author, sort })}
          className={
            tag
              ? "inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              : "inline-flex items-center rounded-full bg-[var(--color-brand)] px-3 py-1 text-xs font-medium text-white shadow-sm"
          }
        >
          全部
        </Link>
        {tags.slice(0, 24).map((item) => (
          <TagChip
            key={item.id}
            tag={item}
            active={tag === item.name}
            size="sm"
            href={buildPostsHref({ q, author, tag: item.name, sort })}
          />
        ))}
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

      {posts.posts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="没有找到匹配文章"
          description="尝试调整关键词、标签或切换排序方式。"
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
