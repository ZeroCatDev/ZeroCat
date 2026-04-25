import type {
  ApiEnvelope,
  BlogPost,
  Draft,
  DraftListItem,
  PostsResponse,
  ProjectLatestResponse,
  ProjectNamespaceInfo,
  Tag,
  User,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:3000";

const TOKEN_KEY = "token";

type FetchInit = RequestInit & { revalidate?: number | false; tags?: string[] };

function authHeader(token?: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: FetchInit = {}
): Promise<T> {
  const { revalidate, tags, headers, ...rest } = init;
  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const url = isAbsolute ? path : `${API_URL}${path}`;

  const next: { revalidate?: number | false; tags?: string[] } = {};
  if (revalidate !== undefined) next.revalidate = revalidate;
  if (tags) next.tags = tags;

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    },
    ...(Object.keys(next).length ? { next } : {}),
    cache:
      init.cache ??
      (revalidate !== undefined ? undefined : "no-store"),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `API ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

/* =========================
 * Public blog endpoints
 * ========================= */

export async function listPosts(params: {
  page?: number;
  limit?: number;
  author?: string;
  tag?: string;
  keyword?: string;
  sort?: "latest" | "popular";
} = {}): Promise<PostsResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.author) qs.set("author", params.author);
  if (params.tag) qs.set("tag", params.tag);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.sort) qs.set("sort", params.sort);

  const res = await apiFetch<ApiEnvelope<PostsResponse>>(
    `/blog/posts?${qs.toString()}`,
    { revalidate: 30, tags: ["blog-posts"] }
  );
  return res.data ?? { posts: [], total: 0, page: 1, limit: 20 };
}

export async function listPublishedPosts(token: string): Promise<BlogPost[]> {
  const res = await apiFetch<ApiEnvelope<BlogPost[]>>(`/blog/posts/mine`, {
    headers: authHeader(token),
  });
  return res.data ?? [];
}

export async function listPostsByAuthor(
  username: string,
  params: { page?: number; limit?: number; sort?: "latest" | "popular" } = {}
): Promise<PostsResponse> {
  const user = await getUserByUsername(username);
  if (!user?.id) {
    return { posts: [], total: 0, page: params.page ?? 1, limit: params.limit ?? 20 };
  }

  return listPostsByAuthorId(user.id, {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
  });
}

export async function listPostsByAuthorId(
  userId: number,
  params: { page?: number; limit?: number; sort?: "latest" | "popular" } = {}
): Promise<PostsResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const orderBy = params.sort === "popular" ? "view_down" : "time_down";

  const qs = new URLSearchParams();
  qs.set("scope", "projects");
  qs.set("type", "article");
  qs.set("state", "public");
  qs.set("userId", String(userId));
  qs.set("orderBy", orderBy);
  qs.set("page", String(page));
  qs.set("perPage", String(limit));

  try {
    const res = await apiFetch<{
      projects?: Array<Partial<BlogPost>>;
      totalCount?: number;
      page?: number;
      limit?: number;
    }>(`/searchapi?${qs.toString()}`, {
      revalidate: 30,
      tags: [`blog-posts-user-${userId}`],
    });

    const posts = (res.projects ?? []).map(normalizeSearchProjectToBlogPost);
    return {
      posts,
      total: res.totalCount ?? posts.length,
      page: res.page ?? page,
      limit: res.limit ?? limit,
    };
  } catch {
    return { posts: [], total: 0, page, limit };
  }
}

export async function getPostById(id: number | string): Promise<BlogPost | null> {
  try {
    const res = await apiFetch<ApiEnvelope<BlogPost>>(`/blog/posts/${id}`, {
      revalidate: 30,
      tags: [`blog-post-${id}`],
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getPostByAuthorSlug(
  username: string,
  slug: string
): Promise<BlogPost | null> {
  try {
    const res = await apiFetch<ApiEnvelope<BlogPost>>(
      `/blog/posts/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
      {
        revalidate: 30,
        tags: [`blog-post-${username}-${slug}`],
      }
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getRelatedPosts(id: number | string): Promise<BlogPost[]> {
  try {
    const res = await apiFetch<ApiEnvelope<BlogPost[]>>(
      `/blog/posts/${id}/related`,
      { revalidate: 60 }
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function listTags(limit = 60): Promise<Tag[]> {
  const requested = Math.max(1, Number(limit) || 0);
  const perPage = Math.min(50, requested);
  const maxPages = Math.min(50, Math.ceil(requested / perPage));
  const collected: Tag[] = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const qs = new URLSearchParams();
      qs.set("scope", "tags");
      qs.set("type", "article");
      qs.set("state", "public");
      qs.set("page", String(page));
      qs.set("perPage", String(perPage));

      const res = await apiFetch<{ tags?: Array<{ name: string; count: number }> }>(
        `/searchapi?${qs.toString()}`,
        {
          revalidate: 60,
          tags: ["blog-tags"],
        }
      );

      const items = (res.tags ?? [])
        .map((tag) => {
          const name = String(tag.name || "").trim();
          if (!name) return null;
          const item: Tag = {
            id: stableTagId(name),
            name,
            count: Number(tag.count ?? 0),
          };
          return item;
        })
        .filter((item): item is Tag => Boolean(item));

      if (items.length === 0) break;
      collected.push(...items);
      if (collected.length >= requested) break;
      if (items.length < perPage) break;
    }

    const uniq = new Map<string, Tag>();
    for (const tag of collected) {
      if (!uniq.has(tag.name)) uniq.set(tag.name, tag);
    }
    return Array.from(uniq.values()).slice(0, requested);
  } catch {
    return [];
  }
}

export async function listAllTags(): Promise<Tag[]> {
  const perPage = 50;
  const maxPages = 50;
  const collected: Tag[] = [];

  try {
    let page = 1;
    let totalCount: number | null = null;

    while (page <= maxPages) {
      const qs = new URLSearchParams();
      qs.set("scope", "tags");
      qs.set("type", "article");
      qs.set("state", "public");
      qs.set("page", String(page));
      qs.set("perPage", String(perPage));

      const res = await apiFetch<{
        tags?: Array<{ name: string; count: number }>;
        totalCount?: number;
      }>(`/searchapi?${qs.toString()}`, {
        revalidate: 60,
        tags: ["blog-tags"],
      });

      if (totalCount === null && typeof res.totalCount === "number") {
        totalCount = res.totalCount;
      }

      const items = (res.tags ?? [])
        .map((tag) => {
          const name = String(tag.name || "").trim();
          if (!name) return null;
          const item: Tag = {
            id: stableTagId(name),
            name,
            count: Number(tag.count ?? 0),
          };
          return item;
        })
        .filter((item): item is Tag => Boolean(item));

      if (items.length === 0) break;
      collected.push(...items);
      if (totalCount !== null && collected.length >= totalCount) break;
      if (items.length < perPage) break;
      page += 1;
    }

    const uniq = new Map<string, Tag>();
    for (const tag of collected) {
      if (!uniq.has(tag.name)) uniq.set(tag.name, tag);
    }
    return Array.from(uniq.values());
  } catch {
    return [];
  }
}

export async function listTagsByAuthorId(
  userId: number,
  limit = 60
): Promise<Tag[]> {
  const requested = Math.max(1, Number(limit) || 0);
  const perPage = Math.min(50, requested);
  const maxPages = Math.min(50, Math.ceil(requested / perPage));
  const collected: Tag[] = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const qs = new URLSearchParams();
      qs.set("scope", "tags");
      qs.set("type", "article");
      qs.set("state", "public");
      qs.set("userId", String(userId));
      qs.set("page", String(page));
      qs.set("perPage", String(perPage));

      const res = await apiFetch<{ tags?: Array<{ name: string; count: number }> }>(
        `/searchapi?${qs.toString()}`,
        {
          revalidate: 60,
          tags: [`blog-tags-user-${userId}`],
        }
      );

      const items = (res.tags ?? [])
        .map((tag) => {
          const name = String(tag.name || "").trim();
          if (!name) return null;
          const item: Tag = {
            id: stableTagId(name),
            name,
            count: Number(tag.count ?? 0),
          };
          return item;
        })
        .filter((item): item is Tag => Boolean(item));

      if (items.length === 0) break;
      collected.push(...items);
      if (collected.length >= requested) break;
      if (items.length < perPage) break;
    }

    const uniq = new Map<string, Tag>();
    for (const tag of collected) {
      if (!uniq.has(tag.name)) uniq.set(tag.name, tag);
    }
    return Array.from(uniq.values()).slice(0, requested);
  } catch {
    return [];
  }
}

