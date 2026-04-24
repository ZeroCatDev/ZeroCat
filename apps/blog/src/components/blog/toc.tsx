"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { slugifyHeading, type TocItem } from "@/lib/markdown";

export function buildToc(markdown: string): TocItem[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const items: TocItem[] = [];
  let inCode = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;
    const id = slugifyHeading(text);
    items.push({ id, text, level });
  }
  return items;
}

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!items.length) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav className="sticky top-20 self-start">
      <p className="font-mono uppercase tracking-wider text-xs text-muted-foreground mb-3">
        On this page
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              item.level === 1 && "pl-0",
              item.level === 2 && "pl-3",
              item.level === 3 && "pl-6",
              item.level >= 4 && "pl-9"
            )}
          >
            <a
              href={`#${item.id}`}
              className={cn(
                "block py-1 leading-snug transition-colors border-l-2 pl-3 -ml-[2px]",
                active === item.id
                  ? "text-foreground border-foreground font-medium"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
