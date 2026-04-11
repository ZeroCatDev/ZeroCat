import axios from '@/axios/axios';

const unwrap = (response) => response?.data || {};

export const GitSyncService = {
  async getLinks() {
    const response = await axios.get('/git-sync/links');
    return unwrap(response);
  },

  async deleteLink(linkId) {
    const response = await axios.delete(`/git-sync/links/${linkId}`);
    return unwrap(response);
  },

  async createInstallUrl(redirectUrl) {
    const payload = redirectUrl ? { redirectUrl } : {};
    const response = await axios.post('/git-sync/github/app/install-url', payload);
    return unwrap(response);
  },

  async getInstallationRepos(linkId) {
    const response = await axios.get(`/git-sync/github/app/installations/${linkId}/repos`);
    return unwrap(response);
  },

  async getAllRepos() {
    const response = await axios.get('/git-sync/github/app/repos');
    return unwrap(response);
  },

  async searchRepos(query, options = {}) {
    const params = new URLSearchParams();
    params.set('q', query);
    if (options.perPage) params.set('per_page', String(options.perPage));
    if (options.page) params.set('page', String(options.page));
    const response = await axios.get(`/git-sync/github/app/repos/search?${params.toString()}`);
    return unwrap(response);
  },

  async getProjectSettings(projectId) {
    const response = await axios.get(`/git-sync/projects/${projectId}`);
    return unwrap(response);
  },

  async getProjectBranches(projectId) {
    const response = await axios.get(`/project/branches?projectid=${projectId}`);
    return unwrap(response);
  },

  async bindProject(projectId, payload) {
    const response = await axios.post(`/git-sync/projects/${projectId}/bind`, payload);
    return unwrap(response);
  },

  async unbindProject(projectId) {
    const response = await axios.post(`/git-sync/projects/${projectId}/unbind`);
    return unwrap(response);
  },

  async syncProject(projectId) {
    const response = await axios.post(`/git-sync/projects/${projectId}/sync`);
    return unwrap(response);
  },
};

export default GitSyncService;
