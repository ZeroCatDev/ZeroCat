import Link from "next/link";
import type { Tag } from "@/lib/types";
import { buildPostsHref } from "@/lib/blog-links";
import { cn, formatNumber } from "@/lib/utils";

export function TagChip({
  tag,
  active = false,
  size = "default",
  href,
  tone = "default",
}: {
  tag: Tag;
  active?: boolean;
  size?: "default" | "sm" | "lg";
  href?: string;
  tone?: "default" | "inverse";
}) {
  const sizeClass =
    size === "sm"
      ? "h-7 px-2.5 text-[11px]"
      : size === "lg"
      ? "h-9 px-3.5 text-sm"
      : "h-8 px-3 text-xs";

  const defaultClass = active
    ? "border-transparent bg-[var(--color-brand)] text-white shadow-sm"
    : "border-border/70 bg-card/88 text-foreground/84 hover:border-[var(--color-brand)]/28 hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)] dark:bg-card/72 dark:hover:bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] dark:hover:text-[color-mix(in_oklab,var(--color-brand)_90%,white)]";

  const inverseClass = active
    ? "border-transparent bg-white text-[rgb(95,58,73)] shadow-sm"
    : "border-white/16 bg-white/12 text-white/90 hover:bg-white/16 hover:text-white";

  return (
    <Link
      href={href || buildPostsHref({ tag: tag.name })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium backdrop-blur-md transition-colors duration-150",
        sizeClass,
        tone === "inverse" ? inverseClass : defaultClass
      )}
    >
      <span>#</span>
      <span>{tag.name}</span>
      {typeof tag.count === "number" && tag.count > 0 && (
        <span className="ml-0.5 text-[10px] font-normal opacity-70">
          {formatNumber(tag.count)}
        </span>
      )}
    </Link>
  );
}
