/**
 * 事件配置系统
 * 定义事件类型、目标类型、受众类型及其关系
 */

/**
 * 受众获取所需的数据依赖
 * 指定每种受众类型需要获取的相关数据
 * @type {Object.<string, Object>}
 */
export const AudienceDataDependencies = {
    ["project_owner"]: {
        target: 'project', // 从事件目标获取数据
        fields: ['authorid']
    },
    ["project_collaborators"]: {
        query: 'project_collaborators', // 需要额外查询
        relationField: 'project_id',     // 关联字段
        userField: 'user_id'            // 用户ID字段
    },
    ["project_followers"]: {
        query: 'ow_user_relationships',
        relationField: 'target_user_id',
        userField: 'source_user_id',
        additionalFilters: {
            relationship_type: 'follow'
        }
    },
    ["project_stargazers"]: {
        query: 'project_stars',
        relationField: 'project_id',
        userField: 'user_id'
    },
    ["project_owner_followers"]: {
        query: 'ow_user_relationships',
        relationField: 'target_user_id',
        userField: 'source_user_id',
        additionalFilters: {
            relationship_type: 'follow'
        },
        dependsOn: {
            audienceType: "project_owner",
            field: 'id'
        }
    },
    ["user_followers"]: {
        query: 'ow_user_relationships',
        relationField: 'target_user_id',
        userField: 'source_user_id',
        additionalFilters: {
            relationship_type: 'follow'
        },
        sourceField: 'actor_id' // 使用行为者ID而不是目标ID
    },
    ["user_following"]: {
        query: 'ow_user_relationships',
        relationField: 'source_user_id',
        userField: 'target_user_id',
        additionalFilters: {
            relationship_type: 'follow'
        },
        sourceField: 'actor_id'
    },
    ["comment_author"]: {
        target: 'comment',
        fields: ['user_id']
    },
    ["thread_participants"]: {
        query: 'ow_comment',
        specialFilter: 'thread', // 特殊处理，需要从事件数据中获取thread信息
        userField: 'user_id'
    },
    ["mentioned_users"]: {
        eventData: 'mentioned_users' // 直接从事件数据中获取
    },
    ["system_admins"]: {
        query: 'ow_users',
        additionalFilters: {
            type: 'admin'
        },
        userField: 'id'
    },
    ["custom_users"]: {
        eventData: 'custom_users' // 直接从事件数据中获取
    },
    ["target_user"]: {
        eventData: 'target_user' // 直接从事件数据中获取
    }
};

/**
 * 事件配置
 * @type {Object.<string, Object>}
 */
export const EventConfig = {
    project_commit: {
        public: true,
        notifyTargets: ["project_owner", "project_followers", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_update: {
        public: true,
        notifyTargets: ["project_owner", "project_followers", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_fork: {
        public: true,
        notifyTargets: ["project_owner", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_create: {
        public: true,
        notifyTargets: ["user_followers"],
        notificationData: ['project_name']
    },
    project_publish: {
        public: true,
        notifyTargets: ["user_followers", "project_owner_followers"],
        notificationData: ['project_name']
    },
    comment_create: {
        public: false,
        notifyTargets: ["project_owner", "thread_participants", "mentioned_users"],
        notificationData: ['project_name', 'comment_text']
    },
    user_profile_update: {
        public: true,
        notifyTargets: ["user_followers"]
    },
    user_login: {
        public: false,
        notifyTargets: []
    },
    user_register: {
        public: true,
        notifyTargets: []
    },
    project_rename: {
        public: true,
        notifyTargets: ["project_followers", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_info_update: {
        public: true,
        notifyTargets: ["project_followers", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_star: {
        public: true,
        notifyTargets: ["project_owner", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_like: {
        public: true,
        notifyTargets: ["project_owner", "project_owner_followers"],
        notificationData: ['project_name']
    },
    project_collect: {
        public: true,
        notifyTargets: ["project_owner", "project_owner_followers"],
        notificationData: ['project_name']
    },
    user_follow: {
        public: true,
        notifyTargets: ["target_user"]
    },
    comment_reply: {
        public: true,
        notifyTargets: ["comment_author", "mentioned_users"],
        notificationData: ['comment_text']
    },
    comment_like: {
        public: true,
        notifyTargets: ["comment_author"],
        notificationData: ['comment_text']
    }
};

export default {
    EventConfig,
    AudienceDataDependencies
};