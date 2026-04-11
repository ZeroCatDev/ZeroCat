import api from '@/axios/axios';

export default {
    /**
     * 1.1 联邦统计概览
     * GET /ap/admin/federation/stats
     */
    getStats() {
        return api.get('/ap/admin/federation/stats');
    },

    /**
     * 1.2 联邦用户管理 - 列出所有拥有远程关注者的本地用户
     * GET /ap/admin/federation/users
     * @param {Object} params - { page, limit }
     */
    getFederatedUsers(params) {
        return api.get('/ap/admin/federation/users', { params });
    },

    /**
     * 1.2 联邦用户管理 - 查看指定用户的远程关注者详情
     * GET /ap/admin/federation/users/:userId/followers
     * @param {Number} userId
     * @param {Object} params - { page, limit }
     */
    getUserFollowers(userId, params) {
        return api.get(`/ap/admin/federation/users/${userId}/followers`, { params });
    },

    /**
     * 1.2 联邦用户管理 - 向指定用户的所有远程关注者触发历史帖子回填
     * POST /ap/admin/federation/users/:userId/backfill
     * @param {Number} userId
     */
    backfillUserPosts(userId) {
        return api.post(`/ap/admin/federation/users/${userId}/backfill`);
    },

    /**
     * 1.3 远程代理用户管理 - 查看远程代理用户列表
     * GET /ap/admin/federation/proxy-users
     * @param {Object} params - { page, limit, q }
     */
    getProxyUsers(params) {
        return api.get('/ap/admin/federation/proxy-users', { params });
    },

    /**
     * 1.3 远程代理用户管理 - 手动触发远程用户的帖子拉取任务
     * POST /ap/admin/federation/proxy-users/:userId/fetch-posts
     * @param {Number} userId
     * @param {Object} body - { maxPosts }
     */
    fetchProxyUserPosts(userId, body) {
        return api.post(`/ap/admin/federation/proxy-users/${userId}/fetch-posts`, body);
    },

    /**
     * 1.3 远程代理用户管理 - 强制刷新远程用户资料
     * POST /ap/admin/federation/proxy-users/:userId/refresh
     * @param {Number} userId
     */
    refreshProxyUserProfile(userId) {
        return api.post(`/ap/admin/federation/proxy-users/${userId}/refresh`);
    },

    /**
     * 1.4 帖子同步管理 - 列出已同步帖子
     * GET /ap/admin/federation/posts
     * @param {Object} params - { page, limit, platform }
     */
    getFederatedPosts(params) {
        return api.get('/ap/admin/federation/posts', { params });
    },

    /**
     * 1.4 帖子同步管理 - 查看帖子的完整同步状态
     * GET /ap/admin/federation/posts/:postId/sync-status
     * @param {Number} postId
     */
    getPostSyncStatus(postId) {
        return api.get(`/ap/admin/federation/posts/${postId}/sync-status`);
    },

    /**
     * 1.4 帖子同步管理 - 手动触发帖子重新推送到所有平台
     * POST /ap/admin/federation/posts/:postId/resync
     * @param {Number} postId
     * @param {Object} body - { platforms } (Optional)
     */
    resyncPost(postId, body) {
        return api.post(`/ap/admin/federation/posts/${postId}/resync`, body);
    },

    /**
     * 1.4 帖子同步管理 - 手动触发帖子仅推送到 AP
     * POST /ap/admin/federation/posts/:postId/push-ap
     * @param {Number} postId
     */
    pushPostToAp(postId) {
        return api.post(`/ap/admin/federation/posts/${postId}/push-ap`);
    },

    /**
     * 1.5 队列管理 - 查看状态
     * GET /ap/admin/federation/queue
     */
    getQueueStats() {
        return api.get('/ap/admin/federation/queue');
    },

    /**
     * 1.5 队列管理 - 暂停或恢复 AP 联邦队列
     * POST /ap/admin/federation/queue/:action
     * @param {String} action - 'pause' | 'resume'
     */
    toggleQueue(action) {
        return api.post(`/ap/admin/federation/queue/${action}`);
    },

    /**
     * 二、远程用户公共端点 - 搜索
     * GET /ap/remote/users/search
     * @param {Object} params - { q, limit }
     */
    searchRemoteUsers(params) {
        return api.get('/ap/remote/users/search', { params });
    },

    /**
     * 二、远程用户公共端点 - 解析远程用户
     * POST /ap/remote/users/resolve
     * @param {Object} body - { acct } or { actorUrl }
     */
    resolveRemoteUser(body) {
        return api.post('/ap/remote/users/resolve', body);
    },

    /**
     * 二、远程用户公共端点 - 获取远程用户详细信息
     * GET /ap/remote/users/:userId/info
     * @param {Number} userId
     */
     getRemoteUserInfo(userId) {
        return api.get(`/ap/remote/users/${userId}/info`);
    },

    /**
     * 二、远程用户公共端点 - 拉取远程用户的帖子 (需登录)
     * POST /ap/remote/users/:userId/fetch-posts
     * @param {Number} userId
     * @param {Object} body - { maxPosts }
     */
    fetchRemoteUserPosts(userId, body) {
        return api.post(`/ap/remote/users/${userId}/fetch-posts`, body);
    },

    /**
     * 二、远程用户公共端点 - 获取远程用户在本地的帖子列表
     * GET /ap/remote/users/:userId/posts
     * @param {Number} userId
     * @param {Object} params - { page, limit }
     */
    getRemoteUserLocalPosts(userId, params) {
        return api.get(`/ap/remote/users/${userId}/posts`, { params });
    },

    /**
     * 二、远程用户公共端点 - 获取当前登录用户的出站关注状态
     * GET /ap/remote/follows
     */
    getOutboundFollows() {
        return api.get('/ap/remote/follows');
    },

    /**
     * 二、远程用户公共端点 - 检查指定域名是否被允许
     * GET /ap/remote/check-instance
     * @param {String} domain
     */
    checkInstance(domain) {
         return api.get('/ap/remote/check-instance', { params: { domain } });
    },

    // User-side Post Sync Endpoints (Assuming these should be in postsService but can be here too for organization if preferred, sticking to the doc structure)
    // Actually, usually these would go into postsService, but since I'm making a dedicated federation service, I can put the federation-specific post actions here or just assume they are part of the broader "federation" feature set.
    // However, the doc separates them into "User-side". Let's put them here for now, clearly marked.

    /**
     * 三、用户侧帖子同步 - 重新推送
     * POST /posts/:id/resync
     * @param {Number} id
     */
    userResyncPost(id) {
        return api.post(`/posts/${id}/resync`);
    },

    /**
     * 三、用户侧帖子同步 - 推送到 AP
     * POST /posts/:id/push-federation
     * @param {Number} id
     */
    userPushPostToFederation(id) {
        return api.post(`/posts/${id}/push-federation`);
    },

    /**
     * 三、用户侧帖子同步 - 拉取远程用户的最新帖子
     * POST /posts/remote-user/:userId/fetch
     * @param {Number} userId
     * @param {Object} body - { maxPosts }
     */
    userFetchRemotePosts(userId, body) {
        return api.post(`/posts/remote-user/${userId}/fetch`, body);
    }
}
