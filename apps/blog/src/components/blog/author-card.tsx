import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { resolveAvatarUrl } from "@/lib/avatar";
import { initials, truncate } from "@/lib/utils";
import type { BlogPostAuthor, User } from "@/lib/types";

export function AuthorCard({
  user,
  stats,
  variant = "default",
}: {
  user: User | BlogPostAuthor;
  stats?: { posts?: number; followers?: number };
  variant?: "default" | "compact";
}) {
  const avatarSrc = resolveAvatarUrl(user.avatar);

  if (variant === "compact") {
    return (
      <Link
        href={`/${user.username}`}
        className="flex items-center gap-3 rounded-xl border border-transparent bg-transparent px-2.5 py-2.5"
      >
        <Avatar className="h-9 w-9 border border-white/18">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback>
            {initials(user.display_name || user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {user.display_name || user.username}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{user.username}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/${user.username}`}>
      <Card className="flex flex-col items-center gap-3 p-5 text-center hover:shadow-md transition-shadow">
        <Avatar className="h-16 w-16">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback className="text-base">
            {initials(user.display_name || user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 w-full">
          <p className="truncate font-semibold">
            {user.display_name || user.username}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{user.username}
          </p>
        </div>
        {user.bio && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {truncate(user.bio, 80)}
          </p>
        )}
        {stats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {typeof stats.posts === "number" && (
              <span>{stats.posts} 篇文章</span>
            )}
            {typeof stats.followers === "number" && (
              <span>{stats.followers} 关注者</span>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}
