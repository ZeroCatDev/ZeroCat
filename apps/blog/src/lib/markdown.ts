export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]+/gu, "");
}

export function extractMarkdownToc(markdown: string): TocItem[] {
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

    const matched = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (!matched) continue;

    const level = matched[1].length;
    const text = matched[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;

    items.push({
      id: slugifyHeading(text),
      text,
      level,
    });
  }

  return items;
}