/* =========================
 * Project / content fetch
 * ========================= */

export async function getProjectNamespace(
  username: string,
  slug: string
): Promise<ProjectNamespaceInfo | null> {
  try {
    const data = await apiFetch<ProjectNamespaceInfo>(
      `/project/namespace/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
      { revalidate: 30 }
    );
    if (!data || !data.id) return null;
    return data;
  } catch {
    return null;
  }
}

function stableTagId(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

export async function getLatestCommit(
  projectId: number | string,
  branch = "main"
): Promise<ProjectLatestResponse | null> {
  try {
    return await apiFetch<ProjectLatestResponse>(
      `/project/${projectId}/${branch}/latest`,
      { revalidate: 10 }
    );
  } catch {
    return null;
  }
}

export async function getProjectFileContent(
  sha256: string,
  accessFileToken: string
): Promise<string> {
  if (!sha256 || !accessFileToken) return "";
  const url = `${API_URL}/project/files/${sha256}?accessFileToken=${encodeURIComponent(
    accessFileToken
  )}&content=true`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return "";
  const text = await res.text();
  try {
    const obj = JSON.parse(text);
    if (typeof obj === "string") return obj;
    if (obj?.index && typeof obj.index === "string") return obj.index;
    if (obj?.file && typeof obj.file === "string") return obj.file;
    return text;
  } catch {
    return text;
  }
}

export async function getPostBody(post: {
  id: number | string;
  default_branch?: string;
}): Promise<string> {
  const branch = post.default_branch || "main";
  const latest = await getLatestCommit(post.id, branch);
  if (!latest?.commit?.commit_file || !latest.accessFileToken) return "";
  return getProjectFileContent(latest.commit.commit_file, latest.accessFileToken);
}

/* =========================
 * User endpoints
 * ========================= */

export async function getUserByUsername(
  username: string
): Promise<User | null> {
  try {
    const data = await apiFetch<ApiEnvelope<User>>(
      `/user/username/${encodeURIComponent(username)}`,
      { revalidate: 30 }
    );
    return data.data ?? null;
  } catch {
    return null;
  }
}

/* =========================
 * Search
 * ========================= */

export interface SearchResults {
  projects?: BlogPost[];
  users?: User[];
}

export async function search(keyword: string): Promise<SearchResults> {
  if (!keyword) return {};

  const projectQs = new URLSearchParams({
    keyword,
    scope: "projects",
    type: "article",
    state: "public",
    perPage: "12",
    orderBy: "time_down",
  });

  const userQs = new URLSearchParams({
    keyword,
    scope: "users",
    perPage: "8",
  });

  try {
    const [projectRes, userRes] = await Promise.all([
      apiFetch<{ projects?: Array<Partial<BlogPost>> }>(
        `/searchapi?${projectQs.toString()}`,
        { cache: "no-store" }
      ),
      apiFetch<{ users?: User[] }>(`/searchapi?${userQs.toString()}`, {
        cache: "no-store",
      }),
    ]);

    return {
      projects: (projectRes.projects ?? []).map(normalizeSearchProjectToBlogPost),
      users: userRes.users ?? [],
    };
  } catch {
    return {};
  }
}

function normalizeSearchProjectToBlogPost(project: Partial<BlogPost>): BlogPost {
  const id = Number(project.id ?? 0);
  const author = project.author;
  const authorId =
    typeof project.authorid === "number"
      ? project.authorid
      : typeof author?.id === "number"
        ? author.id
        : 0;

  return {
    id,
    name: String(project.name ?? project.title ?? `post-${id}`),
    title: String(project.title ?? project.name ?? "未命名文章"),
    description:
      project.description === undefined ? null : (project.description ?? null),
    summary: project.summary ?? project.description ?? null,
    type: String(project.type ?? "article"),
    state: String(project.state ?? "public"),
    view_count: Number(project.view_count ?? 0),
    star_count: Number(project.star_count ?? 0),
    time: String(project.time ?? new Date(0).toISOString()),
    authorid: authorId,
    default_branch: String(project.default_branch ?? "main"),
    thumbnail: project.thumbnail ?? null,
    author: author
      ? {
          id: Number(author.id ?? 0),
          username: String(author.username ?? ""),
          display_name: author.display_name ?? null,
          avatar: author.avatar ?? null,
          bio: author.bio ?? null,
        }
      : undefined,
    project_tags: project.project_tags ?? [],
    blogConfig: project.blogConfig,
    file: project.file,
  };
}

/* =========================
 * Authenticated (client-side) calls
 * ========================= */

async function authedFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  const useToken = token ?? getStoredToken();
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(useToken),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(text || `HTTP ${res.status}`), {
      status: res.status,
    });
  }
  return (await res.json()) as T;
}

export async function listDrafts(token?: string): Promise<DraftListItem[]> {
  const res = await authedFetch<ApiEnvelope<DraftListItem[]>>(
    `/blog/drafts`,
    { method: "GET" },
    token
  );
  return res.data ?? [];
}

export async function getDraft(
  projectId: number | string,
  token?: string
): Promise<Draft | null> {
  try {
    const res = await authedFetch<ApiEnvelope<Draft>>(
      `/blog/drafts/${projectId}`,
      { method: "GET" },
      token
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(
  projectId: number | string,
  patch: Partial<Draft>,
  token?: string
): Promise<Draft> {
  const res = await authedFetch<ApiEnvelope<Draft>>(
    `/blog/drafts/${projectId}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
    token
  );
  return res.data ?? patch;
}

export async function discardDraft(
  projectId: number | string,
  token?: string
): Promise<boolean> {
  const res = await authedFetch<ApiEnvelope<{ removed: boolean }>>(
    `/blog/drafts/${projectId}`,
    { method: "DELETE" },
    token
  );
  return res.data?.removed ?? false;
}

export async function publishDraft(
  projectId: number | string,
  message?: string,
  token?: string
): Promise<{ commit: { id: string }; project: unknown }> {
  const res = await authedFetch<ApiEnvelope<{ commit: { id: string }; project: unknown }>>(
    `/blog/drafts/${projectId}/publish`,
    {
      method: "POST",
      body: JSON.stringify({ message: message || "发布" }),
    },
    token
  );
  return (res.data ?? { commit: { id: "" }, project: {} }) as {
    commit: { id: string };
    project: unknown;
  };
}

export async function createPost(
  payload: Partial<{ title: string; summary: string; state: string }>,
  token?: string
): Promise<BlogPost> {
  const res = await authedFetch<ApiEnvelope<BlogPost>>(
    `/blog/posts`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
  if (!res.data) throw new Error(res.message || "创建失败");
  return res.data;
}

export async function updatePostMeta(
  id: number | string,
  payload: Partial<{
    title: string;
    summary: string;
    state: "public" | "private" | "draft";
    cover: string | null;
    slug: string;
    seo: { title?: string; description?: string; keywords?: string };
    tags: string[];
  }>,
  token?: string
): Promise<void> {
  await authedFetch<ApiEnvelope<null>>(
    `/blog/posts/${id}/meta`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token
  );
}

export async function updateProjectState(
  id: number | string,
  state: "public" | "private",
  token?: string
): Promise<void> {
  await authedFetch<unknown>(
    `/project/id/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({ state }),
    },
    token
  );
}

/* =========================
 * cachekv — user-local cache
 * ========================= */

export async function getCacheKV<T = unknown>(
  key: string,
  token?: string
): Promise<T | null> {
  try {
    const res = await authedFetch<{ value?: T } | T>(
      `/cachekv/${encodeURIComponent(key)}`,
      { method: "GET" },
      token
    );
    if (res && typeof res === "object" && "value" in res)
      return (res as { value: T }).value ?? null;
    return (res as T) ?? null;
  } catch {
    return null;
  }
}

export async function setCacheKV(
  key: string,
  value: unknown,
  token?: string
): Promise<void> {
  await authedFetch<unknown>(
    `/cachekv/${encodeURIComponent(key)}`,
    {
      method: "POST",
      body: JSON.stringify(value),
    },
    token
  );
}

export async function removeCacheKV(key: string, token?: string): Promise<void> {
  await authedFetch<unknown>(
    `/cachekv/${encodeURIComponent(key)}`,
    { method: "DELETE" },
    token
  );
}
