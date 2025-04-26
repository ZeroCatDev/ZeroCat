import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

/**
 * Notification types definition
 * Each notification type maps to a specific kind of notification
 */
export const NotificationTypes = {
  // Project notifications
  PROJECT_COMMENT: 1,
  PROJECT_STAR: 2,
  PROJECT_FORK: 3,
  PROJECT_MENTION: 4,
  PROJECT_UPDATE: 5,
  PROJECT_COLLABORATION_INVITE: 6,
  PROJECT_COLLABORATION_ACCEPT: 7,

  // User notifications
  USER_FOLLOW: 20,
  USER_MENTION: 21,
  USER_LIKE: 25,

  // System notifications
  SYSTEM_ANNOUNCEMENT: 50,
  SYSTEM_MAINTENANCE: 51,

  // Comment notifications
  COMMENT_REPLY: 100,
  COMMENT_LIKE: 101,
  COMMENT_MENTION: 102,

  // Custom notifications (800+)
  CUSTOM_NOTIFICATION: 800,
  CUSTOM_TOPIC_REPLY: 801,
  CUSTOM_TOPIC_MENTION: 802
};

/**
 * Target types enum
 */
export const TargetTypes = {
  PROJECT: 'project',
  USER: 'user',
  COMMENT: 'comment',
  TOPIC: 'topic',
  POST: 'post',
  SYSTEM: 'system'
};

/**
 * Create a new notification
 *
 * @param {Object} notificationData - The notification data
 * @param {number} notificationData.userId - The user ID to send the notification to
 * @param {number} notificationData.notificationType - The notification type (from NotificationTypes)
 * @param {number} [notificationData.actorId] - The user ID who triggered the notification
 * @param {string} [notificationData.targetType] - The target type (from TargetTypes)
 * @param {number} [notificationData.targetId] - The target ID
 * @param {string} [notificationData.relatedType] - A related entity type
 * @param {number} [notificationData.relatedId] - A related entity ID
 * @param {Object} [notificationData.data] - Additional data for the notification
 * @param {boolean} [notificationData.highPriority] - Whether this is a high priority notification
 * @returns {Promise<Object>} The created notification
 */
export async function createNotification(notificationData) {
  try {
    const {
      userId,
      notificationType,
      actorId = null,
      targetType = null,
      targetId = null,
      relatedType = null,
      relatedId = null,
      data = {},
      highPriority = false
    } = notificationData;

    // Create notification in database
    const notification = await prisma.ow_notifications.create({
      data: {
        user_id: userId,
        notification_type: notificationType,
        actor_id: actorId,
        target_type: targetType,
        target_id: targetId,
        related_type: relatedType,
        related_id: relatedId,
        data: data,
        high_priority: highPriority
      }
    });

    logger.debug(`Created notification ID ${notification.id} for user ${userId}`);
    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user
 *
 * @param {Object} options - Query options
 * @param {number} options.userId - The user ID
 * @param {boolean} [options.unreadOnly] - Whether to get only unread notifications
 * @param {number} [options.limit] - Maximum number of notifications to return
 * @param {number} [options.offset] - Offset for pagination
 * @returns {Promise<Array>} Array of notifications
 */
export async function getUserNotifications(options) {
  const {
    userId,
    unreadOnly = false,
    limit = 20,
    offset = 0
  } = options;

  try {
    const notifications = await prisma.ow_notifications.findMany({
      where: {
        user_id: userId,
        ...(unreadOnly ? { read: false } : {})
      },
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count
    const totalCount = await prisma.ow_notifications.count({
      where: {
        user_id: userId,
        ...(unreadOnly ? { read: false } : {})
      }
    });

    return {
      notifications,
      total: totalCount,
      limit,
      offset
    };
  } catch (error) {
    logger.error('Error fetching user notifications:', error);
    throw error;
  }
}

/**
 * Mark notifications as read
 *
 * @param {Object} options - Options
 * @param {number[]} options.notificationIds - Array of notification IDs to mark
 * @param {number} options.userId - The user ID (for security verification)
 * @returns {Promise<number>} Number of notifications updated
 */
export async function markNotificationsAsRead(options) {
  const { notificationIds, userId } = options;

  try {
    const result = await prisma.ow_notifications.updateMany({
      where: {
        id: { in: notificationIds.map(id => BigInt(id)) },
        user_id: userId
      },
      data: {
        read: true,
        read_at: new Date()
      }
    });

    return result.count;
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    throw error;
  }
}

/**
 * Get total unread notification count for a user
 *
 * @param {number} userId - The user ID
 * @returns {Promise<number>} Total unread notifications
 */
export async function getUnreadNotificationCount(userId) {
  try {
    const count = await prisma.ow_notifications.count({
      where: {
        user_id: userId,
        read: false
      }
    });
    return count;
  } catch (error) {
    logger.error('Error getting unread notification count:', error);
    throw error;
  }
}

/**
 * Delete notifications
 *
 * @param {Object} options - Options
 * @param {number[]} options.notificationIds - Notification IDs to delete
 * @param {number} options.userId - User ID (for security verification)
 * @returns {Promise<number>} Number of notifications deleted
 */
export async function deleteNotifications(options) {
  const { notificationIds, userId } = options;

  try {
    const result = await prisma.ow_notifications.deleteMany({
      where: {
        id: { in: notificationIds.map(id => BigInt(id)) },
        user_id: userId
      }
    });
    return result.count;
  } catch (error) {
    logger.error('Error deleting notifications:', error);
    throw error;
  }
}

export default {
  createNotification,
  getUserNotifications,
  markNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotifications,
  NotificationTypes,
  TargetTypes
};