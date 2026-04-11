import axios from '@/axios/axios';
import { getLocalCountInfo, formatPostContent } from '@/utils/postCount';

const getErrorMessage = (error, fallback = '请求失败') => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

const pendingUrlPreviewRequests = new Map();

const normalizeHttpUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * 标准化列表响应数据
 * @param {Object} res - API响应
 * @returns {Object} { posts, includes, nextCursor, hasMore }
 */
const normalizeListResponse = (res) => {
  const data = res?.data ?? res;

  // 处理posts数组
  let posts = [];
  if (Array.isArray(data)) {
    posts = data;
  } else if (Array.isArray(data?.posts)) {
    posts = data.posts;
  } else if (Array.isArray(data?.items)) {
    posts = data.items;
  } else if (Array.isArray(data?.data)) {
    posts = data.data;
  }

  // 处理includes
  const includes = data?.includes ?? { posts: {} };

  // 处理分页
  const nextCursor = data?.next_cursor ?? data?.nextCursor ?? null;
  const hasMore = data?.has_more ?? data?.hasMore ?? posts.length > 0;

  return { posts, includes, nextCursor, hasMore };
};

/**
 * 标准化单个帖子响应（含祖先链和回复）
 * @param {Object} res - API响应
 * @returns {Object} { post, ancestors, replies: { featured, regular }, includes }
 */
const normalizeSingleResponse = (res) => {
  const data = res?.data ?? res;
  const post = data?.post ?? data;
  const ancestors = Array.isArray(data?.ancestors) ? data.ancestors : [];

  // 处理回复：支持新格式 { featured, regular } 和旧格式数组
  let replies = { featured: [], regular: [] };
  if (data?.replies) {
    if (Array.isArray(data.replies)) {
      // 兼容旧格式：将数组作为 regular
      replies.regular = data.replies;
    } else if (typeof data.replies === 'object') {
      replies.featured = Array.isArray(data.replies.featured) ? data.replies.featured : [];
      replies.regular = Array.isArray(data.replies.regular) ? data.replies.regular : [];
    }
  }

  const includes = data?.includes ?? { posts: {} };
  return { post, ancestors, replies, includes };
};

/**
 * 标准化线程响应
 * @param {Object} res - API响应
 * @returns {Object} { post, ancestors, repliesByParent, includes, nextCursor, hasMore }
 */
const normalizeThreadResponse = (res) => {
  const data = res?.data ?? res;

  const post = data?.post ?? null;
  const ancestors = Array.isArray(data?.ancestors) ? data.ancestors : [];

  // 处理按父帖ID分组的回复
  let repliesByParent = {};
  if (data?.replies_by_parent || data?.repliesByParent) {
    const rawReplies = data.replies_by_parent ?? data.repliesByParent;
    for (const [parentId, group] of Object.entries(rawReplies)) {
      repliesByParent[parentId] = {
        featured: Array.isArray(group?.featured) ? group.featured : [],
        regular: Array.isArray(group?.regular) ? group.regular : []
      };
    }
  } else if (Array.isArray(data?.replies)) {
    // 兼容旧API：replies是数组，全部归入post的regular
    if (post?.id) {
      repliesByParent[post.id] = {
        featured: [],
        regular: data.replies
      };
    }
  }

  const includes = data?.includes ?? { posts: {} };
  const nextCursor = data?.next_cursor ?? data?.nextCursor ?? null;
  const hasMore = data?.has_more ?? data?.hasMore ?? false;

  return { post, ancestors, repliesByParent, includes, nextCursor, hasMore };
};

