import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

// 定义事件配置类型
export const EventTypes = {
  'project_commit': {
    type: 'project_commit',
    logToDatabase: true,
    dbFields: ['commit_id'],
    public: true
  },
  'project_share': {
    type: 'project_share',
    logToDatabase: true,
    dbFields: ['share_platform'],
    public: true
  },
  'project_update': {
    type: 'project_update',
    logToDatabase: true,
    dbFields: ['update_type'],
    public: true
  },
  'project_fork': {
    type: 'project_fork',
    logToDatabase: true,
    dbFields: ['fork_id'],
    public: true
  },
  'project_create': {
    type: 'project_create',
    logToDatabase: true,
    dbFields: ['project_type'],
    public: true
  },
  'project_delete': {
    type: 'project_delete',
    logToDatabase: true,
    dbFields: [],
    public: false // 删除操作设为不公开
  },
  'comment_create': {
    type: 'comment_create',
    logToDatabase: true,
    dbFields: ['page_type', 'page_id', 'parent_id', 'reply_id', 'comment_text'],
    public: true
  },
  'user_profile_update': {
    type: 'user_profile_update',
    logToDatabase: true,
    dbFields: ['update_type'],
    public: true
  },
  'user_login': {
    type: 'user_login',
    logToDatabase: true,
    dbFields: [],
    public: false // 登录操作设为不公开
  }
};

// Target types enum
export const TargetTypes = {
  PROJECT: 'project',
  USER: 'user',
  COMMENT: 'comment'
};

/**
 * 从完整数据中提取需要存储到数据库的字段
 */
function extractDbFields(eventConfig, eventData) {
  const dbData = {};
  for (const field of eventConfig.dbFields) {
    if (eventData[field] !== undefined) {
      // 评论内容只存储前100个字符
      if (field === 'comment_text') {
        dbData[field] = eventData[field].substring(0, 100);
      } else {
        dbData[field] = eventData[field];
      }
    }
  }
  return dbData;
}

/**
 * 创建新事件
 * @param {string} eventType 事件类型
 * @param {number} actorId 操作者ID
 * @param {string} targetType 目标类型
 * @param {number} targetId 目标ID
 * @param {object} eventData 事件数据
 * @param {boolean} [forcePrivate] 强制设为不公开
 */
export async function createEvent(eventType, actorId, targetType, targetId, eventData, forcePrivate = false) {
  try {
    const normalizedEventType = String(eventType).toLowerCase();
    const eventConfig = EventTypes[normalizedEventType];
    
    if (!eventConfig) {
      logger.warn(`Unknown event type: ${normalizedEventType}`);
      return null;
    }

    if (!eventConfig.logToDatabase) {
      return null;
    }

    // 优先使用 forcePrivate 参数，其次检查项目状态
    const isPublic = forcePrivate ? false : eventConfig.public;

    const dbEventData = extractDbFields(eventConfig, eventData);
    
    const event = await prisma.events.create({
      data: {
        event_type: normalizedEventType,
        actor_id: BigInt(actorId),
        target_type: targetType,
        target_id: BigInt(targetId),
        event_data: dbEventData,
        public: isPublic ? 1 : 0
      },
    });
    
    logger.debug(`Event created: ${event.id}`);
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
/*
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
*/

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