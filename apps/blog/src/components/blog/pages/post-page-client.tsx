"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Eye,
  Globe,
  MapPin,
  MessageCircle,
  Star,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatNumber, initials, truncate } from "@/lib/utils";
import { EditPostButton } from "@/components/blog/edit-post-button";
import { buildPostsHref, getPostUrlSlug } from "@/lib/blog-links";
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
          setPost(null);
          setBody("");
          setRelated([]);
          setAuthorPosts([]);
          setAuthorProfile(null);
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
        setAuthorPosts((morePosts.posts ?? []).filter((item) => item.id !== nextPost.id).slice(0, 6));
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
        <div className="rounded-2xl bg-card p-6 md:p-10 ring-border">
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-4/6 rounded bg-muted" />
          </div>
        </div>
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
  const authorName = author?.display_name || post.author?.display_name || post.author?.username || username;
  const authorAvatar = resolveAvatarUrl(author?.avatar || post.author?.avatar || null);
  const postSlug = getPostUrlSlug(post);
  const wordCount = countWords(body);
  const readMinutes = Math.max(1, Math.round(wordCount / 320));
  const cover = resolveMediaUrl(post.blogConfig?.cover || post.thumbnail || null);
  const summary = post.summary || truncate(post.description || "", 220);

  return (
    <>
      <PostViewReporter projectId={post.id} />
      <section className="relative isolate overflow-hidden text-white">
        {cover ? (
          <>
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(52,43,88,0.72)_0%,rgba(92,108,170,0.46)_38%,rgba(164,124,145,0.38)_68%,rgba(231,213,230,0.24)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.12),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,229,240,0.15),transparent_26%),linear-gradient(180deg,rgba(18,14,28,0.18),rgba(18,14,28,0.44))]" />
            <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.08)_8%,transparent_8%,transparent_24%,rgba(255,255,255,0.06)_24%,rgba(255,255,255,0.06)_37%,transparent_37%,transparent_58%,rgba(121,163,255,0.12)_58%,rgba(121,163,255,0.12)_73%,transparent_73%)] opacity-80 mix-blend-screen" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(63,49,100,0.95)_0%,rgba(79,105,163,0.92)_40%,rgba(150,122,153,0.9)_72%,rgba(205,188,212,0.84)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.08)_8%,transparent_8%,transparent_24%,rgba(255,255,255,0.06)_24%,rgba(255,255,255,0.06)_37%,transparent_37%,transparent_58%,rgba(121,163,255,0.12)_58%,rgba(121,163,255,0.12)_73%,transparent_73%)] opacity-75 mix-blend-screen" />
          </>
        )}

        <div className="absolute inset-0 bg-black/10" />

        <div className="relative mx-auto w-full max-w-6xl px-4 md:px-6 py-10 md:py-14 lg:py-20">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="mb-7 h-10 w-10 rounded-full border border-white/14 bg-white/8 text-white shadow-none backdrop-blur-md hover:bg-white/12"
          >
            <Link href={`/${username}`} aria-label="返回作者主页">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="max-w-5xl space-y-6">
            {post.project_tags && post.project_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.project_tags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    href={buildPostsHref({ tag: tag.name })}
                    size="lg"
                    tone="inverse"
                  />
                ))}
              </div>
            )}

            <h1 className="max-w-5xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white md:text-6xl lg:text-7xl">
              {post.title || post.name}
            </h1>

            {summary ? (
              <p className="max-w-4xl text-base leading-8 text-white/82 md:text-lg">
                {summary}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium text-white/84">
              <MetaItem icon={UserRound}>
                <Link href={`/${username}`} className="text-white hover:text-white">
                  {authorName}
                </Link>
              </MetaItem>
              <MetaItem icon={Clock3}>{readMinutes} 分钟</MetaItem>
              <MetaItem icon={CalendarDays}>{formatDate(post.time)}</MetaItem>
              <MetaItem icon={Eye}>{formatNumber(post.view_count)}</MetaItem>
              <MetaItem icon={MessageCircle}>{post.project_tags?.length ?? 0} 标签</MetaItem>
              <MetaItem icon={Star}>{formatNumber(post.star_count)}</MetaItem>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <EditPostButton projectId={post.id} authorId={post.author?.id} />
              <InfoChip>{wordCount} 字</InfoChip>
              <InfoChip>{postSlug}</InfoChip>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-6 w-full max-w-6xl px-4 md:-mt-8 md:px-6 lg:-mt-10 lg:pb-2">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="relative min-w-0 overflow-hidden rounded-[1.55rem] border border-border/55 bg-card/96 p-6 shadow-card backdrop-blur-sm md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(190,98,118,0.08),transparent_68%)]" />
            <div className="relative mx-auto max-w-3xl">
              {body ? (
                <MarkdownContent source={body} />
              ) : (
                <p className="text-muted-foreground">这篇文章还没有正文内容。</p>
              )}
            </div>
          </article>

          <aside className="hidden lg:block space-y-4">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-[1.15rem] border border-border/55 bg-card/96 p-4 shadow-card backdrop-blur-sm">
                <TableOfContents items={toc} />
              </div>
              {author && (
                <div className="rounded-[1.15rem] border border-border/55 bg-card/96 p-5 shadow-card backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 border border-border/60">
                      {authorAvatar ? <AvatarImage src={authorAvatar} alt="" /> : null}
                      <AvatarFallback>{initials(authorName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link href={`/${username}`} className="truncate font-semibold hover:underline">
                        {authorName}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">@{author.username}</p>
                    </div>
                  </div>
                  {author.bio && (
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {truncate(author.bio, 120)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {(author || authorPosts.length > 0) && (
        <section className="bg-[radial-gradient(circle_at_top,rgba(190,98,118,0.05),transparent_45%)] pt-10 md:pt-12">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6 space-y-10">
            {author && (
              <div className="overflow-hidden rounded-[1.55rem] border border-border/55 bg-card/96 shadow-card backdrop-blur-sm">
                <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:p-7">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-18 w-18 border border-border/60 md:h-20 md:w-20">
                      {authorAvatar ? <AvatarImage src={authorAvatar} alt="" /> : null}
                      <AvatarFallback className="text-lg">{initials(authorName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">作者</p>
                      <Link href={`/${username}`} className="block truncate text-2xl font-semibold tracking-[-0.02em] hover:underline">
                        {authorName}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">@{author.username}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {author.bio ? (
                      <p className="max-w-2xl text-sm leading-7 text-foreground/80 md:text-base">
                        {author.bio}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">作者还没有留下个人简介。</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {author.location ? <MetaCard icon={MapPin}>{author.location}</MetaCard> : null}
                      {author.url ? (
                        <MetaCard icon={Globe} asLink href={author.url}>
                          个人站点
                        </MetaCard>
                      ) : null}
                      {author.regTime ? <MetaCard icon={CalendarDays}>加入于 {formatDate(author.regTime)}</MetaCard> : null}
                    </div>
                  </div>

                  <div className="flex md:justify-end">
                    <Button asChild className="rounded-full">
                      <Link href={`/${username}`}>
                        查看作者主页 <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {authorPosts.length > 0 && (
              <div>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-mono-label text-muted-foreground/70">More From Author</p>
                    <h2 className="text-2xl font-semibold tracking-[-0.02em]">作者的其他文章</h2>
                  </div>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/${username}`}>
                      查看全部 <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {authorPosts.map((item) => (
                    <PostCard key={item.id} post={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="pt-10 md:pt-12">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-2 pb-12">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">相关推荐</h2>
              <Button asChild variant="outline" size="sm" className="rounded-full">
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

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/14 bg-white/8 px-3 text-white/88 backdrop-blur-md">
      <Icon className="h-3.5 w-3.5 text-white/66" />
      <span>{children}</span>
    </span>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="h-8 rounded-full border border-white/14 bg-white/8 px-3 font-medium text-white backdrop-blur-md hover:bg-white/8">
      {children}
    </Badge>
  );
}

function MetaCard({
  icon: Icon,
  children,
  asLink = false,
  href,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  asLink?: boolean;
  href?: string;
}) {
  const className = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-background/65 px-3 text-sm text-foreground/78";

  if (asLink && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{children}</span>
      </a>
    );
  }

  return (
    <span className={className}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{children}</span>
    </span>
  );
}

function countWords(source: string) {
  const text = source.trim();
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + rest;
}
