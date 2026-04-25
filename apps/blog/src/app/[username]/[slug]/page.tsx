import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Eye, Star, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/blog/markdown-content";
import { PostCard } from "@/components/blog/post-card";
import { TableOfContents } from "@/components/blog/toc";
import { PostViewReporter } from "@/components/blog/post-view-reporter";
import {
  getPostBody,
  getPostByAuthorSlug,
  getRelatedPosts,
} from "@/lib/api";
import { extractMarkdownToc } from "@/lib/markdown";
import { formatDate, formatNumber, truncate } from "@/lib/utils";
import { EditPostButton } from "@/components/blog/edit-post-button";
import { buildPostsHref } from "@/lib/blog-links";

type PageProps = { params: Promise<{ username: string; slug: string }> };

const getPostPayload = cache(async (username: string, slug: string) => {
  const post = await getPostByAuthorSlug(username, slug);
  if (!post) return null;

  const body = post.file?.source || (await getPostBody(post));
  return {
    post,
    body,
    toc: extractMarkdownToc(body),
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const payload = await getPostPayload(username, slug);

  if (!payload) {
    return {
      title: "文章不存在",
      description: "未找到对应文章。",
    };
  }

  const { post } = payload;
  const title = post.blogConfig?.seo?.title || post.title || post.name;
  const description =
    post.blogConfig?.seo?.description ||
    post.summary ||
    truncate(post.description || "", 160);

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      images: post.blogConfig?.cover ? [{ url: post.blogConfig.cover }] : [],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { username, slug } = await params;
  const payload = await getPostPayload(username, slug);
  if (!payload) notFound();

  const { post, body, toc } = payload;
  const related = (await getRelatedPosts(post.id)).filter((item) => item.id !== post.id);
  const authorName = post.author?.display_name || post.author?.username || username;

  return (
    <>
      <PostViewReporter projectId={post.id} />
      <section className="w-full border-b border-border bg-[radial-gradient(ellipse_900px_300px_at_20%_0%,rgba(10,114,239,0.08),transparent),radial-gradient(ellipse_700px_260px_at_100%_0%,rgba(222,29,141,0.06),transparent)] dark:bg-[radial-gradient(ellipse_900px_300px_at_20%_0%,color-mix(in_oklab,var(--color-brand)_18%,transparent),transparent),radial-gradient(ellipse_700px_260px_at_100%_0%,color-mix(in_oklab,var(--color-preview)_15%,transparent),transparent)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10 lg:py-14">
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link href={`/${username}`}>
              <ArrowLeft className="h-4 w-4" /> 返回作者主页
            </Link>
          </Button>

          <div className="max-w-4xl space-y-5">
            {post.project_tags && post.project_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.project_tags.map((tag) => (
                  <Link key={tag.id} href={buildPostsHref({ tag: tag.name })}>
                    <Badge
                      variant="outline"
                      className="h-6 px-2 text-xs hover:bg-accent transition-colors"
                    >
                      #{tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            <h1 className="text-4xl md:text-6xl font-semibold leading-[1.05] tracking-[-2.4px]">
              {post.title || post.name}
            </h1>

            {(post.summary || post.description) && (
              <p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
                {post.summary || truncate(post.description || "", 220)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                <Link href={`/${username}`} className="text-foreground hover:underline">
                  {authorName}
                </Link>
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                <time dateTime={post.time}>{formatDate(post.time)}</time>
              </span>
              {post.view_count > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    {formatNumber(post.view_count)} 阅读
                  </span>
                </>
              )}
              {post.star_count > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="h-4 w-4" />
                    {formatNumber(post.star_count)} 收藏
                  </span>
                </>
              )}
              <EditPostButton projectId={post.id} authorId={post.author?.id} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article className="min-w-0 rounded-2xl bg-card p-6 md:p-10 ring-border">
            {body ? (
              <MarkdownContent source={body} />
            ) : (
              <p className="text-muted-foreground">这篇文章还没有正文内容。</p>
            )}
          </article>

          <aside className="hidden lg:block space-y-4">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-xl bg-card p-4 ring-border">
                <TableOfContents items={toc} />
              </div>
              <div className="rounded-xl bg-card p-4 ring-border">
                <p className="mb-3 text-mono-label text-muted-foreground/70">
                  Author
                </p>
                <Link href={`/${username}`} className="text-sm font-medium hover:underline">
                  @{username}
                </Link>
                {post.author?.bio && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {truncate(post.author.bio, 90)}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-12">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">相关推荐</h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/posts">浏览更多文章</Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 6).map((item) => (
                <PostCard key={item.id} post={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}