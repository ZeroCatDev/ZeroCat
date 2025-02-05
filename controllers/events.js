import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

// 定义事件配置类型
export const EventTypes = {
  'project_commit': {
    type: 'project_commit',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_owner', 'project_followers'],
    handler: handleProjectCommit,
    description: '项目提交更新',
    logToDatabase: true,
    dbFields: ['commit_id'],
    public: true,
    displayFormat: '更新了项目 {target.name} 的代码'
  },
  'project_share': {
    type: 'project_share',
    visibility: 'public',
    notification: true,
    notifyTargets: ['user_followers'],
    handler: handleProjectShare,
    description: '分享项目',
    logToDatabase: true,
    dbFields: ['share_platform'],
    public: true,
    displayFormat: '分享了项目 {target.name}'
  },
  'project_update': {
    type: 'project_update',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_followers'],
    handler: handleProjectUpdate,
    description: '更新项目信息',
    logToDatabase: true,
    dbFields: ['update_type'],
    public: true,
    displayFormat: '更新了项目 {target.name}'
  },
  'project_fork': {
    type: 'project_fork',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_owner'],
    handler: handleProjectFork,
    description: '复刻项目',
    logToDatabase: true,
    dbFields: ['fork_id'],
    public: true,
    displayFormat: '复刻了项目 {target.name}'
  },
  'project_create': {
    type: 'project_create',
    visibility: 'public',
    notification: true,
    notifyTargets: ['user_followers'],
    handler: handleProjectCreate,
    description: '创建新项目',
    logToDatabase: true,
    dbFields: ['project_type'],
    public: true,
    displayFormat: '创建了新项目 {target.name}'
  },
  'project_delete': {
    type: 'project_delete',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_followers'],
    handler: handleProjectDelete,
    description: '删除项目',
    logToDatabase: true,
    dbFields: [],
    public: true,
    displayFormat: '删除了项目 {target.name}'
  },
  PROJECT_VISIBILITY_CHANGE: {
    type: 'project_visibility_change',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_followers'],
    handler: handleProjectVisibilityChange,
    description: '修改项目可见性',
    logToDatabase: true,
    dbFields: ['old_visibility', 'new_visibility'],
    public: true,
    displayFormat: '修改了项目 {target.name} 的可见性'
  },
  PROJECT_STAR: {
    type: 'project_star',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_owner'],
    handler: handleProjectStar,
    description: '收藏项目',
    logToDatabase: true,
    dbFields: ['action'],
    public: true,
    displayFormat: '收藏了项目 {target.name}'
  },
  'user_profile_update': {
    type: 'user_profile_update',
    visibility: 'public',
    notification: true,
    notifyTargets: ['user_followers'],
    handler: handleUserProfileUpdate,
    description: '更新个人资料',
    logToDatabase: true,
    dbFields: ['update_type'],
    public: true,
    displayFormat: '更新了个人资料'
  },
  'user_login': {
    type: 'user_login',
    visibility: 'private',
    notification: false,
    notifyTargets: [],
    handler: handleUserLogin,
    description: '用户登录',
    logToDatabase: true,
    dbFields: [],
    public: false,
    displayFormat: '登录了系统'
  },
  'comment_create': {
    type: 'comment_create',
    visibility: 'public',
    notification: true,
    notifyTargets: ['project_owner', 'comment_parent_author'],
    handler: handleCommentCreate,
    description: '发表评论',
    logToDatabase: true,
    dbFields: ['page_type', 'page_id'],
    public: true,
    displayFormat: '发表了评论'
  }
};

// Target types enum
export const TargetTypes = {
  PROJECT: 'project',
  USER: 'user',
  COMMENT: 'comment',
};

/**
 * 从完整数据中提取需要存储到数据库的字段，并进行数据精简
 */
function extractDbFields(eventConfig, eventData) {
  const dbData = {};
  for (const field of eventConfig.dbFields) {
    if (eventData[field] !== undefined) {
      // 根据字段类型进行数据精简
      switch (field) {
        case 'comment_text':
          // 评论内容只存储前50个字符
          dbData[field] = eventData[field].substring(0, 50);
          break;
        case 'update_type':
          // 确保更新类型是预定义的值
          dbData[field] = validateUpdateType(eventData[field]);
          break;
        default:
          dbData[field] = eventData[field];
      }
    }
  }
  return dbData;
}

/**
 * 验证更新类型
 */
function validateUpdateType(type) {
  const validTypes = {
    project: ['info', 'file', 'setting', 'visibility'],
    user: ['basic', 'avatar', 'contact', 'password']
  };
  
  for (const category in validTypes) {
    if (validTypes[category].includes(type)) {
      return type;
    }
  }
  return 'other';
}

/**
 * Create a new event
 */
