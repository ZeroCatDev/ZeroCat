import axios from '@/axios/axios';

const getErrorMessage = (error, fallback = '请求失败') => {
  return error?.response?.data?.message || error?.message || fallback;
};

const toNumberOrDefault = (value, defaultValue) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

export const UserRecommendationService = {
  /**
   * 获取当前登录用户的推荐关注用户
   * @param {Object} params
   * @param {number} [params.limit=20]
   * @param {number} [params.offset=0]
   */
  async getMyRecommendations(params = {}) {
    try {
      const response = await axios.get('/user/recommend/me', { params });
      const payload = response?.data?.data || {};

      return {
        users: Array.isArray(payload.users) ? payload.users : [],
        totalCandidates: toNumberOrDefault(payload.total_candidates, 0),
        offset: toNumberOrDefault(payload.offset, 0),
        limit: toNumberOrDefault(payload.limit, params.limit ?? 20),
        hasMore: Boolean(payload.has_more),
      };
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取推荐关注失败'));
    }
  },
};

export default UserRecommendationService;
