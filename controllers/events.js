import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import { EventConfig, TargetTypes } from "../models/events.js";
import * as eventService from "../services/eventService.js";

// Re-export TargetTypes and EventConfig for use in other files
export { TargetTypes, EventConfig };

// Define a compatibility layer for old EventTypes structure
// This maps the old EventTypes constants to the new event type strings
// Required for backward compatibility with existing code
export const EventTypes = {
  // Map the old structure to the new one
  'project_commit': 'project_commit',
  'project_update': 'project_update',
  'project_fork': 'project_fork',
  'project_create': 'project_create',
  'project_publish': 'project_publish',
  'comment_create': 'comment_create',
  'user_profile_update': 'user_profile_update',
  'user_login': 'user_login',
  'user_register': 'user_register',
  'project_rename': 'project_rename',
  'project_info_update': 'project_info_update',

  // Common event constants as uppercase for use in code
  // This is for code using EventTypes.CONSTANT format
  PROJECT_CREATE: 'project_create',
  PROJECT_UPDATE: 'project_update',
  PROJECT_FORK: 'project_fork',
  PROJECT_PUBLISH: 'project_publish',
  PROJECT_DELETE: 'project_delete',
  PROJECT_RENAME: 'project_rename',
  USER_PROFILE_UPDATE: 'user_profile_update',
  USER_REGISTER: 'user_register',
  PROJECT_INFO_UPDATE: 'project_info_update',
  COMMENT_CREATE: 'comment_create',
  USER_LOGIN: 'user_login',

  // Add a mapping function to get event config
  getConfig(eventType) {
    const type = typeof eventType === 'string' ? eventType : String(eventType);
    return EventConfig[type.toLowerCase()];
  }
};

/**
 * Create a new event
 * @param {string} eventType - Type of event
 * @param {number} actorId - ID of the actor (user) performing the action
 * @param {string} targetType - Type of the target (project, user, etc.)
 * @param {number} targetId - ID of the target
 * @param {object} eventData - Data specific to the event
 * @param {boolean} [forcePrivate=false] - Force the event to be private
 */
export async function createEvent(eventType, actorId, targetType, targetId, eventData, forcePrivate = false) {
  try {
    // Handle case where eventType is from the old EventTypes object
    const normalizedEventType = (typeof eventType === 'string' && eventType.toLowerCase()) ||
                               (EventTypes[eventType] ? EventTypes[eventType].toLowerCase() : null);

    if (!normalizedEventType) {
      logger.warn(`Invalid event type: ${eventType}`);
      return null;
    }

    // Prepare the event data with actor and target information
    const fullEventData = {
      ...eventData,
      event_type: normalizedEventType,
      actor_id: actorId,
      target_type: targetType,
      target_id: targetId
    };

    // Use the service to create the event
    return await eventService.createEvent(normalizedEventType, fullEventData, forcePrivate);
  } catch (error) {
    logger.error('Error in createEvent controller:', error);
    throw error;
  }
}

/**
 * Get events for a specific target
 * @param {string} targetType - Type of the target
 * @param {number} targetId - ID of the target
 * @param {number} [limit=10] - Maximum number of events to return
 * @param {number} [offset=0] - Pagination offset
 * @param {boolean} [includePrivate=false] - Whether to include private events
 */
export async function getTargetEvents(targetType, targetId, limit = 10, offset = 0, includePrivate = false) {
  try {
    return await eventService.getTargetEvents(targetType, targetId, limit, offset, includePrivate);
  } catch (error) {
    logger.error('Error in getTargetEvents controller:', error);
    throw error;
  }
}

/**
 * Get events for a specific actor
 * @param {number} actorId - ID of the actor
 * @param {number} [limit=10] - Maximum number of events to return
 * @param {number} [offset=0] - Pagination offset
 * @param {boolean} [includePrivate=false] - Whether to include private events
 */
export async function getActorEvents(actorId, limit = 10, offset = 0, includePrivate = false) {
  try {
    return await eventService.getActorEvents(actorId, limit, offset, includePrivate);
  } catch (error) {
    logger.error('Error in getActorEvents controller:', error);
    throw error;
  }
}

/**
 * Get actor information
 * @param {number} actorId - The actor ID
 * @returns {Promise<object|null>} - Actor information
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
 * Get target information
 * @param {string} targetType - Type of the target
 * @param {number} targetId - ID of the target
 * @returns {Promise<object|null>} - Target information
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

// Event handler functions remain as they were, now they can be simplified to use the new service
async function handleProjectCommit(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling project commit', { actor, target, fullData });
  console.log("Hello World");
}

async function handleProjectShare(context) {
  // Implementation...
}

async function handleProjectUpdate(context) {
  // Implementation...
}

async function handleProjectFork(context) {
  // Implementation...
}

async function handleProjectCreate(context) {
  // Implementation...
}

async function handleProjectDelete(context) {
  // Implementation...
}

async function handleProjectVisibilityChange(context) {
  // Implementation...
}

async function handleProjectStar(context) {
  // Implementation...
}

async function handleProfileUpdate(context) {
  // Implementation...
}

async function handleUserLogin(context) {
  // Implementation...
}

async function handleUserProfileUpdate(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling profile update', { actor, target, fullData });
  // Implementation...
}

async function handleCommentCreate(context) {
  const { event, actor, target, fullData } = context;
  logger.debug('Handling comment create', { actor, target, fullData });
  // Implementation...
}

// Helper functions
async function getProjectFollowers(projectId) {
  return await eventService.getProjectFollowers(projectId);
}

async function getUserFollowers(userId) {
  return await eventService.getUserFollowers(userId);
}