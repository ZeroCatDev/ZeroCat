import axios from '@/axios/axios';

const unwrap = (response) => response?.data || {};

export const BlogSyncService = {
  async getSettings() {
    const response = await axios.get('/git-sync/blog/settings');
    return unwrap(response);
  },

  async updateSettings(payload) {
    const response = await axios.put('/git-sync/blog/settings', payload);
    return unwrap(response);
  },

  async disable() {
    const response = await axios.delete('/git-sync/blog/settings');
    return unwrap(response);
  },

  async listProjects() {
    const response = await axios.get('/git-sync/blog/projects');
    return unwrap(response);
  },

  async resyncAll() {
    const response = await axios.post('/git-sync/blog/resync');
    return unwrap(response);
  },

  async syncProject(projectId) {
    const response = await axios.post(`/git-sync/blog/sync/${projectId}`);
    return unwrap(response);
  },
};

export default BlogSyncService;
