import Link from "next/link";
import type { Metadata } from "next";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/blog/empty-state";
import { listPosts } from "@/lib/api";

type PageProps = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const name = decodeURIComponent(tag);
  return {
    title: `#${name} 标签`,
    description: `浏览与 #${name} 相关的社区文章。`,
  };
}

export const revalidate = 30;

export default async function TagPostsPage({ params, searchParams }: PageProps) {
  const { tag: rawTag } = await params;
  const query = await searchParams;
  const tag = decodeURIComponent(rawTag);
  const page = Math.max(Number.parseInt(pick(query.page) || "1", 10) || 1, 1);
  const sort = pick(query.sort) === "popular" ? "popular" : "latest";
  const limit = 15;

  const res = await listPosts({ tag, page, limit, sort });
  const totalPages = Math.max(Math.ceil(res.total / limit), 1);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-mono-label text-muted-foreground/70">Tag Stream</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.025em] inline-flex items-center gap-2">
            <Hash className="h-8 w-8" />
            {tag}
          </h1>
          <p className="text-sm text-muted-foreground">共 {res.total} 篇文章</p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant={sort === "latest" ? "default" : "outline"} size="sm">
            <Link href={buildHref(tag, { sort: "latest" })}>最新</Link>
          </Button>
          <Button asChild variant={sort === "popular" ? "default" : "outline"} size="sm">
            <Link href={buildHref(tag, { sort: "popular" })}>热门</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tags">返回标签列表</Link>
          </Button>
        </div>
      </div>

      {res.posts.length === 0 ? (
        <EmptyState icon={Hash} title="当前标签暂无文章" description="换个标签看看，或等待作者发布新内容。" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {res.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between rounded-xl bg-card p-4 ring-border">
        <p className="text-sm text-muted-foreground">
          第 {page} / {totalPages} 页
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={buildHref(tag, { page: page - 1, sort })}>上一页</Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={buildHref(tag, { page: page + 1, sort })}>下一页</Link>
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

function buildHref(tag: string, input: { page?: number; sort?: "latest" | "popular" }) {
  const qs = new URLSearchParams();
  if (input.sort) qs.set("sort", input.sort);
  if (input.page && input.page > 1) qs.set("page", String(input.page));
  const tail = qs.toString();
  return tail
    ? `/tags/${encodeURIComponent(tag)}?${tail}`
    : `/tags/${encodeURIComponent(tag)}`;
}
