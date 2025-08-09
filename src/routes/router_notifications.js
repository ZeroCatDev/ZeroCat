/**
 * @fileoverview 通知功能路由和处理逻辑
 * 统一的通知系统路由
 */
import express from "express";
import {needLogin} from "../middleware/auth.js";
import logger from "../services/logger.js";
import notificationUtils from "../controllers/notifications.js";
import {prisma} from "../services/global.js";
import { registerPushSubscription, unregisterPushSubscription, getUserPushSubscriptions } from "../services/pushNotification.js";

const router = express.Router();

/**
 * @route GET /notifications
 * @desc 获取当前用户的通知
 * @access Private
 */
router.get("/", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const unreadOnly = req.query.unread_only === "true";

        const result = await notificationUtils.getUserNotifications({
            userId,
            unreadOnly,
            limit,
            offset,
        });

        // 格式化通知以符合客户端期望的格式
        const formattedNotifications = await Promise.all(
            result.notifications.map((notification) =>
                notificationUtils.formatNotificationForClient(notification)
            )
        );

        res.json({
            notifications: formattedNotifications,
            total_rows_notifications: result.total,
            seen_notification_id:
                formattedNotifications.length > 0 ? formattedNotifications[0].id : null,
            load_more_notifications:
                result.total > limit + offset
                    ? `/notifications?limit=${limit}&offset=${offset + limit}&username=${
                        res.locals.username
                    }`
                    : null,
        });
    } catch (error) {
        logger.error("获取通知出错:", error);
        res.status(500).json({error: "获取通知失败"});
    }
});

/**
 * @route GET /notifications/unread-count
 * @desc 获取当前用户的未读通知数量
 * @access Private
 */
router.get("/unread-count", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const count = await notificationUtils.getUnreadNotificationCount(userId);

        res.json({count});
    } catch (error) {
        logger.error("获取未读通知数量出错:", error);
        res.status(500).json({error: "获取未读通知数量失败"});
    }
});

/**
 * @route POST /notifications/mark-read
 * @desc 将通知标记为已读
 * @access Private
 */
router.post("/mark-read", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const {notification_ids} = req.body;

        if (!notification_ids || !Array.isArray(notification_ids)) {
            return res.status(400).json({error: "需要提供notification_ids数组"});
        }

        const count = await notificationUtils.markNotificationsAsRead({
            notificationIds: notification_ids,
            userId,
        });

        res.json({success: true, count});
    } catch (error) {
        logger.error("标记通知为已读出错:", error);
        res.status(500).json({error: "标记通知为已读失败"});
    }
});

/**
 * @route PUT /notifications/read
 * @desc 将通知标记为已读 (兼容旧API)
 * @access Private
 */
router.put("/read", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const {notification_ids} = req.body;

        if (!notification_ids || !Array.isArray(notification_ids)) {
            return res.status(400).json({error: "需要提供notification_ids数组"});
        }

        const count = await notificationUtils.markNotificationsAsRead({
            notificationIds: notification_ids,
            userId,
        });

        res.json({success: true, count});
    } catch (error) {
        logger.error("标记通知为已读出错:", error);
        res.status(500).json({error: "标记通知为已读失败"});
    }
});

/**
 * @route PUT /notifications/read_all
 * @desc 将所有通知标记为已读
 * @access Private
 */
router.put("/read_all", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;

        // 获取所有未读通知ID
        const unreadResult = await notificationUtils.getUserNotifications({
            userId,
            unreadOnly: true,
            limit: 1000, // 合理的限制
        });

        if (unreadResult.notifications.length === 0) {
            return res.json({success: true, count: 0});
        }

        // 提取通知ID
        const notificationIds = unreadResult.notifications.map((n) => Number(n.id));

        // 全部标记为已读
        const count = await notificationUtils.markNotificationsAsRead({
            notificationIds,
            userId,
        });

        res.json({success: true, count});
    } catch (error) {
        logger.error("标记所有通知为已读出错:", error);
        res.status(500).json({error: "标记所有通知为已读失败"});
    }
});

/**
 * @route POST /notifications/send-enhanced
 * @desc 发送增强通知（支持隐藏通知和多渠道推送）
 * @access Private
 */
router.post("/send-enhanced", needLogin, async (req, res) => {
    try {
        const {
            user_id,
            title,
            content,
            link,
            push_channels = ['browser'],
            hidden = false,
            actor_id,
            target_type,
            target_id,
            metadata = {}
        } = req.body;

        // 验证必要字段
        if (!user_id || !title || !content) {
            return res.status(400).json({
                error: "缺少必要字段: user_id, title, content"
            });
        }

        // 验证推送渠道
        const validChannels = ['browser', 'push', 'email'];
        const invalidChannels = push_channels.filter(channel => !validChannels.includes(channel));
        if (invalidChannels.length > 0) {
            return res.status(400).json({
                error: `无效的推送渠道: ${invalidChannels.join(', ')}`,
                valid_channels: validChannels
            });
        }

        // 发送增强通知
        const result = await notificationUtils.sendEnhancedNotification({
            userId: user_id,
            title,
            content,
            link,
            pushChannels: push_channels,
            hidden,
            actorId: actor_id || res.locals.userid,
            targetType: target_type,
            targetId: target_id,
            metadata
        });

        res.json({
            success: true,
            result,
            message: hidden ? "隐藏通知发送成功" : "通知发送成功"
        });
    } catch (error) {
        logger.error("发送增强通知出错:", error);
        res.status(500).json({error: "发送增强通知失败"});
    }
});

/**
 * @route POST /notifications/send
 * @desc 发送通知（支持多种渠道）
 * @access Private
 */
