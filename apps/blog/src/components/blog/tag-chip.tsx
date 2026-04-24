import Link from "next/link";
import type { Tag } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

export function TagChip({
  tag,
  active = false,
  size = "default",
}: {
  tag: Tag;
  active?: boolean;
  size?: "default" | "sm" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : size === "lg"
      ? "px-3 py-1.5 text-sm"
      : "px-2.5 py-1 text-xs";
  return (
    <Link
      href={`/tags/${encodeURIComponent(tag.name)}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-150",
        sizeClass,
        active
          ? "bg-[var(--color-brand)] text-white shadow-sm"
          : "bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white dark:bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] dark:text-[color-mix(in_oklab,var(--color-brand)_90%,white)] dark:hover:bg-[var(--color-brand)] dark:hover:text-white"
      )}
    >
      <span>#</span>
      <span>{tag.name}</span>
      {typeof tag.count === "number" && tag.count > 0 && (
        <span
          className={cn(
            "ml-0.5 text-[10px] font-normal opacity-70"
          )}
        >
          {formatNumber(tag.count)}
        </span>
      )}
    </Link>
  );
}
