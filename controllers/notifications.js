/**
 * @fileoverview 通知系统辅助函数和常量
 */
import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

/**
 * 通知类型定义
 * 每种通知类型映射到特定种类的通知
 * @enum {number}
 */
export const NotificationTypes = {
  // 项目通知
  PROJECT_COMMENT: 1,
  PROJECT_STAR: 2,
  PROJECT_FORK: 3,
  PROJECT_MENTION: 4,
  PROJECT_UPDATE: 5,
  PROJECT_COLLABORATION_INVITE: 6,
  PROJECT_COLLABORATION_ACCEPT: 7,
  PROJECT_LIKE: 8,
  PROJECT_COLLECT: 9,

  // 用户通知
  USER_FOLLOW: 20,
  USER_MENTION: 21,
  USER_LIKE: 25,
  USER_NEW_COMMENT: 26,

  // 系统通知
  SYSTEM_ANNOUNCEMENT: 50,
  SYSTEM_MAINTENANCE: 51,

  // 评论通知
  COMMENT_REPLY: 100,
  COMMENT_LIKE: 101,
  COMMENT_MENTION: 102,

  // 自定义通知 (800+)
  CUSTOM_NOTIFICATION: 800,
  CUSTOM_TOPIC_REPLY: 801,
  CUSTOM_TOPIC_MENTION: 802,
};

/**
 * 目标类型枚举
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
 * 获取行为者（用户）信息用于通知
 *
 * @param {number} actorId - 行为者用户ID
 * @returns {Promise<Object>} 行为者信息
 */
export async function getActorInfo(actorId) {
  try {
    const user = await prisma.ow_users.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar: true,
        images: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      acting_user_name: user.display_name,
      acting_user_avatar_template:
        user.avatar || `https://owcdn.190823.xyz/user/${user.images}`,
    };
  } catch (error) {
    logger.error("获取行为者信息出错:", error);
    return null;
  }
}

/**
 * 创建新通知
 *
 * @param {Object} notificationData - 通知数据
 * @param {number} notificationData.userId - 接收通知的用户ID
 * @param {number} notificationData.notificationType - 通知类型
 * @param {number} [notificationData.actorId] - 触发通知的用户ID
 * @param {string} [notificationData.targetType] - 目标类型
 * @param {number} [notificationData.targetId] - 目标ID
 * @param {Object} [notificationData.data] - 通知的附加数据
 * @param {boolean} [notificationData.highPriority] - 是否为高优先级通知
 * @returns {Promise<Object>} 创建的通知
 */
export async function createNotification(notificationData) {
  try {
    const {
      userId,
      notificationType,
      actorId = 0,
      targetType = null,
      targetId = null,
      data = {},
      highPriority = false,
    } = notificationData;

    // 在数据库中创建通知
    const notification = await prisma.ow_notifications.create({
      data: {
        user_id: userId,
        notification_type: notificationType,
        actor_id: actorId,
        target_type: targetType,
        target_id: targetId,
        data: data,
        high_priority: highPriority,
        read: false,
      },
    });

    logger.debug(`创建通知 ID ${notification.id} 给用户 ${userId}`);
    return notification;
  } catch (error) {
    logger.error("创建通知出错:", error);
    throw error;
  }
}

/**
 * 获取用户的通知
 *
 * @param {Object} options - 查询选项
 * @param {number} options.userId - 用户ID
 * @param {boolean} [options.unreadOnly] - 是否只获取未读通知
 * @param {number} [options.limit] - 返回的最大通知数量
 * @param {number} [options.offset] - 分页偏移量
 * @returns {Promise<Object>} 通知数组及分页信息
 */
