import type { BlogPost } from "./types";

export type PostsSort = "latest" | "popular";

export function normalizeAuthorParam(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("@") ? raw.slice(1).trim() : raw;
}

export function buildPostsHref(input: {
  q?: string;
  tag?: string;
  author?: string;
  sort?: PostsSort;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (input.q) qs.set("q", input.q);
  if (input.tag) qs.set("tag", input.tag);
  if (input.author) qs.set("author", input.author);
  if (input.sort) qs.set("sort", input.sort);
  if (input.page && input.page > 1) qs.set("page", String(input.page));
  const tail = qs.toString();
  return tail ? `/posts?${tail}` : "/posts";
}

export function getPostUrlSlug(post: Pick<BlogPost, "name" | "blogConfig">) {
  const configSlug = String(post.blogConfig?.slug || "").trim();
  const projectSlug = String(post.name || "").trim();
  return configSlug || projectSlug;
}

export function getPostHref(post: Pick<BlogPost, "name" | "blogConfig" | "author">) {
  const username = post.author?.username;
  const slug = getPostUrlSlug(post);
  if (!username || !slug) return "/posts";
  return `/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}