export const PostsService = {
  /**
   * 上报已读（Gorse read 反馈，驱动推荐去重）
   * 仅已登录用户有效，未登录时服务端直接返回 acknowledged: false
   * @param {string|number} postId
   */
  async markRead(postId) {
    try {
      const response = await axios.post(`/posts/${postId}/read`);
      return response.data;
    } catch {
      // 静默失败，不影响主流程
    }
  },

  /**
   * 上传图片
   */
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/posts/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '上传图片失败'));
    }
  },

  /**
   * 创建帖子
   * @param {Object} options
   * @param {string} options.content - 帖子内容
   * @param {number[]} options.mediaIds - 媒体ID列表
   * @param {Object} options.embed - 嵌入资源 { type, id, ... }
   */
  async createPost({ content, mediaIds, embed }) {
    try {
      const payload = { content: formatPostContent(content) };
      if (Array.isArray(mediaIds) && mediaIds.length) {
        payload.mediaIds = mediaIds;
      }
      if (embed && typeof embed === 'object' && embed.type) {
        payload.embed = embed;
      }
      const response = await axios.post('/posts', payload);
      return normalizeSingleResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '发帖失败'));
    }
  },

  /**
   * 回复帖子
   */
  async reply(postId, { content, mediaIds, embed }) {
    try {
      const payload = { content: formatPostContent(content) };
      if (Array.isArray(mediaIds) && mediaIds.length) {
        payload.mediaIds = mediaIds;
      }
      if (embed && typeof embed === 'object' && embed.type) {
        payload.embed = embed;
      }
      const response = await axios.post(`/posts/${postId}/reply`, payload);
      return normalizeSingleResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '回复失败'));
    }
  },

  /**
   * 引用帖子
   */
  async quote(postId, { content, mediaIds, embed }) {
    try {
      const payload = { content: formatPostContent(content) };
      if (Array.isArray(mediaIds) && mediaIds.length) {
        payload.mediaIds = mediaIds;
      }
      if (embed && typeof embed === 'object' && embed.type) {
        payload.embed = embed;
      }
      const response = await axios.post(`/posts/${postId}/quote`, payload);
      return normalizeSingleResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '引用帖文失败'));
    }
  },

  /**
   * 转推
   */
  async retweet(postId) {
    try {
      const response = await axios.post(`/posts/${postId}/retweet`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '转推失败'));
    }
  },

  /**
   * 取消转推
   */
  async unretweet(postId) {
    try {
      const response = await axios.delete(`/posts/${postId}/retweet`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '取消转推失败'));
    }
  },

  /**
   * 点赞
   */
  async like(postId) {
    try {
      const response = await axios.post(`/posts/${postId}/like`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '点赞失败'));
    }
  },

  /**
   * 取消点赞
   */
  async unlike(postId) {
    try {
      const response = await axios.delete(`/posts/${postId}/like`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '取消点赞失败'));
    }
  },

  /**
   * 收藏
   */
  async bookmark(postId) {
    try {
      const response = await axios.post(`/posts/${postId}/bookmark`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '收藏失败'));
    }
  },

  /**
   * 取消收藏
   */
  async unbookmark(postId) {
    try {
      const response = await axios.delete(`/posts/${postId}/bookmark`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '取消收藏失败'));
    }
  },

  /**
   * 删除帖子
   */
  async remove(postId) {
    try {
      const response = await axios.delete(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '删除帖文失败'));
    }
  },

  async syncToSocial(postId) {
    try {
      const response = await axios.post(`/social/sync/post/${postId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '提交社交同步任务失败'));
    }
  },

  /**
   * 获取单条帖子
   */
  async getPost(postId) {
    try {
      const response = await axios.get(`/posts/${postId}`);
      return normalizeSingleResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取帖文失败'));
    }
  },

  /**
   * 获取线程
   * @param {string|number} postId - 根帖子ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getThread(postId, { cursor, limit = 50 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/thread/${postId}`, { params });
      return normalizeThreadResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取线程失败'));
    }
  },

  /**
   * 获取相似帖子（Embedding）
   * @param {string|number} postId - 基准帖子ID
   * @param {Object} options
   * @param {number} options.limit - 返回数量（1-50）
   * @param {number|null} options.minSimilarity - 相似度阈值（0-1）
   * @returns {Object} { posts, includes, sourcePostId, minSimilarity }
   */
  async getSimilarPosts(postId, { limit = 10, minSimilarity = null } = {}) {
    try {
      const parsedLimit = Number(limit);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 50)
        : 10;

      const params = { limit: safeLimit };

      if (minSimilarity !== null && minSimilarity !== undefined && `${minSimilarity}` !== '') {
        const parsedSimilarity = Number(minSimilarity);
        if (!Number.isFinite(parsedSimilarity) || parsedSimilarity < 0 || parsedSimilarity > 1) {
          throw new Error('min_similarity 必须在 0 到 1 之间');
        }
        params.min_similarity = parsedSimilarity;
      }

      const response = await axios.get(`/posts/${postId}/similar`, { params });
      const data = response.data?.data ?? response.data ?? {};

      return {
        posts: Array.isArray(data?.posts) ? data.posts : [],
        includes: data?.includes ?? { posts: {} },
        sourcePostId: data?.source_post_id ?? data?.sourcePostId ?? postId,
        minSimilarity: data?.min_similarity ?? data?.minSimilarity ?? null
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取相似帖子失败'));
    }
  },

  /**
   * 获取用户帖子
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   * @param {boolean} options.includeReplies - 是否包含回复
   */
  async getUserPosts(userId, { cursor, limit = 20, includeReplies = false } = {}) {
    try {
      const params = { limit, include_replies: String(includeReplies) };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户帖文失败'));
    }
  },

  /**
   * 获取首页信息流
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   * @param {boolean} options.includeReplies - 是否包含回复
   * @param {boolean} options.followingOnly - 是否仅显示已关注用户的帖子
   */
  async getFeed({ cursor, limit = 20, includeReplies = false, followingOnly = false } = {}) {
    try {
      const params = { limit, include_replies: String(includeReplies) };
      if (cursor) params.cursor = cursor;
      if (followingOnly) params.following_only = 'true';
      const response = await axios.get('/posts/feed', { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取时间线失败'));
    }
  },

  /**
   * 获取全局信息流（包含 Mastodon 同步帖子，仅登录可用）
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   * @param {boolean} options.includeReplies - 是否包含回复
   */
  async getGlobalFeed({ cursor, limit = 20, includeReplies = false } = {}) {
    try {
      const params = { limit, include_replies: String(includeReplies) };
      if (cursor) params.cursor = cursor;
      const response = await axios.get('/posts/global', { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取全局时间线失败'));
    }
  },

  /**
   * 获取个性化推荐信息流（Gorse）
   * 使用 offset 分页，无推荐时自动降级为时间线
   * @param {Object} options
   * @param {number} options.offset - 分页偏移量
   * @param {number} options.limit - 每页数量（1-50）
   */
  async getRecommendFeed({ offset = 0, limit = 20 } = {}) {
    try {
      const params = { limit, offset };
      const response = await axios.get('/posts/recommend', { params });
      const data = response.data?.data ?? response.data ?? response;

      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const includes = data?.includes ?? { posts: {} };

      // 推荐接口使用 next_offset；降级时使用 next_cursor
      const nextOffset = data?.next_offset ?? null;
      const nextCursor = data?.next_cursor ?? data?.nextCursor ?? null;
      const hasMore = data?.has_more ?? data?.hasMore ?? posts.length > 0;

      return { posts, includes, nextOffset, nextCursor, hasMore };
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取推荐时间线失败'));
    }
  },

  /**
   * 获取提及列表
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getMentions({ cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get('/posts/mentions', { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取提及失败'));
    }
  },

  /**
   * 获取嵌入关联帖子
   * @param {Object} options
   * @param {Object|string} options.embedData - 新接口 embeddata（对象或 JSON 字符串）
   * @param {Object} options.query - 兼容旧调用，最终会合并进 embeddata
   * @param {string} options.type - 兼容旧调用，可作为 embeddata.type
   * @param {string|number} options.id - 兼容旧调用，可作为 embeddata.id
   * @param {string} options.branch - 兼容旧调用，可作为 embeddata.branch
   * @param {string} options.commit - 兼容旧调用，可作为 embeddata.commit
   * @param {Object} options.embed - 可传 { type, id } 作为 type/id 的后备来源
   * @param {string|number} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量，最大100
   * @param {boolean} options.includeReplies - 是否包含回复帖
   */
  async getRelatedPosts({
    type,
    id,
    branch,
    commit,
    query,
    embedData,
    embed,
    cursor,
    limit = 20,
    includeReplies = false
  } = {}) {
    try {
      const parsedLimit = Number(limit);
      const safeLimit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 20;

      const params = {
        limit: safeLimit,
        include_replies: String(Boolean(includeReplies))
      };

      if (cursor !== undefined && cursor !== null && `${cursor}` !== '') {
        params.cursor = cursor;
      }

      const isPlainObject = (value) => (
        Object.prototype.toString.call(value) === '[object Object]'
      );

      const normalizeObject = (source) => {
        if (!isPlainObject(source)) return {};
        const result = {};
        for (const [key, value] of Object.entries(source)) {
          if (value !== undefined) {
            result[key] = value;
          }
        }
        return result;
      };

      const parseEmbedData = () => {
        if (embedData === undefined || embedData === null) return {};

        if (typeof embedData === 'string') {
          const text = embedData.trim();
          if (!text) {
            throw new Error('embeddata 不能为空');
          }

          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new Error('embeddata 必须是合法 JSON');
          }

          if (!isPlainObject(parsed)) {
            throw new Error('embeddata 必须是对象');
          }
          return normalizeObject(parsed);
        }

        if (!isPlainObject(embedData)) {
          throw new Error('embeddata 必须是对象');
        }

        return normalizeObject(embedData);
      };

      const embedQuery = {
        ...normalizeObject(query),
        ...parseEmbedData()
      };

      const fromEmbedType = embed?.type ?? embed?.['type'];
      const fromEmbedId = embed?.id ?? embed?.['id'];
      const fromEmbedBranch = embed?.branch ?? embed?.['branch'];
      const fromEmbedCommit = embed?.commit ?? embed?.['commit'];

      const finalType = type ?? embedQuery.type ?? fromEmbedType;
      const finalId = id ?? embedQuery.id ?? fromEmbedId;
      const finalBranch = branch ?? embedQuery.branch ?? fromEmbedBranch;
      const finalCommit = commit ?? embedQuery.commit ?? fromEmbedCommit;

      if (finalType !== undefined && finalType !== null && `${finalType}` !== '') {
        embedQuery.type = finalType;
      }
      if (finalId !== undefined && finalId !== null && `${finalId}` !== '') {
        embedQuery.id = finalId;
      }
      if (finalBranch !== undefined && finalBranch !== null && `${finalBranch}` !== '') {
        embedQuery.branch = finalBranch;
      }
      if (finalCommit !== undefined && finalCommit !== null && `${finalCommit}` !== '') {
        embedQuery.commit = finalCommit;
      }

      if (!Object.keys(embedQuery).length) {
        throw new Error('embeddata 至少提供一个筛选条件');
      }

      params.embeddata = JSON.stringify(embedQuery);

      const response = await axios.get('/posts/related', { params });
      const payload = response.data?.status === 'success' && response.data?.data
        ? response.data.data
        : response.data;
      return normalizeListResponse(payload);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取关联帖子失败'));
    }
  },
  /**
   * 计算字数
   */
  async count(content) {
    return getLocalCountInfo(content);
  },

  /**
   * 获取 URL 链接预览
   * @param {string} url - 需要解析的链接，仅支持 http/https
   * @param {Object} options
   * @param {boolean} options.force - 是否强制刷新缓存
   * @returns {Object} { preview, cache }
   */
  async fetchUrlPreview(url, { force = false } = {}) {
    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl) {
      throw new Error('无效的 URL');
    }

    const forceRefresh = force === true || force === 'true';
    const requestKey = `${normalizedUrl}::${forceRefresh ? '1' : '0'}`;

    if (pendingUrlPreviewRequests.has(requestKey)) {
      return pendingUrlPreviewRequests.get(requestKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await axios.get('/posts/preview', {
          params: {
            url: normalizedUrl,
            force: String(forceRefresh)
          },
          headers: {
            Accept: 'application/json'
          }
        });

        const body = response?.data;
        if (body?.status === 'error') {
          throw new Error(body?.message || '获取链接预览失败');
        }

        return body?.data ?? body;
      } catch (error) {
        throw new Error(getErrorMessage(error, '获取链接预览失败'));
      } finally {
        pendingUrlPreviewRequests.delete(requestKey);
      }
    })();

    pendingUrlPreviewRequests.set(requestKey, requestPromise);
    return requestPromise;
  },

  // ==================== 帖子级接口 ====================

  /**
   * 获取帖子的所有转推
   * @param {string|number} postId - 帖子ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getRetweets(postId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/${postId}/retweets`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取转推列表失败'));
    }
  },

  /**
   * 获取帖子的所有引用
   * @param {string|number} postId - 帖子ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getQuotes(postId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/${postId}/quotes`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取引用列表失败'));
    }
  },

  /**
   * 获取帖子的点赞用户列表（仅发帖人可见）
   * @param {string|number} postId - 帖子ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   * @returns {Object} { users, total, nextCursor, hasMore }
   */
  async getLikes(postId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/${postId}/likes`, { params });
      const data = response.data;
      return {
        users: data?.users || [],
        total: data?.total || 0,
        nextCursor: data?.next_cursor ?? data?.nextCursor ?? null,
        hasMore: data?.has_more ?? data?.hasMore ?? false
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取点赞列表失败'));
    }
  },

  /**
   * 获取帖子互动分析（收藏数仅作者可见）
   * @param {string|number} postId - 帖子ID
   * @returns {Object}
   */
  async getAnalytics(postId) {
    try {
      const response = await axios.get(`/posts/${postId}/analytics`);
      const data = response.data?.data ?? response.data ?? {};
      return {
        postId: data?.post_id ?? data?.postId ?? postId,
        viewCount: data?.view_count ?? data?.viewCount ?? 0,
        visitorCount: data?.visitor_count ?? data?.visitorCount ?? 0,
        engagementCount: data?.engagement_count ?? data?.engagementCount ?? 0,
        engagementRate: data?.engagement_rate ?? data?.engagementRate ?? 0,
        replyCount: data?.reply_count ?? data?.replyCount ?? 0,
        retweetCount: data?.retweet_count ?? data?.retweetCount ?? 0,
        quoteCount: data?.quote_count ?? data?.quoteCount ?? 0,
        likeCount: data?.like_count ?? data?.likeCount ?? 0,
        bookmarkCount: data?.bookmark_count ?? data?.bookmarkCount,
        raw: data
      };
    } catch (error) {
      const analyticsError = new Error(getErrorMessage(error, '获取帖子分析失败'));
      analyticsError.status = error?.response?.status;
      throw analyticsError;
    }
  },

  /**
   * 获取帖子浏览分析明细（Twitter 风格）
   * @param {string|number} postId - 帖子ID
   * @param {Object} options
   * @param {string} options.startDate - 开始日期 YYYY-MM-DD
   * @param {string} options.endDate - 结束日期 YYYY-MM-DD
   */
  async getAnalyticsViews(postId, { startDate, endDate } = {}) {
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axios.get(`/posts/${postId}/analytics/views`, { params });
      const data = response.data?.data ?? response.data ?? {};

      return {
        postId: data?.post_id ?? data?.postId ?? postId,
        range: data?.range ?? {
          start_date: startDate ?? null,
          end_date: endDate ?? null
        },
        twitterLikeOverview: data?.twitter_like_overview ?? data?.overview ?? {},
        engagementBreakdown: data?.engagement_breakdown ?? {},
        twitterLikeTimeseries: data?.twitter_like_timeseries ?? data?.timeseries ?? {
          impressions: [],
          visitors: [],
          engagements: []
        },
        referrers: Array.isArray(data?.referrers) ? data.referrers : [],
        browsers: Array.isArray(data?.browsers) ? data.browsers : [],
        os: Array.isArray(data?.os) ? data.os : [],
        devices: Array.isArray(data?.devices) ? data.devices : [],
        countries: Array.isArray(data?.countries) ? data.countries : [],
        raw: data
      };
    } catch (error) {
      const analyticsError = new Error(getErrorMessage(error, '获取帖子分析明细失败'));
      analyticsError.status = error?.response?.status;
      throw analyticsError;
    }
  },

  // ==================== 用户级接口 ====================

  /**
   * 获取用户的所有回帖（带祖先链）
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   * @returns {Object} { items: [{ post, ancestors }], includes, nextCursor, hasMore }
   */
  async getUserReplies(userId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}/replies`, { params });
      const data = response.data;
      return {
        items: data?.items || [],
        includes: data?.includes ?? { posts: {} },
        nextCursor: data?.next_cursor ?? data?.nextCursor ?? null,
        hasMore: data?.has_more ?? data?.hasMore ?? false
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户回帖失败'));
    }
  },

  /**
   * 获取用户的所有主贴（原创帖子）
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getUserOriginals(userId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}/originals`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户主贴失败'));
    }
  },

  /**
   * 获取用户的所有带媒体帖子
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getUserMedia(userId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}/media`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户媒体帖子失败'));
    }
  },

  /**
   * 获取用户喜欢的帖子（仅自己可见）
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getUserLikes(userId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}/likes`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户喜欢的帖子失败'));
    }
  },

  /**
   * 获取用户的收藏（仅自己可见）
   * @param {string|number} userId - 用户ID
   * @param {Object} options
   * @param {string} options.cursor - 分页游标
   * @param {number} options.limit - 每页数量
   */
  async getUserBookmarks(userId, { cursor, limit = 20 } = {}) {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      const response = await axios.get(`/posts/user/${userId}/bookmarks`, { params });
      return normalizeListResponse(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取用户收藏失败'));
    }
  }
};

export default PostsService;

