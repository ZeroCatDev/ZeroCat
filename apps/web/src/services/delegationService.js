import axios from '@/axios/axios';
import { payload } from '@/services/moderationService';

const headers = delegation => ({ 'X-Zerocat-Delegation': String(delegation.id) });
const resourceId = delegation => encodeURIComponent(delegation.target_id);

export default {
  async list() { return payload(await axios.get('/delegations')); },
  async create(data) { return payload(await axios.post('/delegations', data)); },
  async respond(id, action) { return payload(await axios.post(`/delegations/${id}/${action}`)); },
  async resource(delegation) {
    const id = resourceId(delegation), config = { headers: headers(delegation) };
    const path = { project: `/project/id/${id}`, post: `/posts/${id}`, list: `/projectlist/lists/listid/${id}`,
      comment: `/commentservice/comments/${id}` }[delegation.target_type];
    if (path) return payload(await axios.get(path, config));
    if (delegation.target_type === 'blog') {
      try { return { draft: payload(await axios.get(`/blog/drafts/${id}`, config)) }; }
      catch (err) {
        if (err?.response?.status !== 404) throw err;
        return { article: payload(await axios.get(`/blog/posts/${id}`, config)) };
      }
    }
    throw new Error('此资源暂不提供代表操作预览');
  },
  async updateResource(delegation, data) {
    const id = resourceId(delegation), config = { headers: headers(delegation) };
    if (delegation.target_type === 'project') return payload(await axios.put(`/project/id/${id}`, data, config));
    if (delegation.target_type === 'list') return payload(await axios.post(`/projectlist/lists/update/${id}`, data, config));
    if (delegation.target_type === 'comment') return payload(await axios.put(`/commentservice/comments/${id}`, data, config));
    if (delegation.target_type === 'blog') return payload(await axios.put(`/blog/drafts/${id}`, data, config));
    throw new Error('此资源暂不提供代表编辑');
  },
  async publishDraft(delegation) {
    if (delegation.target_type !== 'blog') throw new Error('委托资源类型不匹配');
    return payload(await axios.post(`/blog/drafts/${resourceId(delegation)}/publish`, {}, { headers: headers(delegation) }));
  },
  async likeComment(delegation, like) {
    if (delegation.target_type !== 'comment') throw new Error('委托资源类型不匹配');
    return payload(await axios.put(`/commentservice/comments/${resourceId(delegation)}`, { like }, { headers: headers(delegation) }));
  },
  async deleteResource(delegation, sudoToken) {
    const id = resourceId(delegation);
    const config = { headers: { ...headers(delegation), ...(sudoToken ? { 'X-Sudo-Token': sudoToken } : {}) } };
    if (delegation.target_type === 'list') return payload(await axios.post('/projectlist/lists/delete', { id: delegation.target_id }, config));
    const path = { project: `/project/${id}`, post: `/posts/${id}`, comment: `/commentservice/comments/${id}`,
      blog: `/blog/drafts/${id}` }[delegation.target_type];
    if (!path) throw new Error('此资源暂不提供代表删除');
    return payload(await axios.delete(path, config));
  },
};
