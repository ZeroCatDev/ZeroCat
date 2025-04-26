import express from 'express';
import notificationController from '../controllers/notifications.js';
import { needLogin } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import notificationUtils from '../utils/notificationUtils.js';
import { prisma } from '../utils/global.js';

const router = express.Router();

/**
 * Get user notifications
 * GET /api/notifications
 * Query params:
 *   - unread_only: boolean (default: false)
 *   - limit: number (default: 20)
 *   - offset: number (default: 0)
 */
router.get('/', needLogin, async (req, res) => {
  try {
    const { unread_only, limit, offset } = req.query;
    const userId = res.locals.userid;

    const result = await notificationController.getUserNotifications({
      userId,
      unreadOnly: unread_only === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });

    // Format notifications according to the client-expected format
    const formattedNotifications = result.notifications.map(notification =>
      notificationUtils.formatNotificationForClient(notification)
    );

    res.json({
      notifications: formattedNotifications,
      total_rows_notifications: result.total,
      seen_notification_id: formattedNotifications.length > 0 ? formattedNotifications[0].id : null,
      load_more_notifications: result.total > (limit || 20) + (offset || 0) ?
        `/notifications?limit=${limit || 20}&offset=${(offset || 0) + (limit || 20)}&username=${res.locals.username}` : null
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Mark notifications as read
 * PUT /api/notifications/read
 * Body:
 *   - notification_ids: number[] (Required)
 */
router.put('/read', needLogin, async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const userId = res.locals.userid;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({ error: 'notification_ids array is required' });
    }

    const count = await notificationController.markNotificationsAsRead({
      notificationIds: notification_ids,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/read_all
 */
router.put('/read_all', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;

    // Get all unread notification IDs for the user
    const unreadResult = await notificationController.getUserNotifications({
      userId,
      unreadOnly: true,
      limit: 1000 // Reasonable limit
    });

    if (unreadResult.notifications.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    // Extract notification IDs
    const notificationIds = unreadResult.notifications.map(n => Number(n.id));

    // Mark all as read
    const count = await notificationController.markNotificationsAsRead({
      notificationIds,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * Get unread notification count
 * GET /api/notifications/count
 */
router.get('/count', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const count = await notificationController.getUnreadNotificationCount(userId);

    res.json({ count });
  } catch (error) {
    logger.error('Error getting notification count:', error);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

/**
 * Delete notifications
 * DELETE /api/notifications
 * Body:
 *   - notification_ids: number[] (Required)
 */
router.delete('/', needLogin, async (req, res) => {
  try {
    const { notification_ids } = req.body;
    const userId = res.locals.userid;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({ error: 'notification_ids array is required' });
    }

    const count = await notificationController.deleteNotifications({
      notificationIds: notification_ids,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error deleting notifications:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

/**
 * Send test notifications (one of each type) to the current user
 * POST /api/notifications/test
 */
router.post('/test', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const actorId = res.locals.userid; // Self as actor for test

    // Get user info for the test notifications
    const user = await prisma.ow_users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        display_name: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = [];
    const notifications = [];

    // Create a test project notification
    const projectNotification = await notificationUtils.createProjectNotificationData({
      notificationType: notificationController.NotificationTypes.PROJECT_COMMENT,
      userId,
      actorId,
      projectId: 1,
      projectTitle: 'Test Project',
      additionalData: {
        comment_text: 'This is a test comment on your project',
        comment_id: 123
      }
    });
    notifications.push(projectNotification);

    // Create a test star notification
    const starNotification = await notificationUtils.createProjectNotificationData({
      notificationType: notificationController.NotificationTypes.PROJECT_STAR,
      userId,
      actorId,
      projectId: 1,
      projectTitle: 'Test Project',
      additionalData: {
        star_count: 42
      }
    });
    notifications.push(starNotification);

    // Create a test fork notification
    const forkNotification = await notificationUtils.createProjectNotificationData({
      notificationType: notificationController.NotificationTypes.PROJECT_FORK,
      userId,
      actorId,
      projectId: 1,
      projectTitle: 'Test Project',
      additionalData: {
        fork_count: 5,
        fork_id: 2
      }
    });
    notifications.push(forkNotification);

    // Create a test user follow notification
    const followNotification = await notificationUtils.createUserNotificationData({
      notificationType: notificationController.NotificationTypes.USER_FOLLOW,
      userId,
      actorId,
      additionalData: {
        follower_count: 100
      }
    });
    notifications.push(followNotification);

    // Create a test comment like notification
    const commentLikeNotification = await notificationUtils.createCommentNotificationData({
      notificationType: notificationController.NotificationTypes.COMMENT_LIKE,
      userId,
      actorId,
      commentId: 123,
      commentText: 'This is a test comment that was liked',
      contextType: 'project',
      contextId: 1,
      additionalData: {}
    });
    notifications.push(commentLikeNotification);

    // Create a test system announcement
    const announcementNotification = {
      userId,
      notificationType: notificationController.NotificationTypes.SYSTEM_ANNOUNCEMENT,
      actorId: null,
      targetType: 'system',
      targetId: null,
      data: {
        announcement_id: 1,
        announcement_text: 'Test system announcement for all users'
      },
      highPriority: true
    };
    notifications.push(announcementNotification);

    // Create a test topic mention notification
    const topicMentionNotification = {
      userId,
      notificationType: notificationController.NotificationTypes.CUSTOM_TOPIC_MENTION,
      actorId,
      targetType: 'topic',
      targetId: 456,
      data: {
        topic_id: 456,
        post_number: 3,
        topic_title: 'Test Topic Title',
        mention_text: 'Hey @' + user.username + ', check this out!'
      },
      highPriority: true
    };
    notifications.push(topicMentionNotification);

    // Create a dynamic context notification
    const dynamicNotification = {
      userId,
      notificationType: notificationController.NotificationTypes.USER_MENTION,
      actorId,
      targetType: 'project',
      targetId: 1,
      data: {
        context_type: 'project',
        context_id: 1,
        mention_text: 'You were mentioned in a project description'
      },
      highPriority: true
    };
    notifications.push(dynamicNotification);

    // Create a custom URL notification
    const customUrlNotification = {
      userId,
      notificationType: notificationController.NotificationTypes.CUSTOM_NOTIFICATION,
      actorId: null,
      targetType: 'custom',
      targetId: null,
      data: {
        title: 'Custom Notification',
        body: 'This notification has a custom redirect URL',
        redirect_url: 'https://zerocat.org/special-page'
      },
      highPriority: false
    };
    notifications.push(customUrlNotification);

    // Create all notifications in the database
    for (const notification of notifications) {
      const result = await notificationController.createNotification(notification);
      results.push(result);
    }

    // Return the created notifications in client format
    const formattedNotifications = results.map(notification =>
      notificationUtils.formatNotificationForClient(notification)
    );

    res.json({
      success: true,
      count: results.length,
      notifications: formattedNotifications
    });
  } catch (error) {
    logger.error('Error creating test notifications:', error);
    res.status(500).json({ error: 'Failed to create test notifications' });
  }
});

export default router;