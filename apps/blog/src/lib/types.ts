export interface User {
  id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
  regTime?: string | null;
  status?: string | null;
  type?: string | null;
  location?: string | null;
  url?: string | null;
  custom_status?: string | null;
}

export interface Tag {
  id: number;
  name: string;
  count?: number;
  created_at?: string;
}

export interface BlogPostAuthor {
  id: number;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio?: string | null;
}

export interface BlogConfig {
  cover?: string;
  slug?: string;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
}

export interface BlogPost {
  id: number;
  name: string;
  title: string;
  description: string | null;
  summary?: string | null;
  type: string;
  state: string;
  view_count: number;
  star_count: number;
  time: string;
  authorid: number;
  default_branch: string;
  thumbnail: string | null;
  author?: BlogPostAuthor;
  project_tags?: Array<{ id: number; name: string }>;
  blogConfig?: BlogConfig;
  file?: {
    source: string;
    size?: number;
  };
  extra?: {
    blog?: { published?: boolean; [key: string]: unknown };
    [key: string]: unknown;
  };
}

export interface PostsResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
}

export interface Draft {
  title?: string;
  description?: string;
  content?: string;
  tags?: string[];
  cover?: string | null;
  slug?: string;
  baseCommitId?: string | null;
  updatedAt?: string;
  savedAt?: string;
}

export interface DraftListItem {
  projectId: number;
  project: {
    id: number;
    name: string;
    title: string;
    state: string;
    time: string;
    extra?: {
      blog?: {
        published?: boolean;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  };
  draft: Draft;
  savedAt: string;
}

export type PostListItem = BlogPost & {
  extra?: {
    blog?: { published?: boolean; [key: string]: unknown };
    [key: string]: unknown;
  };
};

export interface ProjectNamespaceInfo {
  id: number;
  name: string;
  title: string;
  description: string;
  default_branch: string;
  type: string;
  state: string;
  view_count: number;
  star_count: number;
  time: string;
  authorid: number;
  thumbnail: string | null;
  author: BlogPostAuthor;
  tags?: Tag[];
  project_tags?: Array<{ id: number; name: string }>;
}

export interface CommitInfo {
  id: string;
  commit_file: string;
  message: string;
  commit_date: string;
  authorId?: number;
  commit_description?: string;
}

export interface ProjectLatestResponse {
  status: "success" | "error";
  accessFileToken?: string;
  commit?: CommitInfo;
  branch?: { name: string; latest_commit_hash: string };
  message?: string;
}

export interface ApiEnvelope<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
}
