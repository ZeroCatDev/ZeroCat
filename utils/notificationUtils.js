import logger from "./logger.js";
import { prisma } from "./global.js";
import { NotificationTypesById, getNotificationRedirectInfo, getNotificationRedirectUrl } from "../src/config/constants/notifications.js";

/**
 * Generate formatted data for notification creation
 *
 * @param {Object} options - Notification data options
 * @param {number} options.notificationType - Type ID from NotificationTypes
 * @param {number} options.userId - User receiving the notification
 * @param {number} options.actorId - User triggering the notification (optional)
 * @param {string} options.targetType - Type of target (project, user, etc.)
 * @param {number} options.targetId - ID of the target
 * @param {Object} options.data - Additional data specific to the notification type
 * @returns {Object} Formatted notification data
 */
export function formatNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId = null,
    targetType = null,
    targetId = null,
    data = {}
  } = options;

  // Retrieve notification type configuration
  const typeConfig = NotificationTypesById[notificationType];
  const highPriority = typeConfig?.priority === 'high';

  // Ensure data has the right redirect fields based on the notification type
  const enrichedData = { ...data };

  // For redirect URLs, make sure the data includes the needed fields
  if (typeConfig?.redirectType && typeConfig?.redirectIdField && !enrichedData[typeConfig.redirectIdField] && targetId) {
    // If matching the redirect type to target type, use target ID as redirect ID
    if (typeConfig.redirectType === targetType || targetType === null) {
      enrichedData[typeConfig.redirectIdField] = targetId;
    }
  }

  // Construct notification data
  return {
    userId,
    notificationType,
    actorId,
    targetType,
    targetId,
    data: enrichedData,
    highPriority
  };
}

/**
 * Format a raw notification from the database into the client format
 *
 * @param {Object} notification - Raw notification from database
 * @returns {Object} Client-formatted notification
 */
export function formatNotificationForClient(notification) {
  const data = notification.data || {};
  const typeConfig = NotificationTypesById[notification.notification_type] || {};

  // Generate redirect info for frontend routing
  const redirectInfo = getNotificationRedirectInfo(notification);

  // For backward compatibility
  const redirectUrl = getNotificationRedirectUrl(notification);

  return {
    id: Number(notification.id),
    user_id: notification.user_id,
    notification_type: notification.notification_type,
    read: notification.read,
    high_priority: notification.high_priority,
    created_at: notification.created_at.toISOString(),

    // Target information
    target_type: notification.target_type,
    target_id: notification.target_id,

    // Optional fields based on notification.data
    post_number: data.post_number,
    topic_id: data.topic_id,
    fancy_title: data.topic_title || data.project_title || "",
    slug: data.slug || targetTypeToSlug(notification.target_type),

    // Navigation data - new format and legacy format for backward compatibility
    redirect_info: redirectInfo,
    redirect_url: redirectUrl,

    // Original data
    data,

    // Actor information
    actor_id: notification.actor_id,
    acting_user_avatar_template: data.acting_user_avatar_template,
    acting_user_name: data.acting_user_name
  };
}

/**
 * Convert target type to a URL slug
 */
function targetTypeToSlug(targetType) {
  switch (targetType) {
    case 'project': return 'project';
    case 'user': return 'user';
    case 'comment': return 'comment';
    case 'topic': return 'topic';
    case 'collection': return 'collection';
    default: return 'topic';
  }
}

/**
 * Get actor (user) information for a notification
 *
 * @param {number} actorId - User ID of the actor
 * @returns {Promise<Object>} Actor information
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
        images: true
      }
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      acting_user_name: user.display_name,
      acting_user_avatar_template: user.avatar || `https://owcdn.190823.xyz/user/${user.images}`
    };
  } catch (error) {
    logger.error('Error getting actor info:', error);
    return null;
  }
}

/**
 * Create project-related notification data
 *
 * @param {Object} options - Options for project notification
 * @param {number} options.notificationType - Notification type ID
 * @param {number} options.userId - User to notify
 * @param {number} options.actorId - User who triggered the notification
 * @param {number} options.projectId - Project ID
 * @param {string} options.projectTitle - Project title
 * @param {Object} options.additionalData - Any additional data for the notification
 * @returns {Object} Formatted notification data
 */
export async function createProjectNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId,
    projectId,
    projectTitle,
    additionalData = {}
  } = options;

  // Get actor info
  const actorInfo = await getActorInfo(actorId);

  // Base data for project notifications
  const baseData = {
    project_id: projectId,
    project_title: projectTitle,
    ...(actorInfo ? {
      acting_user_name: actorInfo.display_name,
      acting_user_avatar_template: actorInfo.acting_user_avatar_template
    } : {})
  };

  // Combine with additional data
  const data = { ...baseData, ...additionalData };

  // Create and return notification data
  return formatNotificationData({
    notificationType,
    userId,
    actorId,
    targetType: 'project',
    targetId: projectId,
    data
  });
}

/**
 * Create user-related notification data
 *
 * @param {Object} options - Options for user notification
 * @param {number} options.notificationType - Notification type ID
 * @param {number} options.userId - User to notify
 * @param {number} options.actorId - User who triggered the notification
 * @param {Object} options.additionalData - Any additional data for the notification
 * @returns {Object} Formatted notification data
 */
export async function createUserNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId,
    additionalData = {}
  } = options;

  // Get actor info
  const actorInfo = await getActorInfo(actorId);

  // Base data for user notifications
  const baseData = {
    ...(actorInfo ? {
      acting_user_name: actorInfo.display_name,
      acting_user_avatar_template: actorInfo.acting_user_avatar_template
    } : {})
  };

  // Combine with additional data
  const data = { ...baseData, ...additionalData };

  // Create and return notification data
  return formatNotificationData({
    notificationType,
    userId,
    actorId,
    targetType: 'user',
    targetId: userId,
    data
  });
}

/**
 * Create comment-related notification data
 *
 * @param {Object} options - Options for comment notification
 * @param {number} options.notificationType - Notification type ID
 * @param {number} options.userId - User to notify
 * @param {number} options.actorId - User who triggered the notification
 * @param {number} options.commentId - Comment ID
 * @param {string} options.commentText - Comment text (truncated for preview)
 * @param {string} options.contextType - Type of context (project, post, etc)
 * @param {number} options.contextId - ID of the context
 * @param {Object} options.additionalData - Any additional data for the notification
 * @returns {Object} Formatted notification data
 */
export async function createCommentNotificationData(options) {
  const {
    notificationType,
    userId,
    actorId,
    commentId,
    commentText,
    contextType,
    contextId,
    additionalData = {}
  } = options;

  // Get actor info
  const actorInfo = await getActorInfo(actorId);

  // Base data for comment notifications
  const baseData = {
    comment_id: commentId,
    comment_text: commentText && commentText.length > 100 ? `${commentText.substring(0, 100)}...` : commentText,
    context_type: contextType,
    context_id: contextId,
    ...(actorInfo ? {
      acting_user_name: actorInfo.display_name,
      acting_user_avatar_template: actorInfo.acting_user_avatar_template
    } : {})
  };

  // Combine with additional data
  const data = { ...baseData, ...additionalData };

  // Create and return notification data
  return formatNotificationData({
    notificationType,
    userId,
    actorId,
    targetType: 'comment',
    targetId: commentId,
    data
  });
}

export default {
  formatNotificationData,
  formatNotificationForClient,
  getActorInfo,
  createProjectNotificationData,
  createUserNotificationData,
  createCommentNotificationData
};