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
const TOKEN_EXPIRES_AT_KEY = "tokenExpiresAt";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "refreshTokenExpiresAt";
const USER_INFO_KEY = "userInfo";
const TOKEN_REFRESHED_EVENT = "auth:token-refreshed";
const USER_REFRESHED_EVENT = "auth:user-refreshed";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

type FetchInit = RequestInit;
type RefreshTokenResponse = {
  status?: string;
  token?: string;
  expires_at?: string | number | null;
  refresh_expires_at?: string | number | null;
};

let tokenRefreshPromise: Promise<string | null> | null = null;

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

function getLocalStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorageValue(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === "") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {}
}

function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value < 1e12 ? value * 1000 : value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return null;
}

function parseStoredTimestamp(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTimestampExpiring(value: string | null, marginMs = TOKEN_REFRESH_MARGIN_MS): boolean {
  const expiresAt = parseStoredTimestamp(value);
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= marginMs;
}

function persistToken(payload: RefreshTokenResponse) {
  if (!payload.token) return;
  setLocalStorageValue(TOKEN_KEY, payload.token);
  setLocalStorageValue(TOKEN_EXPIRES_AT_KEY, normalizeTimestamp(payload.expires_at));
  setLocalStorageValue(
    REFRESH_TOKEN_EXPIRES_AT_KEY,
    normalizeTimestamp(payload.refresh_expires_at)
  );
}

function emitAuthRefreshEvents() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT));
  window.dispatchEvent(new CustomEvent(USER_REFRESHED_EVENT));
}

export function clearStoredAuthState() {
  setLocalStorageValue(TOKEN_KEY, null);
  setLocalStorageValue(TOKEN_EXPIRES_AT_KEY, null);
  setLocalStorageValue(REFRESH_TOKEN_EXPIRES_AT_KEY, null);
  setLocalStorageValue(USER_INFO_KEY, null);
}

export async function refreshStoredAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (isTimestampExpiring(getLocalStorageValue(REFRESH_TOKEN_EXPIRES_AT_KEY), 0)) {
    clearStoredAuthState();
    emitAuthRefreshEvents();
    return null;
  }

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = fetch(`${API_URL}/account/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = (await res.json().catch(() => null)) as RefreshTokenResponse | null;
        if (!payload || payload.status !== "success" || !payload.token) {
          return null;
        }
        persistToken(payload);
        emitAuthRefreshEvents();
        return payload.token;
      })
      .catch(() => null)
      .finally(() => {
        tokenRefreshPromise = null;
      });
  }

  return tokenRefreshPromise;
}

export async function getFreshAuthToken(
  token?: string | null,
  options: { force?: boolean } = {}
): Promise<string | null> {
  if (typeof window === "undefined") return token ?? null;

  const storedToken = getStoredToken();
  const currentToken = token && token === storedToken ? token : (storedToken ?? token ?? null);

  if (!options.force && currentToken && !isTimestampExpiring(getLocalStorageValue(TOKEN_EXPIRES_AT_KEY))) {
    return currentToken;
  }

  const refreshedToken = await refreshStoredAuthToken();
  if (options.force) return refreshedToken;
  return refreshedToken ?? currentToken;
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function buildAuthedHeaders(init: RequestInit, token: string | null): Record<string, string> {
  return {
    ...(isFormDataBody(init.body) ? {} : { "Content-Type": "application/json" }),
    Accept: "application/json",
    ...authHeader(token),
    ...(init.headers as Record<string, string> | undefined),
  };
}

export async function authedFetchResponse(
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const url = isAbsolute ? path : `${API_URL}${path}`;
  let useToken = await getFreshAuthToken(token);

  let res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: buildAuthedHeaders(init, useToken),
    cache: "no-store",
  });

  if (res.status === 401) {
    const refreshedToken = await getFreshAuthToken(useToken, { force: true });
    if (refreshedToken) {
      useToken = refreshedToken;
      res = await fetch(url, {
        ...init,
        credentials: "include",
        headers: buildAuthedHeaders(init, useToken),
        cache: "no-store",
      });
    }
  }

  return res;
}

export async function apiFetch<T>(
  path: string,
  init: FetchInit = {}
): Promise<T> {
  const { headers, ...rest } = init;
  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const url = isAbsolute ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    },
    cache: "no-store",
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
    `/blog/posts?${qs.toString()}`
  );
  return res.data ?? { posts: [], total: 0, page: 1, limit: 20 };
}

export async function listPublishedPosts(token: string): Promise<BlogPost[]> {
  const res = await authedFetch<ApiEnvelope<BlogPost[]>>(
    `/blog/posts/mine`,
    { method: "GET" },
    token
  );
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
    }>(`/searchapi?${qs.toString()}`);

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
    const res = await apiFetch<ApiEnvelope<BlogPost>>(`/blog/posts/${id}`);
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
      `/blog/posts/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getRelatedPosts(id: number | string): Promise<BlogPost[]> {
  try {
    const res = await apiFetch<ApiEnvelope<BlogPost[]>>(
      `/blog/posts/${id}/related`
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
        `/searchapi?${qs.toString()}`
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
      }>(`/searchapi?${qs.toString()}`);

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
        `/searchapi?${qs.toString()}`
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
      `/project/namespace/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`
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
      `/project/${projectId}/${branch}/latest`
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
      `/user/username/${encodeURIComponent(username)}`
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
        `/searchapi?${projectQs.toString()}`
      ),
      apiFetch<{ users?: User[] }>(`/searchapi?${userQs.toString()}`),
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
  const res = await authedFetchResponse(path, init, token);
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
  payload: Partial<{ title: string; summary: string; state: string; slug: string }>,
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

export async function renameProject(
  id: number | string,
  newName: string,
  token?: string
): Promise<void> {
  const res = await authedFetch<ApiEnvelope<null>>(
    `/project/rename/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({ newName }),
    },
    token
  );

  if (res.status !== "success") {
    throw new Error(res.message || "重命名失败");
  }
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
