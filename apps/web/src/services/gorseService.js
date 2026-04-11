import axios from '@/axios/axios';

const getErrorMessage = (error, fallback = '请求失败') => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

/**
 * Gorse 推荐系统管理接口（需 Admin 权限）
 */
export const GorseService = {
  /**
   * 获取 Gorse 服务状态
   * @returns {{ enabled, endpoint, message }}
   */
  async getStatus() {
    try {
      const response = await axios.get('/admin/gorse/status');
      return response.data?.data ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取 Gorse 状态失败'));
    }
  },

  /**
   * 全量同步（用户 + 帖子 + 反馈）
   * @returns {{ users, posts, feedbacks }}
   */
  async syncAll() {
    try {
      const response = await axios.post('/admin/gorse/sync/all', null, {
        timeout: 300_000, // 全量同步最长 5 分钟
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '全量同步失败'));
    }
  },

  /**
   * 仅同步用户
   */
  async syncUsers() {
    try {
      const response = await axios.post('/admin/gorse/sync/users', null, {
        timeout: 120_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '同步用户失败'));
    }
  },

  /**
   * 仅同步帖子
   */
  async syncPosts() {
    try {
      const response = await axios.post('/admin/gorse/sync/posts', null, {
        timeout: 120_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '同步帖子失败'));
    }
  },

  /**
   * 仅同步反馈（点赞 / 收藏 / 关注）
   */
  async syncFeedbacks() {
    try {
      const response = await axios.post('/admin/gorse/sync/feedbacks', null, {
        timeout: 120_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '同步反馈失败'));
    }
  },
  async syncProjects() {
    try {
      const response = await axios.post('/admin/gorse/sync/projects', null, {
        timeout: 120_000,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '同步项目失败'));
    }
    },
};

export default GorseService;
