import axios from '@/axios/axios';
import { get as getCacheKv, set as setCacheKv } from '@/services/cachekv';
import { localuser } from '@/services/localAccount';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 10;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 50;

export const SEARCH_SCOPES = [
  'projects',
  'users',
  'posts',
  'project_files',
  'lists',
  'tags'
];

const toArray = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const sanitizePage = (page) => {
  const parsed = Number.parseInt(page, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const sanitizePerPage = (perPage) => {
  const parsed = Number.parseInt(perPage, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PER_PAGE;
  if (parsed < 1) return 1;
  if (parsed > MAX_PER_PAGE) return MAX_PER_PAGE;
  return parsed;
};

const normalizeScope = (value) => {
  if (!value) return 'projects';
  const scope = String(value).trim();
  if (scope === 'list') return 'lists';
  if (scope === 'tag') return 'tags';
  if (scope === 'all') return 'projects';
  return SEARCH_SCOPES.includes(scope) ? scope : 'projects';
};

const normalizeResponse = (payload = {}, fallbackScope = 'projects', fallbackPage = 1, fallbackPerPage = DEFAULT_PER_PAGE) => {
  const scope = normalizeScope(payload.scope ?? fallbackScope);
  const totals = payload.totals || {};
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const users = Array.isArray(payload.users) ? payload.users : [];
  const posts = Array.isArray(payload.posts) ? payload.posts : [];
  const projectFiles = Array.isArray(payload.projectFiles)
    ? payload.projectFiles
    : (Array.isArray(payload.project_files) ? payload.project_files : []);
  const lists = Array.isArray(payload.lists) ? payload.lists : [];
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  const computedTotalCount = Number(payload.totalCount ?? payload.total_count);
  const totalCount = Number.isFinite(computedTotalCount)
    ? computedTotalCount
    : (totals?.[scope] ?? 0);

  const page = sanitizePage(payload.page ?? fallbackPage);
  const perPage = sanitizePerPage(payload.limit ?? payload.perPage ?? fallbackPerPage);

  return {
    scope,
    query: String(payload.query ?? ''),
    page,
    perPage,
    projects,
    users,
    posts,
    projectFiles,
    lists,
    tags,
    totals: {
      projects: Number(totals.projects ?? 0),
      users: Number(totals.users ?? 0),
      posts: Number(totals.posts ?? 0),
      projectFiles: Number(totals.projectFiles ?? totals.project_files ?? 0),
      lists: Number(totals.lists ?? 0),
      tags: Number(totals.tags ?? 0)
    },
    totalCount,
    fileSearchStrategy: payload.fileSearchStrategy ?? payload.file_search_strategy ?? 'disabled'
  };
};

export const normalizeSearchQuery = (rawQuery = {}) => {
  const keyword = String(rawQuery.keyword ?? rawQuery.q ?? rawQuery.search_source ?? '').trim();
  const scope = normalizeScope(rawQuery.scope ?? rawQuery.search_scope);
  const page = sanitizePage(rawQuery.page ?? rawQuery.curr);
  const perPage = sanitizePerPage(rawQuery.perPage ?? rawQuery.pageSize ?? rawQuery.limit);

  const userId = toArray(rawQuery.userId ?? rawQuery.userid ?? rawQuery.authorid ?? rawQuery.search_userid)
    .map((v) => String(v).trim())
    .filter((v) => /^\d+$/.test(v))
    .map((v) => Number(v));
  const tags = toArray(rawQuery.tags ?? rawQuery.tag ?? rawQuery.search_tag);

  return {
    keyword,
    scope,
    userId,
    tags,
    type: rawQuery.type ?? rawQuery.search_type ?? '',
    orderBy: rawQuery.orderBy ?? rawQuery.orderby ?? rawQuery.sort ?? rawQuery.search_orderby ?? '',
    state: rawQuery.state ?? rawQuery.search_state ?? '',
    postType: rawQuery.postType ?? rawQuery.search_post_type ?? '',
    userStatus: rawQuery.userStatus ?? rawQuery.search_user_status ?? '',
    page,
    perPage
  };
};

export const buildSearchParams = (query = {}) => {
  const normalized = normalizeSearchQuery(query);
  const params = {
    keyword: normalized.keyword,
    scope: normalized.scope,
    page: normalized.page,
    perPage: normalized.perPage
  };

  if (normalized.userId.length) params.userId = normalized.userId.join(',');
  if (normalized.tags.length) params.tags = normalized.tags.join(',');
  if (normalized.type) params.type = normalized.type;
  if (normalized.orderBy) params.orderBy = normalized.orderBy;
  if (normalized.state) params.state = normalized.state;
  if (normalized.postType) params.postType = normalized.postType;
  if (normalized.userStatus) params.userStatus = normalized.userStatus;

  return params;
};

const normalizeSearchHistory = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    const term = String(item || '').trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    normalized.push(term);
    if (normalized.length >= MAX_HISTORY_ITEMS) break;
  }
  return normalized;
};

const hasAccessToken = () => {
  try {
    return !!localuser?.isLogin?.value;
  } catch {
    return false;
  }
};

export const loadSearchHistory = async () => {
  if (!hasAccessToken()) {
    return [];
  }

  try {
    const history = await getCacheKv(SEARCH_HISTORY_KEY);
    if (history === undefined || history === null) return [];
    if (typeof history === 'string') {
      try {
        return normalizeSearchHistory(JSON.parse(history));
      } catch {
        return normalizeSearchHistory([history]);
      }
    }
    return normalizeSearchHistory(history);
  } catch (error) {
    console.error('Failed to load search history:', error);
    return [];
  }
};

export const addToSearchHistory = async (term, currentHistory = []) => {
  if (!hasAccessToken()) {
    return [];
  }

  try {
    const normalizedTerm = String(term || '').trim();
    if (!normalizedTerm) return normalizeSearchHistory(currentHistory);

    const history = normalizeSearchHistory(currentHistory);
    const index = history.indexOf(normalizedTerm);
    if (index > -1) {
      history.splice(index, 1);
    }
    history.unshift(normalizedTerm);
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }

    await setCacheKv(SEARCH_HISTORY_KEY, history);
    return history;
  } catch (error) {
    console.error('Failed to save search history:', error);
    return [];
  }
};

const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || '搜索失败';
};

export const performSearch = async (query) => {
  const params = buildSearchParams(query);
  try {
    const response = await axios.get('/searchapi', { params });
    const data = response?.data ?? {};

    // 兼容旧接口返回结构
    if (params.scope === 'projects' && Array.isArray(data.projects) && typeof data.totalCount !== 'undefined' && !data.scope) {
      return normalizeResponse(
        {
          scope: 'projects',
          query: params.keyword,
          page: params.page,
          limit: params.perPage,
          projects: data.projects,
          users: [],
          posts: [],
          projectFiles: [],
          lists: [],
          tags: [],
          totals: { projects: Number(data.totalCount || 0) },
          totalCount: Number(data.totalCount || 0),
          fileSearchStrategy: 'disabled'
        },
        params.scope,
        params.page,
        params.perPage
      );
    }

    return normalizeResponse(data, params.scope, params.page, params.perPage);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getScopeItems = (response) => {
  const scope = response?.scope || 'all';
  if (scope === 'projects') return response.projects || [];
  if (scope === 'users') return response.users || [];
  if (scope === 'posts') return response.posts || [];
  if (scope === 'project_files') return response.projectFiles || [];
  if (scope === 'lists') return response.lists || [];
  if (scope === 'tags') return response.tags || [];
  return [];
};

