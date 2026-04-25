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