router.post("/send", needLogin, async (req, res) => {
    try {
        const {
            user_id,
            title,
            content,
            link,
            channel = 'browser',
            actor_id,
            target_type,
            target_id,
            metadata = {}
        } = req.body;

        // 验证必要字段
        if (!user_id || !title || !content) {
            return res.status(400).json({
                error: "缺少必要字段: user_id, title, content"
            });
        }

        // 发送通知
        const result = await notificationUtils.sendNotification({
            userId: user_id,
            title,
            content,
            link,
            channel,
            actorId: actor_id || res.locals.userid,
            targetType: target_type,
            targetId: target_id,
            metadata
        });

        res.json({
            success: true,
            result
        });
    } catch (error) {
        logger.error("发送通知出错:", error);
        res.status(500).json({error: "发送通知失败"});
    }
});

/**
 * @route POST /notifications/register-browser
 * @desc 注册浏览器推送通知
 * @access Private
 */
router.post("/register-browser", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const { subscription, device_info } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                error: "缺少推送订阅信息",
                required: {
                    subscription: {
                        endpoint: "string",
                        keys: {
                            p256dh: "string",
                            auth: "string"
                        }
                    }
                }
            });
        }

        const userAgent = req.get('User-Agent') || '';
        const result = await registerPushSubscription(userId, subscription, device_info, userAgent);

        if (result.success) {
            res.json({
                success: true,
                message: result.isNew ? "浏览器推送通知注册成功" : "浏览器推送通知更新成功",
                subscription_id: result.subscription.id,
                is_new: result.isNew
            });
        } else {
            res.status(500).json({
                error: "注册浏览器推送通知失败",
                details: result.error
            });
        }
    } catch (error) {
        logger.error("注册浏览器推送通知出错:", error);
        res.status(500).json({error: "注册浏览器推送通知失败"});
    }
});

/**
 * @route DELETE /notifications/register-browser
 * @desc 取消浏览器推送通知
 * @access Private
 */
router.delete("/register-browser", async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({error: "缺少推送端点信息"});
        }

        const result = await unregisterPushSubscription(endpoint);

        if (result.success) {
            res.json({
                success: true,
                message: "浏览器推送通知取消成功",
                count: result.count
            });
        } else {
            res.status(500).json({
                error: "取消浏览器推送通知失败",
                details: result.error
            });
        }
    } catch (error) {
        logger.error("取消浏览器推送通知出错:", error);
        res.status(500).json({error: "取消浏览器推送通知失败"});
    }
});

/**
 * @route GET /notifications/push-subscriptions
 * @desc 获取用户的推送订阅列表
 * @access Private
 */
router.get("/push-subscriptions", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const subscriptions = await getUserPushSubscriptions(userId);

        res.json({
            success: true,
            subscriptions: subscriptions
        });
    } catch (error) {
        logger.error("获取推送订阅列表出错:", error);
        res.status(500).json({error: "获取推送订阅列表失败"});
    }
});

/**
 * @route GET /notifications/templates
 * @desc 获取可用的通知模板数据
 * @access Public
 */
router.get("/templates", async (req, res) => {
    try {
        // 获取所有通知模板
        const templates = notificationUtils.getNotificationTemplates();

        res.json({
            status: "success",
            templates: templates,
        });
    } catch (error) {
        logger.error("获取通知模板出错:", error);
        res.status(500).json({error: "获取通知模板失败"});
    }
});

/**
 * @route GET /notifications/push-status/:id
 * @desc 获取通知的推送状态
 * @access Private
 */
router.get("/push-status/:id", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const notificationId = parseInt(req.params.id, 10);

        if (isNaN(notificationId)) {
            return res.status(400).json({error: "无效的通知ID"});
        }

        const notification = await prisma.ow_notifications.findFirst({
            where: {
                id: notificationId,
                user_id: userId, // 确保用户只能访问自己的通知
            },
            select: {
                id: true,
                push_channels: true,
                push_results: true,
                push_error: true,
                created_at: true,
            },
        });

        if (!notification) {
            return res.status(404).json({error: "通知不存在"});
        }

        res.json({
            success: true,
            notification_id: notification.id,
            push_channels: notification.push_channels,
            push_results: notification.push_results,
            push_error: notification.push_error,
            created_at: notification.created_at
        });
    } catch (error) {
        logger.error("获取推送状态出错:", error);
        res.status(500).json({error: "获取推送状态失败"});
    }
});

/**
 * @route GET /notifications/:id
 * @desc 获取单个通知详情
 * @access Private
 */
router.get("/:id", needLogin, async (req, res) => {
    try {
        const userId = res.locals.userid;
        const notificationId = parseInt(req.params.id, 10);

        if (isNaN(notificationId)) {
            return res.status(400).json({error: "无效的通知ID"});
        }

        const notification = await prisma.ow_notifications.findFirst({
            where: {
                id: notificationId,
                user_id: userId, // 确保用户只能访问自己的通知
            },
            select: {
                id: true,
                title: true,
                content: true,
                link: true,
                metadata: true,
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
        });

        if (!notification) {
            return res.status(404).json({error: "通知不存在"});
        }

        // 自动标记为已读
        if (!notification.read) {
            await notificationUtils.markNotificationsAsRead({
                notificationIds: [notificationId],
                userId,
            });
            notification.read = true;
            notification.read_at = new Date();
        }

        const formattedNotification = await notificationUtils.formatNotificationForClient(notification);
        res.json(formattedNotification);
    } catch (error) {
        logger.error("获取通知详情出错:", error);
        res.status(500).json({error: "获取通知详情失败"});
    }
});






export default router;
