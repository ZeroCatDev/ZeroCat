/**
 * 事件配置系统
 * 定义事件类型、目标类型、受众类型及其关系
 */

import { NotificationTypes } from "../controllers/notifications.js";

/**
 * 目标类型定义
 * @enum {string}
 */
export const TargetTypes = {
  PROJECT: "project",
  USER: "user",
  COMMENT: "comment",
  TOPIC: "topic",
  POST: "post",
  SYSTEM: "system",
  PROJECTLIST: "projectlist",
};

/**
 * 事件类型定义
 * @enum {string}
 */
export const EventTypes = {
  PROJECT_CREATE: "project_create",
  PROJECT_UPDATE: "project_update",
  PROJECT_FORK: "project_fork",
  PROJECT_PUBLISH: "project_publish",
  PROJECT_DELETE: "project_delete",
  PROJECT_RENAME: "project_rename",
  PROJECT_INFO_UPDATE: "project_info_update",
  PROJECT_STAR: "project_star",
  PROJECT_COMMIT: "project_commit",
  PROJECT_LIKE: "project_like",
  PROJECT_COLLECT: "project_collect",
  COMMENT_CREATE: "comment_create",
  COMMENT_REPLY: "comment_reply",
  COMMENT_LIKE: "comment_like",
  USER_PROFILE_UPDATE: "user_profile_update",
  USER_LOGIN: "user_login",
  USER_REGISTER: "user_register",
  USER_FOLLOW: "user_follow",
};

/**
 * 受众群体定义
 * @enum {string}
 */
export const AudienceTypes = {
  PROJECT_OWNER: "project_owner",
  PROJECT_COLLABORATORS: "project_collaborators",
  PROJECT_FOLLOWERS: "project_followers",
  PROJECT_STARGAZERS: "project_stargazers",
  PROJECT_OWNER_FOLLOWERS: "project_owner_followers", // 项目所有者的粉丝
  USER_FOLLOWERS: "user_followers",
  USER_FOLLOWING: "user_following",
  COMMENT_AUTHOR: "comment_author",
  THREAD_PARTICIPANTS: "thread_participants",
  MENTIONED_USERS: "mentioned_users",
  SYSTEM_ADMINS: "system_admins",
  CUSTOM_USERS: "custom_users",
};

/**
 * 事件与通知类型的映射
 * @type {Object.<string, string>}
 */
export const EventToNotificationMap = {
  'project_commit': NotificationTypes.PROJECT_UPDATE,
  'project_update': NotificationTypes.PROJECT_UPDATE,
  'project_fork': NotificationTypes.PROJECT_FORK,
  'project_create': null, // 不发送通知
  'project_publish': NotificationTypes.PROJECT_UPDATE,
  'comment_create': NotificationTypes.PROJECT_COMMENT,
  'project_star': NotificationTypes.PROJECT_STAR,
  'project_like': NotificationTypes.PROJECT_LIKE,
  'project_collect': NotificationTypes.PROJECT_COLLECT,
  'user_follow': NotificationTypes.USER_FOLLOW,
  'comment_reply': NotificationTypes.COMMENT_REPLY,
  'comment_like': NotificationTypes.COMMENT_LIKE,
};

/**
 * 受众获取所需的数据依赖
 * 指定每种受众类型需要获取的相关数据
 * @type {Object.<string, Object>}
 */
export const AudienceDataDependencies = {
  [AudienceTypes.PROJECT_OWNER]: {
    target: 'project', // 从事件目标获取数据
    fields: ['authorid']
  },
  [AudienceTypes.PROJECT_COLLABORATORS]: {
    query: 'project_collaborators', // 需要额外查询
    relationField: 'project_id',     // 关联字段
    userField: 'user_id'            // 用户ID字段
  },
  [AudienceTypes.PROJECT_FOLLOWERS]: {
    query: 'user_relationships',
    relationField: 'target_user_id',
    userField: 'source_user_id',
    additionalFilters: {
      relationship_type: 'follow'
    }
  },
  [AudienceTypes.PROJECT_STARGAZERS]: {
    query: 'project_stars',
    relationField: 'project_id',
    userField: 'user_id'
  },
  [AudienceTypes.PROJECT_OWNER_FOLLOWERS]: {
    query: 'user_relationships',
    relationField: 'target_user_id',
    userField: 'source_user_id',
    additionalFilters: {
      relationship_type: 'follow'
    },
    dependsOn: {
      audienceType: AudienceTypes.PROJECT_OWNER,
      field: 'id'
    }
  },
  [AudienceTypes.USER_FOLLOWERS]: {
    query: 'user_relationships',
    relationField: 'target_user_id',
    userField: 'source_user_id',
    additionalFilters: {
      relationship_type: 'follow'
    },
    sourceField: 'actor_id' // 使用行为者ID而不是目标ID
  },
  [AudienceTypes.USER_FOLLOWING]: {
    query: 'user_relationships',
    relationField: 'source_user_id',
    userField: 'target_user_id',
    additionalFilters: {
      relationship_type: 'follow'
    },
    sourceField: 'actor_id'
  },
  [AudienceTypes.COMMENT_AUTHOR]: {
    target: 'comment',
    fields: ['user_id']
  },
  [AudienceTypes.THREAD_PARTICIPANTS]: {
    query: 'ow_comment',
    specialFilter: 'thread', // 特殊处理，需要从事件数据中获取thread信息
    userField: 'user_id'
  },
  [AudienceTypes.MENTIONED_USERS]: {
    eventData: 'mentioned_users' // 直接从事件数据中获取
  },
  [AudienceTypes.SYSTEM_ADMINS]: {
    query: 'ow_users',
    additionalFilters: {
      type: 'admin'
    },
    userField: 'id'
  },
  [AudienceTypes.CUSTOM_USERS]: {
    eventData: 'custom_users' // 直接从事件数据中获取
  }
};

/**
 * 事件配置
 * @type {Object.<string, Object>}
 */
export const EventConfig = {
  project_commit: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_FOLLOWERS, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_update: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_FOLLOWERS, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_fork: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_create: {
    public: true,
    notifyTargets: [AudienceTypes.USER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_publish: {
    public: true,
    notifyTargets: [AudienceTypes.USER_FOLLOWERS, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  comment_create: {
    public: false,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.THREAD_PARTICIPANTS, AudienceTypes.MENTIONED_USERS],
    notificationData: ['project_title', 'comment_text']
  },
  user_profile_update: {
    public: true,
    notifyTargets: [AudienceTypes.USER_FOLLOWERS]
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
    notifyTargets: [AudienceTypes.PROJECT_FOLLOWERS, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_info_update: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_FOLLOWERS, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_star: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_like: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  project_collect: {
    public: true,
    notifyTargets: [AudienceTypes.PROJECT_OWNER, AudienceTypes.PROJECT_OWNER_FOLLOWERS],
    notificationData: ['project_title']
  },
  user_follow: {
    public: true,
    notifyTargets: [AudienceTypes.USER_FOLLOWERS]
  },
  comment_reply: {
    public: true,
    notifyTargets: [AudienceTypes.COMMENT_AUTHOR, AudienceTypes.MENTIONED_USERS],
    notificationData: ['comment_text']
  },
  comment_like: {
    public: true,
    notifyTargets: [AudienceTypes.COMMENT_AUTHOR],
    notificationData: ['comment_text']
  }
};

export default {
  TargetTypes,
  EventTypes,
  AudienceTypes,
  EventConfig,
  AudienceDataDependencies,
  EventToNotificationMap
};