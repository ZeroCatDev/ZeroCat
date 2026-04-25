import Link from "next/link";
import { Eye, Star, Clock3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buildPostsHref } from "@/lib/blog-links";
import {
  formatDate,
  formatNumber,
  initials,
  stripMarkdown,
  truncate,
} from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatar";
import type { BlogPost } from "@/lib/types";

/**
 * Unified post card. Renders identically for all post lists —
 * the `prominent` variant simply increases spacing and typography
 * for the top-of-feed featured slot.
 */
export function PostCard({
  post,
  variant = "default",
}: {
  post: BlogPost;
  variant?: "default" | "prominent";
}) {
  const author = post.author;
  const username = author?.username || "";
  const cover = post.blogConfig?.cover || post.thumbnail || null;
  const href = username
    ? `/${username}/${post.blogConfig?.slug || post.id}`
    : `/posts/${post.id}`;
  const summary =
    post.summary ||
    (post.description ? truncate(stripMarkdown(post.description), 180) : "");
  const avatarSrc = resolveAvatarUrl(author?.avatar ?? null);

  const isProminent = variant === "prominent";

  return (
    <article className="group relative flex flex-col h-full overflow-hidden rounded-2xl bg-card ring-border transition-all duration-300 hover:shadow-card-lift hover:-translate-y-0.5">
      <Link
        href={href}
        aria-label={post.title || post.name}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <div
        className={`relative w-full overflow-hidden bg-gradient-to-br from-secondary via-accent to-secondary/60 ${
          isProminent ? "aspect-[16/9]" : "aspect-[16/9]"
        }`}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
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
              <Avatar className="h-5 w-5">
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
          className={`font-semibold leading-snug tracking-tight line-clamp-2 transition-colors group-hover:text-[var(--color-brand)] ${
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

        <div className="mt-auto flex items-center justify-between pt-2">
          {post.project_tags && post.project_tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.project_tags.slice(0, 2).map((tag) => (
                <Link
                  key={tag.id}
                  href={buildPostsHref({ tag: tag.name })}
                  className="relative z-20"
                >
                  <Badge
                    variant="secondary"
                    className="h-6 rounded-full px-2 text-[11px] font-medium hover:bg-accent transition-colors"
                  >
                    #{tag.name}
                  </Badge>
                </Link>
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
