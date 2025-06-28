/**
 * @fileoverview 通知系统辅助函数和常量
 */
import { prisma } from "../services/global.js";
import logger from "../services/logger.js";
import NotificationTemplates from "../config/notificationTemplates.json" assert { type: "json" };



/**
 * 创建新通知
 * 基本的通知创建函数，直接将数据写入数据库
 *
 * @param {Object} notificationData - 通知数据
 * @param {number} notificationData.userId - 接收通知的用户ID
 * @param {string} notificationData.notificationType - 通知类型
 * @param {number} [notificationData.actorId] - 触发通知的用户ID
 * @param {string} [notificationData.targetType] - 目标类型
 * @param {number} [notificationData.targetId] - 目标ID
 * @param {Object} [notificationData.data] - 通知的附加数据
 * @param {boolean} [notificationData.highPriority] - 是否为高优先级通知
 * @returns {Promise<Object>} 创建的通知
 */
export async function createNotification(notificationData) {
  try {
    // 在数据库中创建通知 - 确保类型转换正确
    const notification = await prisma.ow_notifications.create({
      data: {
        user_id: notificationData.userId ? Number(notificationData.userId) : undefined,
        notification_type: notificationData.notificationType ? String(notificationData.notificationType) : undefined,
        actor_id: notificationData.actorId ? Number(notificationData.actorId) : null,
        target_type: notificationData.targetType ? String(notificationData.targetType) : null,
        target_id: notificationData.targetId ? Number(notificationData.targetId) : null,
        data: notificationData.data || {},
        high_priority: notificationData.highPriority || false,
        read: false,
      },
    });

    logger.debug(`创建通知 ID ${notification.id} 给用户 ${notificationData.userId}`);
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
      select: {
        id: true,
        notification_type: true,
        read: true,
        created_at: true,
        read_at: true,
        high_priority: true,
        data: true,
        actor_id: true,
        actor: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar: true,
          },
        },
        target_type: true,
        target_id: true,
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
    //logger.debug(notifications);
    // 只添加基本信息，不加载目标数据
    const formattedNotifications = notifications.map((notification) => ({
      id: Number(notification.id),
      type: notification.notification_type,
      read: notification.read,
      created_at: notification.created_at,
      read_at: notification.read_at,
      high_priority: notification.high_priority,
      data: notification.data || {},
      actor_id: notification.actor_id,
      actor: notification.actor,
      target_type: notification.target_type,
      target_id: notification.target_id,
    }));

    return {
      notifications: formattedNotifications,
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
        id: { in: notificationIds },
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
        id: { in: notificationIds.map((id) => Number(id)) },
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
 * 获取通知模板数据
 *
 * @returns {Object} 所有通知模板数据
 */
export function getNotificationTemplates() {
  return NotificationTemplates;
}

/**
 * 格式化通知以适应客户端期望的格式
 * 提供必要数据给前端进行渲染
 *
 * @param {Object} notification - 原始通知对象
 * @returns {Object} 格式化后的通知对象
 */
export async function formatNotificationForClient(notification) {
  // 基本通知信息
  const formattedNotification = {
    id: Number(notification.id),
    type: notification.type,
    read: notification.read,
    created_at: notification.created_at,
    read_at: notification.read_at,
    high_priority: notification.high_priority,
    data: notification.data || {},
    actor_id: notification.actor_id,
    actor: notification.actor,
    target_type: notification.target_type,
    target_id: notification.target_id,
  };

  // 获取模板信息
  const template = NotificationTemplates[notification.type] || {
    title: notification.type,
    icon: "notification",
    template: "未知类型通知",
    requiresActor: true,
  };

  formattedNotification.template_info = {
    title: template.title,
    icon: template.icon,
    template: template.template,
  };

  return formattedNotification;
}

export default {
  NotificationTemplates,
  createNotification,
  getUserNotifications,
  markNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotifications,
  formatNotificationForClient,
  getNotificationTemplates,
};
