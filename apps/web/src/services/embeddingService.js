import axios from '@/axios/axios';

const getErrorMessage = (error, fallback = '请求失败') => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

/**
 * Embedding 向量服务接口
 */
export const EmbeddingService = {
  // ─── 前端公开接口 ────────────────────────────────────────────────────────────

  /**
   * 获取 Embedding 服务状态（公开）
   * @returns {{ enabled, provider?, model?, dimensions?, stats? }}
   */
  async getPublicStatus() {
    try {
      const response = await axios.get('/posts/embedding/status');
      return response.data?.data ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取 Embedding 状态失败'));
    }
  },

  /**
   * 获取相似帖子
   * @param {number} postId - 帖子 ID
   * @param {number} [limit=10] - 返回数量，1-50
   * @returns {{ posts, includes, message? }}
   */
  async getSimilarPosts(postId, limit = 10) {
    try {
      const response = await axios.get(`/posts/${postId}/similar`, {
        params: { limit },
      });
      return response.data?.data ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取相似帖子失败'));
    }
  },

  // ─── 管理后台接口（需 Admin 权限）────────────────────────────────────────────

  /**
   * 获取详细服务状态（Admin）
   * @returns {{ enabled, provider, model, dimensions, apiBase, storedEmbeddings, pgvectorReady? }}
   */
  async getAdminStatus() {
    try {
      const response = await axios.get('/admin/embedding/status');
      return response.data?.data ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取 Embedding 详细状态失败'));
    }
  },

  /**
   * 初始化 pgvector（幂等）
   * @returns {{ status, message }}
   */
  async initPgvector() {
    try {
      const response = await axios.post('/admin/embedding/init');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '初始化 pgvector 失败'));
    }
  },

  /**
   * 全量生成帖子向量
   * @param {boolean} [force=false] - 是否强制重新生成
   * @returns {{ status, message, data: { total, batches, jobIds } }}
   */
  async generateAllPosts(force = false) {
    try {
      const response = await axios.post('/admin/embedding/generate/posts', { force }, {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '全量生成帖子向量失败'));
    }
  },

  /**
   * 全量生成用户向量
   * @param {boolean} [force=false] - 是否强制重新生成
   * @returns {{ status, message, data: { total, batches, jobIds } }}
   */
  async generateAllUsers(force = false) {
    try {
      const response = await axios.post('/admin/embedding/generate/users', { force }, {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '全量生成用户向量失败'));
    }
  },

  /**
   * 全量生成项目向量
   * @param {boolean} [force=false] - 是否强制重新生成
   * @returns {{ status, message, data: { total, batches, jobIds } }}
   */
  async generateAllProjects(force = false) {
    try {
      const response = await axios.post('/admin/embedding/generate/projects', { force }, {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '全量生成项目向量失败'));
    }
  },

  /**
   * 生成“每日检查缺失”的项目向量
   * @returns {{ status, message, data?: { total?, batches?, jobIds? } }}
   */
  async generateMissingDailyCheckProjects() {
    try {
      const response = await axios.post('/admin/embedding/generate/projects/missing-daily-check', {}, {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '生成每日检查缺失项目向量失败'));
    }
  },

  /**
   * 预览“每日检查缺失”的项目向量候选（不入队）
   * @returns {{ status, message, data?: { rules, candidates, previewProjectIds } }}
   */
  async previewMissingDailyCheckProjects() {
    try {
      const response = await axios.get('/admin/embedding/generate/projects/missing-daily-check/preview', {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '预览每日检查缺失项目向量失败'));
    }
  },

  /**
   * 全量生成所有向量（帖子 + 用户 + 项目）
   * @param {boolean} [force=false] - 是否强制重新生成
   * @returns {{ status, message, data: { posts, users, projects } }}
   */
  async generateAll(force = false) {
    try {
      const response = await axios.post('/admin/embedding/generate/all', { force }, {
        timeout: 60_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '全量生成向量失败'));
    }
  },

  /**
   * 单帖子向量生成（强制模式）
   * @param {number} postId - 帖子 ID
   * @returns {{ status, message, data: { jobId } }}
   */
  async generatePost(postId) {
    try {
      const response = await axios.post(`/admin/embedding/generate/post/${postId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, `生成帖子 ${postId} 向量失败`));
    }
  },

  /**
   * 单用户向量生成（强制模式）
   * @param {number} userId - 用户 ID
   * @returns {{ status, message, data: { jobId } }}
   */
  async generateUser(userId) {
    try {
      const response = await axios.post(`/admin/embedding/generate/user/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, `生成用户 ${userId} 向量失败`));
    }
  },

  /**
   * 单项目向量生成（强制模式）
   * @param {number} projectId - 项目 ID
   * @returns {{ status, message, data: { jobId } }}
   */
  async generateProject(projectId) {
    try {
      const response = await axios.post(`/admin/embedding/generate/project/${projectId}`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, `生成项目 ${projectId} 向量失败`));
    }
  },
};

export default EmbeddingService;
