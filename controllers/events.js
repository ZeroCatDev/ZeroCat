import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import eventConfigData from "../config/eventConfig.json" assert { type: "json" };

// Extract data from the config file
const { targetTypes: TargetTypes, eventConfig: EventConfig, eventTypes } = eventConfigData;

// Re-export TargetTypes and EventConfig for use in other files
export { TargetTypes, EventConfig };

// Compatibility layer for old code using EventTypes
export const EventTypes = {
  // Direct mapping for string event types
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
  'project_star': 'project_star',

  // Constants for code using EventTypes.CONSTANT
  ...eventTypes,

  // Helper to get event config
  getConfig(eventType) {
    const type = typeof eventType === 'string' ? eventType : String(eventType);
    return EventConfig[type.toLowerCase()];
  }
};

/**
 * Create an event and send notifications
 */
export async function createEvent(eventType, actorId, targetType, targetId, eventData = {}) {
  try {
    const normalizedEventType = eventType.toLowerCase();
    const eventConfig = EventConfig[normalizedEventType];

    if (!eventConfig) {
      logger.warn(`Unknown event type: ${eventType}`);
      return null;
    }

    // Create database record
    const event = await prisma.events.create({
      data: {
        event_type: normalizedEventType,
        actor_id: BigInt(actorId),
        target_type: targetType,
        target_id: BigInt(targetId),
        event_data: {
          ...eventData,
          actor_id: actorId,
          target_type: targetType,
          target_id: targetId
        },
        public: eventConfig.public ? 1 : 0
      }
    });

    // Process notifications if there are notification targets
    if (eventConfig.notifyTargets && eventConfig.notifyTargets.length > 0) {
      await processNotifications(event, eventConfig, eventData);
    }

    return event;
  } catch (error) {
    logger.error('Event creation error:', error);
    return null;
  }
}

/**
 * Get events for a specific target
 */
export async function getTargetEvents(targetType, targetId, limit = 10, offset = 0, includePrivate = false) {
  try {
    const events = await prisma.events.findMany({
      where: {
        target_type: targetType,
        target_id: BigInt(targetId),
        ...(includePrivate ? {} : { public: 1 }),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return await enrichEvents(events);
  } catch (error) {
    logger.error('Error getting target events:', error);
    return [];
  }
}

/**
 * Get events for a specific actor
 */
export async function getActorEvents(actorId, limit = 10, offset = 0, includePrivate = false) {
  try {
    const events = await prisma.events.findMany({
      where: {
        actor_id: BigInt(actorId),
        ...(includePrivate ? {} : { public: 1 }),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return await enrichEvents(events);
  } catch (error) {
    logger.error('Error getting actor events:', error);
    return [];
  }
}

/**
 * Enrich events with actor and target information
 */
async function enrichEvents(events) {
  try {
    return Promise.all(events.map(async (event) => {
      const [actor, target] = await Promise.all([
        getActor(event.actor_id),
        getTarget(event.target_type, event.target_id)
      ]);

      return {
        ...event,
        actor,
        target: {
          type: event.target_type,
          id: event.target_id,
          info: target
        }
      };
    }));
  } catch (error) {
    logger.error('Error enriching events:', error);
    return events;
  }
}

/**
 * Get actor information
 */
async function getActor(actorId) {
  try {
    return await prisma.ow_users.findUnique({
      where: { id: Number(actorId) },
      select: {
        id: true,
        username: true,
        display_name: true,
        type: true
      }
    });
  } catch (error) {
    logger.error(`Error getting actor ${actorId}:`, error);
    return null;
  }
}

/**
 * Get target information
 */
async function getTarget(targetType, targetId) {
  try {
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
  } catch (error) {
    logger.error(`Error getting target ${targetType}/${targetId}:`, error);
    return null;
  }
}

/**
 * Process notifications for an event
 */
async function processNotifications(event, eventConfig, eventData) {
  try {
    const userIds = new Set();

    // Get users to notify for each target type
    for (const target of eventConfig.notifyTargets) {
      const users = await getTargetUsers(target, event, eventData);
      users.forEach(id => userIds.add(id));
    }

    // Create notifications
    const notifications = [];
    for (const userId of userIds) {
      notifications.push(createNotification(event.id, userId));
    }

    await Promise.all(notifications);
  } catch (error) {
    logger.error('Notification processing error:', error);
  }
}

/**
 * Get users for a notification target type
 */
async function getTargetUsers(targetType, event, eventData) {
  try {
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

      case 'page_owner':
        if (eventData.page_type && eventData.page_id) {
          if (eventData.page_type === 'project') {
            const project = await prisma.ow_projects.findUnique({
              where: { id: Number(eventData.page_id) },
              select: { authorid: true }
            });
            return project ? [project.authorid] : [];
          } else if (eventData.page_type === 'user') {
            return [Number(eventData.page_id)];
          }
        }
        return [];

      case 'thread_participants':
        if (eventData.page_type && eventData.page_id) {
          const comments = await prisma.ow_comment.findMany({
            where: {
              page_type: eventData.page_type,
              page_id: Number(eventData.page_id)
            },
            select: { user_id: true }
          });
          return [...new Set(comments.map(c => c.user_id).filter(id => id !== null))];
        }
        return [];

      default:
        return [];
    }
  } catch (error) {
    logger.error(`Error getting users for ${targetType}:`, error);
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
        is_read: false
      }
    });
  } catch (error) {
    logger.error(`Notification creation error for user ${userId}:`, error);
  }
}

/**
 * Get project followers
 */
async function getProjectFollowers(projectId) {
  try {
    const followers = await prisma.user_relationships.findMany({
      where: {
        target_user_id: Number(projectId),
        relationship_type: 'follow'
      },
      select: { source_user_id: true }
    });
    return followers.map(f => f.source_user_id);
  } catch (error) {
    logger.error(`Error getting project followers:`, error);
    return [];
  }
}

/**
 * Get user followers
 */
async function getUserFollowers(userId) {
  try {
    const followers = await prisma.user_relationships.findMany({
      where: {
        target_user_id: Number(userId),
        relationship_type: 'follow'
      },
      select: { source_user_id: true }
    });
    return followers.map(f => f.source_user_id);
  } catch (error) {
    logger.error(`Error getting user followers:`, error);
    return [];
  }
}

/**
 * Get project followers - exported for external use
 */
export async function getProjectFollowersExternal(projectId) {
  return await getProjectFollowers(projectId);
}

/**
 * Get user followers - exported for external use
 */
export async function getUserFollowersExternal(userId) {
  return await getUserFollowers(userId);
}