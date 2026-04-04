/**
 * 事件配置系统
 * 定义事件类型的公开性，用于时间线等用途
 */

/**
 * 事件配置
 * @type {Object.<string, Object>}
 */
export const EventConfig = {
    post_create: { public: true },
    project_commit: { public: true },
    project_update: { public: true },
    project_fork: { public: true },
    project_create: { public: true },
    comment_create: { public: false },
    user_login: { public: false },
    user_register: { public: true },
    user_profile_update: { public: true },
    user_account_deleted: { public: false },
    project_rename: { public: true },
    project_info_update: { public: true },
    project_delete: { public: true },
    project_star: { public: true },
    project_like: { public: true },
    project_collect: { public: true },
    user_follow: { public: true },
    comment_reply: { public: true },
    comment_like: { public: true }
};

export default {
    EventConfig
};
