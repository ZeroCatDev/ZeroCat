import axios from '@/axios/axios';

const unwrap = (response) => response?.data || {};

export const SocialService = {
  async getOverview() {
    const response = await axios.get('/social/overview');
    return unwrap(response);
  },

  async updateSyncSettings(payload) {
    const response = await axios.post('/social/sync/settings', payload);
    return unwrap(response);
  },

  async getTwitterSyncApp() {
    const response = await axios.get('/social/twitter/sync/app');
    return unwrap(response);
  },

  async saveTwitterSyncApp(payload) {
    const response = await axios.post('/social/twitter/sync/app', payload);
    return unwrap(response);
  },

  async deleteTwitterSyncApp() {
    const response = await axios.delete('/social/twitter/sync/app');
    return unwrap(response);
  },

  getTwitterSyncOAuthStartUrl(token) {
    const url = new URL('/social/twitter/sync/oauth/start', import.meta.env.VITE_APP_BASE_API);
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  },

  getBlueskySyncOAuthStartUrl(token, pds) {
    const url = new URL('/social/bluesky/sync/oauth/start', import.meta.env.VITE_APP_BASE_API);
    if (token) {
      url.searchParams.set('token', token);
    }
    if (pds) {
      url.searchParams.set('pds', pds);
    }
    return url.toString();
  },

  async setBlueskyPds(pds) {
    const response = await axios.post('/social/bluesky/pds', { pds });
    return unwrap(response);
  },

  async syncPost(postId) {
    const response = await axios.post(`/social/sync/post/${postId}`);
    return unwrap(response);
  },
};

export default SocialService;
