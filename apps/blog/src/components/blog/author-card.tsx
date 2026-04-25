import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/avatar";
import { getServerStaticBase } from "@/lib/site-config";
import { initials, truncate } from "@/lib/utils";
import type { BlogPostAuthor, User } from "@/lib/types";

export async function AuthorCard({
  user,
  stats,
  variant = "default",
}: {
  user: User | BlogPostAuthor;
  stats?: { posts?: number; followers?: number };
  variant?: "default" | "compact";
}) {
  const staticBase = await getServerStaticBase();
  const avatarSrc = resolveAvatarUrl(user.avatar, staticBase);

  if (variant === "compact") {
    return (
      <Link
        href={`/${user.username}`}
        className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2"
      >
        <Avatar className="h-9 w-9">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback>
            {initials(user.display_name || user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {user.display_name || user.username}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            @{user.username}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/${user.username}`}
      className="flex flex-col items-center gap-3 rounded-lg bg-card p-5 text-center ring-border shadow-card"
    >
      <Avatar className="h-16 w-16">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
        <AvatarFallback className="text-base">
          {initials(user.display_name || user.username)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 w-full">
        <p className="font-semibold truncate">
          {user.display_name || user.username}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{user.username}
        </p>
      </div>
      {user.bio && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {truncate(user.bio, 80)}
        </p>
      )}
      {stats && (
        <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {typeof stats.posts === "number" && (
            <span>{stats.posts} Posts</span>
          )}
          {typeof stats.followers === "number" && (
            <span>{stats.followers} Followers</span>
          )}
        </div>
      )}
    </Link>
  );
}