export async function getUserNotifications(options) {
  const { userId, unreadOnly = false, limit = 20, offset = 0 } = options;

  try {
    const notifications = await prisma.ow_notifications.findMany({
      where: {
        user_id: userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: offset,
    });

    // 获取总数
    const totalCount = await prisma.ow_notifications.count({
      where: {
        user_id: userId,
        ...(unreadOnly ? { read: false } : {}),
      },
    });

    return {
      notifications,
      total: totalCount,
      limit,
      offset,
    };
  } catch (error) {
    logger.error("获取用户通知出错:", error);
    throw error;
  }
}

/**
 * 将通知标记为已读
 *
 * @param {Object} options - 选项
 * @param {number[]} options.notificationIds - 要标记的通知ID数组
 * @param {number} options.userId - 用户ID (用于安全验证)
 * @returns {Promise<number>} 更新的通知数量
 */
export async function markNotificationsAsRead(options) {
  const { notificationIds, userId } = options;

  try {
    if (!notificationIds || notificationIds.length === 0) {
      return 0;
    }

    const result = await prisma.ow_notifications.updateMany({
      where: {
        id: { in: notificationIds.map((id) => BigInt(id)) },
        user_id: userId,
      },
      data: {
        read: true,
        read_at: new Date(),
      },
    });

    return result.count;
  } catch (error) {
    logger.error("标记通知为已读出错:", error);
    throw error;
  }
}

/**
 * 获取用户未读通知数量
 *
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 未读通知总数
 */
export async function getUnreadNotificationCount(userId) {
  try {
    const count = await prisma.ow_notifications.count({
      where: {
        user_id: userId,
        read: false,
      },
    });
    return count;
  } catch (error) {
    logger.error("获取未读通知数量出错:", error);
    throw error;
  }
}

/**
 * 删除通知
 *
 * @param {Object} options - 选项
 * @param {number[]} options.notificationIds - 要删除的通知ID数组
 * @param {number} options.userId - 用户ID (用于安全验证)
 * @returns {Promise<number>} 删除的通知数量
 */
export async function deleteNotifications(options) {
  const { notificationIds, userId } = options;

  try {
    if (!notificationIds || notificationIds.length === 0) {
      return 0;
    }

    const result = await prisma.ow_notifications.deleteMany({
      where: {
        id: { in: notificationIds.map((id) => BigInt(id)) },
        user_id: userId,
      },
    });

    return result.count;
  } catch (error) {
    logger.error("删除通知出错:", error);
    throw error;
  }
}

/**
 * 格式化通知以适应客户端期望的格式
 *
 * @param {Object} notification - 原始通知对象
 * @returns {Object} 格式化后的通知对象
 */
export function formatNotificationForClient(notification) {
  // 基本通知信息
  const formattedNotification = {
    id: Number(notification.id),
    type: notification.notification_type,
    read: notification.read,
    created_at: notification.created_at,
    read_at: notification.read_at,
    high_priority: notification.high_priority,
    data: notification.data || {},
  };

  return formattedNotification;
}

/**
 * 创建用户通知数据
 *
 * @param {Object} options - 选项
 * @param {number} options.notificationType - 通知类型
 * @param {number} options.userId - 接收通知的用户ID
 * @param {number} options.actorId - 触发通知的用户ID
 * @param {Object} [options.additionalData] - 附加数据
 * @returns {Promise<Object>} 通知数据
 */
export function createUserNotificationData(options) {
  const { notificationType, userId, actorId, additionalData = {} } = options;

  // 基本通知数据
  const notificationData = {
    userId,
    notificationType,
    actorId,
    targetType: TargetTypes.USER,
    targetId: userId,
    data: additionalData,
  };

  return notificationData;
}

/**
 * 创建项目通知数据
 *
 * @param {Object} options - 选项
 * @param {number} options.notificationType - 通知类型
 * @param {number} options.userId - 接收通知的用户ID
 * @param {number} options.actorId - 触发通知的用户ID
 * @param {number} options.projectId - 项目ID
 * @param {string} [options.projectTitle] - 项目标题
 * @param {Object} [options.additionalData] - 附加数据
 * @returns {Promise<Object>} 通知数据
 */
export function createProjectNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId,
    projectId,
    projectTitle,
    additionalData = {},
  } = options;

  // 合并项目信息到附加数据
  const data = {
    ...additionalData,
  };

  if (projectTitle) {
    data.project_title = projectTitle;
  }

  // 基本通知数据
  const notificationData = {
    userId,
    notificationType,
    actorId,
    targetType: TargetTypes.PROJECT,
    targetId: projectId,
    data,
  };

  return notificationData;
}

/**
 * 创建评论通知数据
 *
 * @param {Object} options - 选项
 * @param {number} options.notificationType - 通知类型
 * @param {number} options.userId - 接收通知的用户ID
 * @param {number} options.actorId - 触发通知的用户ID
 * @param {number} options.commentId - 评论ID
 * @param {string} [options.commentText] - 评论内容
 * @param {string} [options.contextType] - 评论所在的上下文类型
 * @param {number} [options.contextId] - 评论所在的上下文ID
 * @param {Object} [options.additionalData] - 附加数据
 * @returns {Promise<Object>} 通知数据
 */
export function createCommentNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId,
    commentId,
    commentText,
    contextType,
    contextId,
    additionalData = {},
  } = options;

  // 合并评论信息到附加数据
  const data = {
    ...additionalData,
    comment_id: commentId,
  };

  if (commentText) {
    data.comment_text = commentText;
  }

  if (contextType) {
    data.context_type = contextType;
  }

  if (contextId) {
    data.context_id = contextId;
  }

  // 基本通知数据
  const notificationData = {
    userId,
    notificationType,
    actorId,
    targetType: TargetTypes.COMMENT,
    targetId: commentId,
    data,
  };

  return notificationData;
}

/**
 * SQL创建通知表的命令:
 *
 * CREATE TABLE IF NOT EXISTS ow_notifications (
 *   id BIGINT PRIMARY KEY AUTO_INCREMENT,
 *   user_id BIGINT NOT NULL,
 *   notification_type INT NOT NULL,
 *   target_type VARCHAR(50),
 *   target_id BIGINT,
 *   actor_id BIGINT DEFAULT 0,
 *   data JSON DEFAULT (JSON_OBJECT()),
 *   high_priority BOOLEAN DEFAULT FALSE,
 *   read BOOLEAN DEFAULT FALSE,
 *   read_at DATETIME,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   INDEX idx_user_read (user_id, read),
 *   INDEX idx_target (target_type, target_id),
 *   INDEX idx_created_at (created_at)
 * );
 */

export default {
  NotificationTypes,
  TargetTypes,
  createNotification,
  getUserNotifications,
  markNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotifications,
  formatNotificationForClient,
  createUserNotificationData,
  createProjectNotificationData,
  createCommentNotificationData,
  getActorInfo,
};
