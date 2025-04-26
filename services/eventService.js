/**
 * @fileoverview Event service for handling events with schema validation
 */
import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import { EventConfig, TargetTypes } from "../models/events.js";

/**
 * Create a new event with schema validation
 *
 * @param {string} eventType - The type of event
 * @param {object} eventData - The event data that will be validated against the schema
 * @param {boolean} [forcePrivate=false] - Force the event to be private
 * @returns {Promise<object|null>} - The created event or null if validation fails
 */
export async function createEvent(eventType, eventData, forcePrivate = false) {
  try {
    const normalizedEventType = String(eventType).toLowerCase();
    const eventConfig = EventConfig[normalizedEventType];

    if (!eventConfig) {
      logger.warn(`Unknown event type: ${normalizedEventType}`);
      return null;
    }

    if (!eventConfig.logToDatabase) {
      return null;
    }

    // Validate event data against the schema
    const validationResult = eventConfig.schema.safeParse(eventData);

    if (!validationResult.success) {
      logger.warn(`Invalid event data for type ${normalizedEventType}:`, validationResult.error);
      return null;
    }

    // Extract the validated data
    const validatedData = validationResult.data;

    // Determine if the event should be public
    const isPublic = forcePrivate ? false : eventConfig.public;

    // Store the event in the database
    const event = await prisma.events.create({
      data: {
        event_type: normalizedEventType,
        actor_id: BigInt(validatedData.actor_id),
        target_type: validatedData.target_type,
        target_id: BigInt(validatedData.target_id),
        event_data: validatedData,
        public: isPublic ? 1 : 0
      },
    });

    logger.debug(`Event created: ${event.id}`);

    // Handle notifications for this event
    await handleEventNotifications(event, eventConfig, validatedData);

    return event;
  } catch (error) {
    logger.error('Error creating event:', error);
    throw error;
  }
}

/**
 * Get events for a specific target
 *
 * @param {string} targetType - The type of target
 * @param {number} targetId - The ID of the target
 * @param {number} [limit=10] - Max number of events to return
 * @param {number} [offset=0] - Offset for pagination
 * @param {boolean} [includePrivate=false] - Whether to include private events
 * @returns {Promise<Array>} - Array of events
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
    throw error;
  }
}

/**
 * Get events for a specific actor
 *
 * @param {number} actorId - The ID of the actor
 * @param {number} [limit=10] - Max number of events to return
 * @param {number} [offset=0] - Offset for pagination
 * @param {boolean} [includePrivate=false] - Whether to include private events
 * @returns {Promise<Array>} - Array of events
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
    throw error;
  }
}

/**
 * Handle event notifications based on configuration
 *
 * @param {object} event - The event object
 * @param {object} eventConfig - The event configuration
 * @param {object} eventData - The validated event data
 */
async function handleEventNotifications(event, eventConfig, eventData) {
  try {
    const notifyUsers = new Set();

    // Skip if the event has no notification targets
    if (!eventConfig.notifyTargets || eventConfig.notifyTargets.length === 0) {
      return;
    }

    for (const target of eventConfig.notifyTargets) {
      const users = await getNotificationTargets(target, event, eventData);
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
 *
 * @param {string} targetType - The type of notification target
 * @param {object} event - The event object
 * @param {object} eventData - The validated event data
 * @returns {Promise<Array<number>>} - Array of user IDs to notify
 */
async function getNotificationTargets(targetType, event, eventData) {
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
      return await getPageOwner(eventData.page_type, eventData.page_id);

    case 'thread_participants':
      return await getThreadParticipants(eventData.page_type, eventData.page_id);

    default:
      return [];
  }
}

/**
 * Create a notification for a user
 *
 * @param {number} eventId - The event ID
 * @param {number} userId - The user ID to notify
 * @returns {Promise<object>} - The created notification
 */
async function createNotification(eventId, userId) {
  try {
    return await prisma.notifications.create({
      data: {
        event_id: BigInt(eventId),
        user_id: BigInt(userId),
        is_read: false,
      },
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Enrich events with actor and target information
 *
 * @param {Array} events - Array of events to enrich
 * @returns {Promise<Array>} - Enriched events
 */
async function enrichEvents(events) {
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
        page: target
      }
    };
  }));
}

/**
 * Get actor information
 *
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
 * Get target information based on target type
 *
 * @param {string} targetType - The target type
 * @param {number} targetId - The target ID
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
 * Get project followers
 *
 * @param {number} projectId - The project ID
 * @returns {Promise<Array<number>>} - Array of user IDs following the project
 */
async function getProjectFollowers(projectId) {
  try {
    const followers = await prisma.user_relationships.findMany({
      where: {
        target_user_id: Number(projectId),
        relationship_type: 'follow'
      },
      select: {
        source_user_id: true
      }
    });

    return followers.map(f => f.source_user_id);
  } catch (error) {
    logger.error('Error getting project followers:', error);
    return [];
  }
}

/**
 * Get user followers
 *
 * @param {number} userId - The user ID
 * @returns {Promise<Array<number>>} - Array of user IDs following the user
 */
async function getUserFollowers(userId) {
  try {
    const followers = await prisma.user_relationships.findMany({
      where: {
        target_user_id: Number(userId),
        relationship_type: 'follow'
      },
      select: {
        source_user_id: true
      }
    });

    return followers.map(f => f.source_user_id);
  } catch (error) {
    logger.error('Error getting user followers:', error);
    return [];
  }
}

/**
 * Get the owner of a page
 *
 * @param {string} pageType - The page type
 * @param {number} pageId - The page ID
 * @returns {Promise<Array<number>>} - Array with the page owner ID
 */
async function getPageOwner(pageType, pageId) {
  try {
    switch (pageType) {
      case 'project':
        const project = await prisma.ow_projects.findUnique({
          where: { id: Number(pageId) },
          select: { authorid: true }
        });
        return project ? [project.authorid] : [];

      case 'user':
        return [Number(pageId)];

      default:
        return [];
    }
  } catch (error) {
    logger.error(`Error getting ${pageType} owner:`, error);
    return [];
  }
}

/**
 * Get participants in a comment thread
 *
 * @param {string} pageType - The page type
 * @param {number} pageId - The page ID
 * @returns {Promise<Array<number>>} - Array of user IDs participating in the thread
 */
async function getThreadParticipants(pageType, pageId) {
  try {
    const comments = await prisma.ow_comment.findMany({
      where: {
        page_type: pageType,
        page_id: Number(pageId)
      },
      select: {
        user_id: true
      }
    });

    // Get unique user IDs
    return [...new Set(comments.map(c => c.user_id).filter(id => id !== null))];
  } catch (error) {
    logger.error('Error getting thread participants:', error);
    return [];
  }
}