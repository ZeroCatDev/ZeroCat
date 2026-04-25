"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  FileText,
  Hash,
  MapPin,
  Link as LinkIcon,
  Pen,
  ArrowRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard } from "@/components/blog/post-card";
import { TagChip } from "@/components/blog/tag-chip";
import { EmptyState } from "@/components/blog/empty-state";
import { AuthorGridSkeleton, CardGridSkeleton, PageLoadError, TagListSkeleton } from "@/components/blog/public-page-primitives";
import {
  getUserByUsername,
  listPostsByAuthorId,
  listTagsByAuthorId,
} from "@/lib/api";
import { buildPostsHref } from "@/lib/blog-links";
import { resolveAvatarUrl } from "@/lib/avatar";
import { formatDate, initials } from "@/lib/utils";
import type { PostsResponse, Tag, User } from "@/lib/types";

const EMPTY_POSTS: PostsResponse = { posts: [], total: 0, page: 1, limit: 30 };

export function UserProfilePageClient({ username }: { username: string }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [posts, setPosts] = React.useState<PostsResponse>(EMPTY_POSTS);
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
        const nextUser = await getUserByUsername(username);
        if (cancelled) return;
        if (!nextUser) {
          setUser(null);
          setPosts(EMPTY_POSTS);
          setTags([]);
          return;
        }

        const [postsData, tagsData] = await Promise.all([
          listPostsByAuthorId(nextUser.id, { limit: 30 }),
          listTagsByAuthorId(nextUser.id, 80),
        ]);
        if (cancelled) return;
        setUser(nextUser);
        setPosts(postsData);
        setTags(tagsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载作者页面失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, username]);

  const featured = posts.posts[0];
  const rest = posts.posts.slice(1);

  if (loading) {
    return (
      <>
        <section className="relative">
          <div className="h-44 md:h-56 w-full bg-muted/50" />
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="relative -mt-14 md:-mt-16 pb-6">
              <AuthorGridSkeleton count={1} />
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10 space-y-8">
          <TagListSkeleton count={3} />
          <CardGridSkeleton count={6} />
        </section>
      </>
    );
  }

  if (error && !user) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
        <PageLoadError
          title="作者页面加载失败"
          description="请稍后重试。"
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
        <EmptyState icon={Pen} title="用户不存在" description="未找到对应作者。" />
      </section>
    );
  }

  return (
    <>
      <ProfileHero user={user} postCount={posts.total} tagCount={tags.length} />

      <section className="mx-auto w-full max-w-6xl px-4 md:px-6 py-10">
        <Tabs defaultValue="posts" className="space-y-8">
          <TabsList className="rounded-full p-1">
            <TabsTrigger value="posts" className="rounded-full">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              文章 ({posts.total})
            </TabsTrigger>
            <TabsTrigger value="tags" className="rounded-full">
              <Hash className="h-3.5 w-3.5 mr-1.5" />
              标签 ({tags.length})
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-full">关于</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0 space-y-8">
            {posts.posts.length === 0 ? (
              <EmptyState
                icon={Pen}
                title={`${user.display_name || user.username} 还没发布文章`}
                description="也许这里很快就会有第一篇文章。"
              />
            ) : (
              <>
                {featured ? <PostCard post={featured} variant="prominent" /> : null}

                {rest.length > 0 && (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tags" className="mt-0">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无标签。</p>
            ) : (
              <div className="rounded-xl bg-card ring-border p-6">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      href={buildPostsHref({ author: user.username, tag: tag.name })}
                      size="lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-0 space-y-4">
            <div className="rounded-xl bg-card ring-border p-6 space-y-3">
              <h3 className="font-semibold tracking-tight">个人简介</h3>
              {user.bio ? (
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                  {user.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  作者还没留下介绍。
                </p>
              )}
            </div>

            <div className="rounded-xl bg-card ring-border p-6 space-y-3">
              <h3 className="font-semibold tracking-tight">资料</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <InfoRow
                  icon={Calendar}
                  label="加入时间"
                  value={user.regTime ? formatDate(user.regTime) : "—"}
                />
                <InfoRow
                  icon={MapPin}
                  label="所在地"
                  value={user.location || "—"}
                />
                <InfoRow
                  icon={LinkIcon}
                  label="个人链接"
                  value={
                    user.url ? (
                      <a
                        href={user.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-link)] underline underline-offset-2"
                      >
                        {user.url}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoRow
                  icon={FileText}
                  label="已发布"
                  value={`${posts.total} 篇文章`}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}

function ProfileHero({
  user,
  postCount,
  tagCount,
}: {
  user: User;
  postCount: number;
  tagCount: number;
}) {
  const avatarUrl = resolveAvatarUrl(user.avatar);

  return (
    <section className="relative">
      <div className="relative h-44 md:h-56 w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand)] via-[var(--color-develop)] to-[var(--color-preview)] dark:from-[color-mix(in_oklab,var(--color-brand)_60%,black_40%)] dark:via-[color-mix(in_oklab,var(--color-develop)_55%,black_45%)] dark:to-[color-mix(in_oklab,var(--color-preview)_55%,black_45%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:40px_40px] dark:opacity-10"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="relative -mt-14 md:-mt-16 flex flex-col md:flex-row md:items-end md:gap-6 gap-4 pb-6">
          <Avatar className="h-28 w-28 md:h-32 md:w-32 rounded-full ring-4 ring-background shadow-lg shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-3xl">
              {initials(user.display_name || user.username)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2 min-w-0 md:pb-1">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.025em]">
                {user.display_name || user.username}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                @{user.username}
              </p>
            </div>
            {user.bio && (
              <p className="text-foreground/80 max-w-2xl leading-relaxed">
                {user.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground pt-1">
              <span>
                <span className="font-semibold text-foreground">{postCount}</span> 篇文章
              </span>
              <span>
                <span className="font-semibold text-foreground">{tagCount}</span> 个标签
              </span>
              {user.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {user.location}
                </span>
              )}
              {user.regTime && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  加入于 {formatDate(user.regTime)}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 md:pb-1">
            {user.url && (
              <Button asChild size="sm" variant="outline">
                <a href={user.url} target="_blank" rel="noreferrer">
                  <LinkIcon className="h-3.5 w-3.5" />
                  个人站点
                </a>
              </Button>
            )}
            <Button asChild size="sm">
              <a
                href={buildZcProfileUrl(user.username)}
                target="_blank"
                rel="noreferrer"
              >
                在主站查看 <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildZcProfileUrl(username: string): string {
  const base =
    process.env.NEXT_PUBLIC_ZC_WEB_URL ||
    process.env.NEXT_PUBLIC_WEB_URL ||
    "http://localhost:3141";
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(username)}`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
