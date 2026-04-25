import type { Metadata } from "next";
import { getPostByAuthorSlug } from "@/lib/api";
import { truncate } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/avatar";
import { getServerStaticBase } from "@/lib/site-config";
import { getPostUrlSlug } from "@/lib/blog-links";
import { PostPageClient } from "@/components/blog/pages/post-page-client";

type PageProps = { params: Promise<{ username: string; slug: string }> };

function buildAbsolutePostUrl(username: string, slug: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const [post, staticBase] = await Promise.all([
    getPostByAuthorSlug(username, slug),
    getServerStaticBase(),
  ]);

  if (!post) {
    return {
      title: "文章不存在",
      description: "未找到对应文章。",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = post.blogConfig?.seo?.title || post.title || post.name;
  const description =
    post.blogConfig?.seo?.description ||
    post.summary ||
    truncate(post.description || "", 160);
  const postSlug = getPostUrlSlug(post);
  const canonicalPath = `/${encodeURIComponent(username)}/${encodeURIComponent(postSlug)}`;
  const canonicalUrl = buildAbsolutePostUrl(username, postSlug);
  const cover = resolveMediaUrl(post.blogConfig?.cover || post.thumbnail, staticBase);
  const authorName = post.author?.display_name || post.author?.username || username;
  const keywords = [
    title,
    authorName,
    "ZeroCat Blog",
    ...(post.project_tags?.map((tag) => tag.name).filter(Boolean) ?? []),
  ];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    authors: [{ name: authorName, url: `/${encodeURIComponent(username)}` }],
    creator: authorName,
    keywords,
    category: "technology",
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName: "ZeroCat Blog",
      authors: [authorName],
      publishedTime: post.time,
      modifiedTime: post.time,
      tags: post.project_tags?.map((tag) => tag.name) ?? [],
      images: cover ? [{ url: cover, alt: title }] : [],
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : [],
      creator: post.author?.username ? `@${post.author.username}` : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { username, slug } = await params;
  return <PostPageClient username={username} slug={slug} />;
}
