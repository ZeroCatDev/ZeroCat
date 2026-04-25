import { authedFetchResponse } from "./api";

export interface GitAccount {
  id: number;
  provider: string;
  account?: {
    id?: number;
    login?: string;
    avatar_url?: string;
    name?: string;
  };
  createdAt?: string;
}

export interface GitRepo {
  id?: number;
  name: string;
  full_name?: string;
  owner: string;
  private?: boolean;
  default_branch?: string;
  html_url?: string;
  description?: string | null;
}

export interface BlogSyncFrontMatter {
  includeTitle: boolean;
  includeDate: boolean;
  includeTags: boolean;
  includeDescription: boolean;
}

export interface BlogSyncSettings {
  enabled: boolean;
  linkId?: number | null;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  directory?: string;
  framework?: "hexo" | "hugo" | "valaxy";
  fileNameTemplate?: string;
  excludeReadme?: boolean;
  allowPrivateToPublic?: boolean;
  frontMatter?: BlogSyncFrontMatter;
}

export interface BlogSyncProject {
  id: number | string;
  name: string;
  title?: string;
  state?: string;
  syncState?: {
    filePath?: string;
    lastSyncedAt?: string;
    lastError?: string | null;
  };
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await authedFetchResponse(path, init, token);

  const text = await res.text().catch(() => "");
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json && (json as { message?: string }).message) ||
      `HTTP ${res.status}`;
    throw Object.assign(new Error(String(message)), { status: res.status });
  }
  return (json as T) ?? ({} as T);
}

/* Settings */

export async function getBlogSyncSettings(token?: string): Promise<BlogSyncSettings | null> {
  try {
    const res = await request<{ data?: BlogSyncSettings } | BlogSyncSettings>(
      `/git-sync/blog/settings`,
      { method: "GET" },
      token
    );
    if (res && typeof res === "object" && "data" in res) {
      return (res as { data?: BlogSyncSettings }).data ?? null;
    }
    return (res as BlogSyncSettings) ?? null;
  } catch {
    return null;
  }
}

export async function updateBlogSyncSettings(
  payload: Partial<BlogSyncSettings>,
  token?: string
): Promise<BlogSyncSettings | null> {
  const res = await request<{ data?: BlogSyncSettings } | BlogSyncSettings>(
    `/git-sync/blog/settings`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token
  );
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data?: BlogSyncSettings }).data ?? null;
  }
  return (res as BlogSyncSettings) ?? null;
}

export async function disableBlogSync(token?: string): Promise<void> {
  await request(`/git-sync/blog/settings`, { method: "DELETE" }, token);
}

export async function listBlogSyncProjects(token?: string): Promise<BlogSyncProject[]> {
  try {
    const res = await request<{ data?: BlogSyncProject[] } | BlogSyncProject[]>(
      `/git-sync/blog/projects`,
      { method: "GET" },
      token
    );
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object" && "data" in res && Array.isArray((res as { data?: BlogSyncProject[] }).data)) {
      return (res as { data?: BlogSyncProject[] }).data ?? [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function resyncAllBlogPosts(token?: string): Promise<void> {
  await request(`/git-sync/blog/resync`, { method: "POST" }, token);
}

export async function syncBlogProject(projectId: number | string, token?: string): Promise<void> {
  await request(`/git-sync/blog/sync/${projectId}`, { method: "POST" }, token);
}

/* Git accounts & repos */

export async function getGitAccounts(token?: string): Promise<GitAccount[]> {
  try {
    const res = await request<{ data?: GitAccount[] } | GitAccount[]>(
      `/git-sync/links`,
      { method: "GET" },
      token
    );
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object" && "data" in res && Array.isArray((res as { data?: GitAccount[] }).data)) {
      return (res as { data?: GitAccount[] }).data ?? [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function createGitInstallUrl(
  redirectUrl: string,
  token?: string
): Promise<string | null> {
  try {
    const res = await request<{ data?: { url?: string } } | { url?: string }>(
      `/git-sync/github/app/install-url`,
      {
        method: "POST",
        body: JSON.stringify({ redirectUrl }),
      },
      token
    );
    const url =
      (res && "data" in res && (res as { data?: { url?: string } }).data?.url) ||
      (res as { url?: string }).url ||
      null;
    return url || null;
  } catch {
    return null;
  }
}

export async function getRepos(linkId: number, token?: string): Promise<GitRepo[]> {
  try {
    const res = await request<{ data?: GitRepo[] } | GitRepo[]>(
      `/git-sync/github/app/installations/${linkId}/repos`,
      { method: "GET" },
      token
    );
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object" && "data" in res && Array.isArray((res as { data?: GitRepo[] }).data)) {
      return (res as { data?: GitRepo[] }).data ?? [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getRepoBranches(
  params: { linkId: number; repoOwner: string; repoName: string },
  token?: string
): Promise<string[]> {
  try {
    const qs = new URLSearchParams();
    qs.set("linkId", String(params.linkId));
    qs.set("owner", params.repoOwner);
    qs.set("repo", params.repoName);
    const res = await request<{ data?: Array<{ name: string } | string> } | Array<{ name: string } | string>>(
      `/git-sync/github/app/repos/branches?${qs.toString()}`,
      { method: "GET" },
      token
    );
    const list = Array.isArray(res)
      ? res
      : res && typeof res === "object" && "data" in res
        ? (res as { data?: Array<{ name: string } | string> }).data ?? []
        : [];
    return list.map((item) =>
      typeof item === "string" ? item : item.name
    ).filter(Boolean);
  } catch {
    return [];
  }
}

export const frameworkDefaults: Record<NonNullable<BlogSyncSettings["framework"]>, string> = {
  hexo: "source/_posts",
  hugo: "content/posts",
  valaxy: "pages/posts",
};