export async function createEvent(eventType, actorId, targetType, targetId, eventData) {
  try {
    const normalizedEventType = eventType.toLowerCase();
    const eventConfig = EventTypes[normalizedEventType];
    
    if (!eventConfig) {
      logger.warn(`Unknown event type: ${normalizedEventType}`, {
        available_types: Object.keys(EventTypes)
      });
      return null;
    }

    logger.debug(`Creating event: ${eventConfig.type}`, {
      eventType: eventConfig.type,
      actorId,
      targetType,
      targetId,
      eventData,
      public: eventConfig.public
    });

    let event = null;
    
    if (eventConfig.logToDatabase) {
      const dbEventData = extractDbFields(eventConfig, eventData);
      
      event = await prisma.events.create({
        data: {
          event_type: eventConfig.type,
          actor_id: BigInt(actorId),
          target_type: targetType,
          target_id: BigInt(targetId),
          event_data: dbEventData,
          public: eventConfig.public ? 1 : 0
        },
      });
      
      logger.debug(`Event created in database with ID: ${event.id}`, {
        stored_data: dbEventData,
        public: eventConfig.public
      });
    }
    
    // 处理器仍然接收完整数据
    const handlerContext = {
      event: event,
      config: eventConfig,
      actor: await getActor(actorId),
      target: await getTarget(targetType, targetId),
      fullData: eventData
    };
    
    await eventConfig.handler(handlerContext);
    
    if (eventConfig.notification) {
      await handleEventNotifications(event, eventConfig, handlerContext);
    }
    
    return event;
  } catch (error) {
    logger.error('Error creating event:', error);
    throw error;
  }
}

/**
 * 获取事件触发者信息
 */
async function getActor(actorId) {
  return await prisma.ow_users.findUnique({
    where: { id: Number(actorId) },
    select: {
      id: true,
      username: true,
      display_name: true,
      type: true
    }
  });
}

/**
 * 获取事件目标对象信息
 */
async function getTarget(targetType, targetId) {
  switch (targetType) {
    case TargetTypes.PROJECT:
      return await prisma.ow_projects.findUnique({
        where: { id: Number(targetId) }
      });
    case TargetTypes.USER:
      return await prisma.ow_users.findUnique({
        where: { id: Number(targetId) }
      });
    case TargetTypes.COMMENT:
      return await prisma.ow_comment.findUnique({
        where: { id: Number(targetId) }
      });
    default:
      return null;
  }
}

/**
 * Handle event notifications based on configuration
 */
async function handleEventNotifications(event, eventConfig, handlerContext) {
  try {
    const notifyUsers = new Set();
    
    for (const target of eventConfig.notifyTargets) {
      const users = await getNotificationTargets(target, event, handlerContext);
      users.forEach(userId => notifyUsers.add(userId));
    }
    
    // Create notifications for all unique users
    await Promise.all(
      Array.from(notifyUsers).map(userId => 
        createNotification(event.id, userId)
      )
    );
  } catch (error) {
    logger.error('Error handling event notifications:', error);
  }
}

/**
 * Get users to notify based on target type
 */
async function getNotificationTargets(targetType, event, handlerContext) {
  switch (targetType) {
    case 'project_owner':
      const project = await prisma.ow_projects.findUnique({
        where: { id: Number(event.target_id) }
      });
      return project ? [project.authorid] : [];
      
    case 'project_followers':
      return await getProjectFollowers(event.target_id);
      
    case 'user_followers':
      return await getUserFollowers(event.actor_id);
      
    default:
      return [];
  }
}

/**
 * Create a notification
 */
async function createNotification(eventId, userId) {
  try {
    return await prisma.notifications.create({
      data: {
        event_id: BigInt(eventId),
        user_id: BigInt(userId),
      },
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

// Event handlers with full context
async function handleProjectCommit(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling project commit', { actor, target, fullData });
  console.log("Hello World");
}

async function handleProjectShare(context) {
  // 实现分享逻辑
}

async function handleProjectUpdate(context) {
  // 实现更新逻辑
}

async function handleProjectFork(context) {
  // 实现复刻逻辑
}

async function handleProjectCreate(context) {
  // 实现创建逻辑
}

async function handleProjectDelete(context) {
  // 实现删除逻辑
}

async function handleProjectVisibilityChange(context) {
  // 实现可见性变更逻辑
}

async function handleProjectStar(context) {
  // 实现收藏逻辑
}

async function handleProfileUpdate(context) {
  // 实现个人资料更新逻辑
}

async function handleUserLogin(context) {
  // 实现用户登录逻辑
}

async function handleUserProfileUpdate(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling profile update', { actor, target, fullData });
  // 实现用户资料更新逻辑
}

async function handleCommentCreate(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling comment create', { actor, target, fullData });
  // 实现评论创建逻辑
}

// Helper functions
async function getProjectFollowers(projectId) {
  // 这里实现获取项目关注者的逻辑
  return [];
}

async function getUserFollowers(userId) {
  // 这里实现获取用户关注者的逻辑
  return [];
} 