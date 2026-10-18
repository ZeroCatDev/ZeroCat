import axios from '@/axios/axios';

export const payload = response => response.data?.data ?? response.data;
export const errorMessage = (error, fallback = '操作失败') => error?.response?.data?.message || error?.message || fallback;
export const formatDate = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '不限期';
export const expiration = value => value ? new Date(value).toISOString() : null;

export default {
  async restrictions(userId) { return payload(await axios.get(`/admin/moderation/users/${userId}/restrictions`)); },
  async restrict(userId, data) { return payload(await axios.post(`/admin/moderation/users/${userId}/restrictions`, data)); },
  async revokeRestriction(id) { return payload(await axios.delete(`/admin/moderation/restrictions/${id}`)); },
  async content(params) { return payload(await axios.get('/admin/moderation/content', { params })); },
  async action(kind, id, action, data = {}) {
    return payload(await (action === 'shadowban'
      ? axios.put(`/admin/moderation/${kind}/${id}/shadowban`, data)
      : axios.post(`/admin/moderation/${kind}/${id}/${action}`, data)));
  },
  async deleted(kind, params) { return payload(await axios.get(kind === 'post' ? '/posts/deleted' : '/project/deleted', { params })); },
  async restore(kind, id) { return payload(await axios.post(`/${kind === 'post' ? 'posts' : 'project'}/${id}/restore`)); },
};
