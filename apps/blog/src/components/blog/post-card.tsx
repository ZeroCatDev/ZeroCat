import Link from "next/link";
import { Eye, Star, Clock3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildPostsHref, getPostHref } from "@/lib/blog-links";
import {
  formatDate,
  formatNumber,
  initials,
  stripMarkdown,
  truncate,
} from "@/lib/utils";
import { resolveAvatarUrl, resolveMediaUrl } from "@/lib/avatar";
import { TagChip } from "@/components/blog/tag-chip";
import type { BlogPost } from "@/lib/types";

export function PostCard({
  post,
  variant = "default",
}: {
  post: BlogPost;
  variant?: "default" | "prominent";
}) {
  const author = post.author;
  const cover = resolveMediaUrl(post.blogConfig?.cover || post.thumbnail || null);
  const href = getPostHref(post);
  const summary =
    post.summary ||
    (post.description ? truncate(stripMarkdown(post.description), 180) : "");
  const avatarSrc = resolveAvatarUrl(author?.avatar ?? null);

  const isProminent = variant === "prominent";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/96 shadow-card backdrop-blur-sm">
      <Link
        href={href}
        aria-label={post.title || post.name}
        className="absolute inset-0 z-10 rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-secondary via-accent to-secondary/60">
        {cover ? (
          <>
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/14 via-transparent to-white/8" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-mono-label text-muted-foreground/70">
            ZeroCat · Post
          </div>
        )}
      </div>

      <div
        className={`relative flex flex-1 flex-col gap-3 ${
          isProminent ? "p-6 md:p-8" : "p-5"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {author && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar className="h-5 w-5 border border-border/60">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
                <AvatarFallback className="text-[9px]">
                  {initials(author.display_name || author.username)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {author.display_name || author.username}
              </span>
            </span>
          )}
          {author && <span className="text-border">·</span>}
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            <time dateTime={post.time}>{formatDate(post.time)}</time>
          </span>
        </div>

        <h3
          className={`font-semibold leading-snug tracking-tight line-clamp-2 ${
            isProminent
              ? "text-2xl md:text-3xl tracking-[-0.025em]"
              : "text-lg"
          }`}
        >
          {post.title || post.name}
        </h3>

        {summary && (
          <p
            className={`text-muted-foreground leading-relaxed ${
              isProminent ? "text-base line-clamp-3" : "text-sm line-clamp-3"
            }`}
          >
            {summary}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          {post.project_tags && post.project_tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.project_tags.slice(0, 2).map((tag) => (
                <span key={tag.id} className="relative z-20">
                  <TagChip tag={tag} href={buildPostsHref({ tag: tag.name })} size="sm" />
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}
          <PostStats post={post} />
        </div>
      </div>
    </article>
  );
}

function PostStats({ post }: { post: BlogPost }) {
  if (!(post.view_count > 0) && !(post.star_count > 0)) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {post.view_count > 0 && (
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {formatNumber(post.view_count)}
        </span>
      )}
      {post.star_count > 0 && (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" />
          {formatNumber(post.star_count)}
        </span>
      )}
    </div>
  );
}
