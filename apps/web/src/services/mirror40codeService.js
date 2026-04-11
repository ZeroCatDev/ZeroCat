import axios from '@/axios/axios';

const getErrorMessage = (error, fallback = '请求失败') => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

export const Mirror40codeService = {
  async getStatus() {
    try {
      const response = await axios.get('/admin/mirror40code/status');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '获取镜像状态失败'));
    }
  },

  async triggerFullSync() {
    try {
      const response = await axios.post('/admin/mirror40code/daily-sync', {});
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '触发全量同步失败'));
    }
  },

  async triggerUserSync(userId) {
    try {
      const response = await axios.post('/admin/mirror40code/sync-user', {
        remoteUserId: Number(userId),
        forceSync: true,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '触发用户同步失败'));
    }
  },

  async triggerProjectSync(projectId, remoteUserId, remoteUpdateTime = Math.floor(Date.now() / 1000)) {
    try {
      const payload = {
        remoteProjectId: Number(projectId),
        remoteUpdateTime: Number(remoteUpdateTime),
      };
      if (remoteUserId !== undefined && remoteUserId !== null && `${remoteUserId}` !== '') {
        payload.remoteUserId = Number(remoteUserId);
      }
      const response = await axios.post('/admin/mirror40code/sync-project', payload);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, '触发项目同步失败'));
    }
  },
};

export default Mirror40codeService;
