import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { buildPostsHref, getPostHref } from "@/lib/blog-links";
import { formatDate, initials, stripMarkdown, truncate } from "@/lib/utils";
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
    <Card className="group overflow-hidden">
      {cover && (
        <Link href={href} className="block">
          <img
            src={cover}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        </Link>
      )}

      <CardContent className={isProminent ? "p-6" : "p-4"}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
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
          <Clock3 className="h-3 w-3" />
          <time dateTime={post.time}>{formatDate(post.time)}</time>
        </div>

        <h3
          className={`font-semibold leading-snug line-clamp-2 ${
            isProminent ? "text-xl md:text-2xl" : "text-base"
          }`}
        >
          <Link href={href} className="hover:underline">
            {post.title || post.name}
          </Link>
        </h3>

        {summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">
            {summary}
          </p>
        )}

        {post.project_tags && post.project_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.project_tags.slice(0, 2).map((tag) => (
              <TagChip key={tag.id} tag={tag} href={buildPostsHref({ tag: tag.name })} size="sm" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
