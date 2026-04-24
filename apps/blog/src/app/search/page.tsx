import Link from "next/link";
import type { Metadata } from "next";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthorCard } from "@/components/blog/author-card";
import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/blog/empty-state";
import { listPosts, listTags, search } from "@/lib/api";
import type { BlogPost } from "@/lib/types";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = pick(params.q);
  if (!q) {
    return {
      title: "搜索",
      description: "搜索 ZeroCat Blog 的文章与作者。",
    };
  }

  return {
    title: `搜索: ${q}`,
    description: `查看与 ${q} 相关的文章和作者。`,
  };
}

export const revalidate = 30;

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q).trim();

  if (!q) {
    const [tags, latest] = await Promise.all([listTags(), listPosts({ limit: 6 })]);
    return (
      <section className="mx-auto w-full max-w-[1600px] px-6 py-10">
        <SearchHeader />

        <div className="space-y-6 rounded-xl bg-card p-6 ring-border">
          <h2 className="text-xl font-semibold">输入关键词开始搜索</h2>
          <p className="text-sm text-muted-foreground">
            支持按文章标题、摘要、作者名称进行快速检索。
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 12).map((tag) => (
              <Button key={tag.id} asChild variant="outline" size="sm">
                <Link href={`/search?q=${encodeURIComponent(tag.name)}`}>#{tag.name}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold tracking-[-0.96px]">最新文章</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latest.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const [searchResult, fallbackPosts] = await Promise.all([
    search(q),
    listPosts({ keyword: q, limit: 18 }),
  ]);

  const users = searchResult.users ?? [];
  const posts = dedupePosts([...(searchResult.projects ?? []), ...fallbackPosts.posts]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <SearchHeader initialQuery={q} />

      <div className="mb-8 rounded-xl bg-card p-4 ring-border">
        <p className="text-sm text-muted-foreground">
          关键词 “{q}” 共命中 <span className="font-medium text-foreground">{posts.length}</span> 篇文章、
          <span className="font-medium text-foreground"> {users.length} </span>位作者。
        </p>
      </div>

      {posts.length === 0 && users.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="没有搜索到结果"
          description="尝试更短的关键词，或切换到英文关键词进行检索。"
        />
      ) : (
        <>
          {users.length > 0 && (
            <div className="mb-10 space-y-4">
              <h2 className="text-2xl font-semibold tracking-[-0.96px]">相关作者</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {users.slice(0, 8).map((user) => (
                  <AuthorCard key={user.id} user={user} />
                ))}
              </div>
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-[-0.96px]">相关文章</h2>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SearchHeader({ initialQuery = "" }: { initialQuery?: string }) {
  return (
    <div className="mb-8 space-y-4">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Search / 全站搜索</p>
      <h1 className="text-4xl md:text-5xl font-semibold tracking-[-1.9px]">搜索文章与作者</h1>

      <form action="/search" method="GET" className="flex w-full max-w-2xl items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={initialQuery}
            placeholder="输入关键词，例如：Next.js, 架构设计, AI"
            className="pl-9"
          />
        </div>
        <Button type="submit">搜索</Button>
      </form>
    </div>
  );
}

function pick(value?: string | string[]) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function dedupePosts(posts: BlogPost[]) {
  const seen = new Set<number>();
  const out: BlogPost[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
  }
  return out;
}
