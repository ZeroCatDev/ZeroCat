"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/blog/markdown-content";
import { PostCard } from "@/components/blog/post-card";
import { TableOfContents, buildToc } from "@/components/blog/toc";
import { PostViewReporter } from "@/components/blog/post-view-reporter";
import { EmptyState } from "@/components/blog/empty-state";
import { CardGridSkeleton, PageLoadError } from "@/components/blog/public-page-primitives";
import {
  getPostBody,
  getPostByAuthorSlug,
  getRelatedPosts,
  getUserByUsername,
  listPostsByAuthorId,
} from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";
import { EditPostButton } from "@/components/blog/edit-post-button";
import { resolveAvatarUrl, resolveMediaUrl } from "@/lib/avatar";
import { TagChip } from "@/components/blog/tag-chip";
import type { BlogPost, User } from "@/lib/types";

export function PostPageClient({
  username,
  slug,
}: {
  username: string;
  slug: string;
}) {
  const [post, setPost] = React.useState<BlogPost | null>(null);
  const [body, setBody] = React.useState("");
  const [related, setRelated] = React.useState<BlogPost[]>([]);
  const [authorPosts, setAuthorPosts] = React.useState<BlogPost[]>([]);
  const [authorProfile, setAuthorProfile] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [missing, setMissing] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setMissing(false);
      try {
        const nextPost = await getPostByAuthorSlug(username, slug);
        if (cancelled) return;
        if (!nextPost) {
          setMissing(true);
          return;
        }

        const [bodyData, relatedPosts, profile] = await Promise.all([
          nextPost.file?.source || getPostBody(nextPost),
          getRelatedPosts(nextPost.id),
          getUserByUsername(username),
        ]);

        const morePosts = profile?.id
          ? await listPostsByAuthorId(profile.id, { limit: 7 })
          : { posts: [] };

        if (cancelled) return;
        setPost(nextPost);
        setBody(bodyData || "");
        setRelated(relatedPosts.filter((item) => item.id !== nextPost.id));
        setAuthorProfile(profile);
        setAuthorPosts(
          (morePosts.posts ?? [])
            .filter((item) => item.id !== nextPost.id)
            .slice(0, 6)
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载文章失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, slug, username]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10 space-y-8">
        <CardGridSkeleton count={1} className="grid" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (error && !post) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
        <PageLoadError
          title="文章加载失败"
          description="请检查网络后重试。"
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </section>
    );
  }

  if (missing || !post) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
        <EmptyState icon={UserRound} title="文章不存在" description="未找到对应文章。" />
      </section>
    );
  }

  const toc = buildToc(body);
  const author = authorProfile || null;
  const authorName =
    author?.display_name || post.author?.display_name || post.author?.username || username;
  const authorAvatar = resolveAvatarUrl(author?.avatar || post.author?.avatar || null);
  const cover = resolveMediaUrl(post.blogConfig?.cover || post.thumbnail || null);
  const readMinutes = Math.max(1, Math.round(countWords(body) / 320));

  return (
    <>
      <PostViewReporter projectId={post.id} />

      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8 md:py-12">
        {/* Back link */}
        <Link
          href={`/${username}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {authorName}
        </Link>

        {/* Tags */}
        {post.project_tags && post.project_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.project_tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="sm" />
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {post.title || post.name}
        </h1>

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
          {author && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                {authorAvatar ? <AvatarImage src={authorAvatar} alt="" /> : null}
                <AvatarFallback className="text-[9px]">
                  {initials(authorName)}
                </AvatarFallback>
              </Avatar>
              <Link href={`/${username}`} className="font-medium text-foreground hover:underline">
                {authorName}
              </Link>
            </span>
          )}
          <Clock3 className="h-3.5 w-3.5" />
          <time dateTime={post.time}>{formatDate(post.time)}</time>
          <span>{readMinutes} 分钟</span>
          <EditPostButton projectId={post.id} authorId={post.author?.id} />
        </div>

        {/* Cover image */}
        {cover && (
          <img
            src={cover}
            alt=""
            className="mt-6 w-full rounded-lg object-cover max-h-96"
          />
        )}

        {/* Article body + TOC */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Card>
            <CardContent className="p-6 md:p-10">
              {body ? (
                <MarkdownContent source={body} />
              ) : (
                <p className="text-muted-foreground">这篇文章还没有正文内容。</p>
              )}
            </CardContent>
          </Card>

          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TableOfContents items={toc} />
            </div>
          </aside>
        </div>
      </section>

      {/* Author more posts */}
      {authorPosts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8">
          <h2 className="text-xl font-semibold mb-4">作者的其他文章</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {authorPosts.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      )}

      {/* Related posts */}
      {related.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8 pb-16">
          <h2 className="text-xl font-semibold mb-4">相关推荐</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.slice(0, 6).map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function countWords(source: string) {
  const text = source.trim();
  if (!text) return 0;
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  const rest = text
    .replace(/[一-鿿]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + rest;
}
