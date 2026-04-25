import type { Metadata } from "next";
import { normalizeAuthorParam } from "@/lib/blog-links";
import { PostsPageClient } from "@/components/blog/pages/posts-page-client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = pick(params.q).trim();
  if (!q) {
    return {
      title: "全部文章",
      description: "浏览 ZeroCat Blog 的全部文章，按关键词、作者、标签与热度筛选。",
    };
  }

  return {
    title: `搜索: ${q}`,
    description: `查看与 ${q} 相关的文章和作者结果。`,
  };
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q);
  const tag = pick(params.tag);
  const author = normalizeAuthorParam(pick(params.author));
  const sort = pick(params.sort) === "popular" ? "popular" : "latest";
  const page = Math.max(Number.parseInt(pick(params.page) || "1", 10) || 1, 1);

  return <PostsPageClient q={q} tag={tag} author={author} sort={sort} page={page} />;
}

function pick(value?: string | string[]) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}
