import type { Metadata } from "next";
import { TagPostsPageClient } from "@/components/blog/pages/tag-posts-page-client";

type PageProps = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const name = decodeURIComponent(tag);
  return {
    title: `#${name} 标签`,
    description: `浏览与 #${name} 相关的社区文章。`,
  };
}

export default async function TagPostsPage({ params, searchParams }: PageProps) {
  const { tag: rawTag } = await params;
  const query = await searchParams;
  const tag = decodeURIComponent(rawTag);
  const page = Math.max(Number.parseInt(pick(query.page) || "1", 10) || 1, 1);
  const sort = pick(query.sort) === "popular" ? "popular" : "latest";

  return <TagPostsPageClient tag={tag} page={page} sort={sort} />;
}

function pick(value?: string | string[]) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}
