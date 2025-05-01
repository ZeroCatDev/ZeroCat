/**
 * @fileoverview 通知功能路由和处理逻辑
 * 统一的通知系统路由
 */
import express from 'express';
import { needLogin } from '../middleware/auth.js';
import logger from '../services/logger.js';
import notificationUtils from '../controllers/notifications.js';
import { prisma } from '../services/global.js';

const router = express.Router();

/**
 * @route GET /notifications
 * @desc 获取当前用户的通知
 * @access Private
 */
router.get('/', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const unreadOnly = req.query.unread_only === 'true';

    const result = await notificationUtils.getUserNotifications({
      userId,
      unreadOnly,
      limit,
      offset
    });

    // 格式化通知以符合客户端期望的格式
    const formattedNotifications = await Promise.all(result.notifications.map(notification =>
      notificationUtils.formatNotificationForClient(notification)
    ));

    res.json({
      notifications: formattedNotifications,
      total_rows_notifications: result.total,
      seen_notification_id: formattedNotifications.length > 0 ? formattedNotifications[0].id : null,
      load_more_notifications: result.total > limit + offset ?
        `/notifications?limit=${limit}&offset=${offset + limit}&username=${res.locals.username}` : null
    });
  } catch (error) {
    logger.error('获取通知出错:', error);
    res.status(500).json({ error: '获取通知失败' });
  }
});

/**
 * @route GET /notifications/unread-count
 * @desc 获取当前用户的未读通知数量
 * @access Private
 */
router.get('/unread-count', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const count = await notificationUtils.getUnreadNotificationCount(userId);

    res.json({ count });
  } catch (error) {
    logger.error('获取未读通知数量出错:', error);
    res.status(500).json({ error: '获取未读通知数量失败' });
  }
});

/**
 * @route POST /notifications/mark-read
 * @desc 将通知标记为已读
 * @access Private
 */
router.post('/mark-read', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({ error: '需要提供notification_ids数组' });
    }

    const count = await notificationUtils.markNotificationsAsRead({
      notificationIds: notification_ids,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('标记通知为已读出错:', error);
    res.status(500).json({ error: '标记通知为已读失败' });
  }
});

/**
 * @route PUT /notifications/read
 * @desc 将通知标记为已读 (兼容旧API)
 * @access Private
 */
router.put('/read', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({ error: '需要提供notification_ids数组' });
    }

    const count = await notificationUtils.markNotificationsAsRead({
      notificationIds: notification_ids,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('标记通知为已读出错:', error);
    res.status(500).json({ error: '标记通知为已读失败' });
  }
});

/**
 * @route PUT /notifications/read_all
 * @desc 将所有通知标记为已读
 * @access Private
 */
router.put('/read_all', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;

    // 获取所有未读通知ID
    const unreadResult = await notificationUtils.getUserNotifications({
      userId,
      unreadOnly: true,
      limit: 1000 // 合理的限制
    });

    if (unreadResult.notifications.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    // 提取通知ID
    const notificationIds = unreadResult.notifications.map(n => Number(n.id));

    // 全部标记为已读
    const count = await notificationUtils.markNotificationsAsRead({
      notificationIds,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('标记所有通知为已读出错:', error);
    res.status(500).json({ error: '标记所有通知为已读失败' });
  }
});

/**
 * @route DELETE /notifications
 * @desc 删除通知
 * @access Private
 */
router.delete('/', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({ error: '需要提供notification_ids数组' });
    }

    const count = await notificationUtils.deleteNotifications({
      notificationIds: notification_ids,
      userId
    });

    res.json({ success: true, count });
  } catch (error) {
    logger.error('删除通知出错:', error);
    res.status(500).json({ error: '删除通知失败' });
  }
});

/**
 * @route POST /notifications
 * @desc 创建通知
 * @access Private
 */
router.post('/', needLogin, async (req, res) => {
  try {
    const {
      object_type,
      object_id,
      notification_type,
      high_priority = false,
      acting_user = 0,
      data = {}
    } = req.body;

    // 确保必要字段存在
    if (!object_type || !object_id || !notification_type) {
      return res.status(400).json({
        status: "error",
        message: "缺少必要字段: object_type, object_id, notification_type"
      });
    }

    // 在数据库中创建通知
    const notification = await notificationUtils.createNotification({
      userId: res.locals.userid,
      notificationType: notification_type,
      targetType: object_type,
      targetId: object_id,
      highPriority: high_priority,
      actorId: acting_user,
      data
    });

    // 格式化通知
    const formattedNotification = await notificationUtils.formatNotificationForClient(notification);

    res.status(201).json({
      status: "success",
      data: formattedNotification
    });
  } catch (error) {
    logger.error('创建通知出错:', error);
    res.status(500).json({ error: '创建通知失败' });
  }
});

/**
 * @route GET /notifications/templates
 * @desc 获取可用的通知模板数据
 * @access Public
 */
router.get('/templates', async (req, res) => {
  try {
    // 获取所有通知模板
    const templates = notificationUtils.getNotificationTemplates();

    res.json({
      status: "success",
      templates: templates
    });
  } catch (error) {
    logger.error('获取通知模板出错:', error);
    res.status(500).json({ error: '获取通知模板失败' });
  }
});

/**
 * @route POST /notifications/test
 * @desc 发送测试通知
 * @access Private
 */
router.post('/test', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const actorId = res.locals.userid; // 以自己为行为者进行测试

    // 获取用户信息用于测试通知
    const user = await prisma.ow_users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        display_name: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户未找到' });
    }

    const results = [];

    // 创建项目评论通知
    const projectCommentNotification = await notificationUtils.createNotification({
      userId,
      notificationType: notificationUtils.NotificationTypes.PROJECT_COMMENT,
      actorId,
      targetType: notificationUtils.TargetTypes.PROJECT,
      targetId: 1,
      data: {
        project_title: '测试项目',
        comment_text: '这是对您项目的测试评论',
        comment_id: 123
      }
    });
    results.push(projectCommentNotification);

    // 创建星标通知
    const starNotification = await notificationUtils.createNotification({
      userId,
      notificationType: notificationUtils.NotificationTypes.PROJECT_STAR,
      actorId,
      targetType: notificationUtils.TargetTypes.PROJECT,
      targetId: 1,
      data: {
        project_title: '测试项目',
        star_count: 42
      }
    });
    results.push(starNotification);

    // 创建关注通知
    const followNotification = await notificationUtils.createNotification({
      userId,
      notificationType: notificationUtils.NotificationTypes.USER_FOLLOW,
      actorId,
      targetType: notificationUtils.TargetTypes.USER,
      targetId: userId,
      data: {
        follower_count: 100
      }
    });
    results.push(followNotification);

    // 返回按客户端格式创建的通知
    const formattedNotifications = await Promise.all(results.map(notification =>
      notificationUtils.formatNotificationForClient(notification)
    ));

    res.json({
      success: true,
      count: results.length,
      notifications: formattedNotifications
    });
  } catch (error) {
    logger.error('创建测试通知出错:', error);
    res.status(500).json({ error: '创建测试通知失败' });
  }
});

export default router;