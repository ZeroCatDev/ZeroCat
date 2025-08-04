/**
 * @fileoverview 管理员通知功能路由
 * 管理员专用的通知管理和发送功能
 */
import express from "express";
import { needAdmin } from "../../middleware/auth.js";
import logger from "../../services/logger.js";
import notificationUtils from "../../controllers/notifications.js";
import { prisma } from "../../services/global.js";

const router = express.Router();

/**
 * @route POST /admin/notifications/send
 * @desc 管理员统一通知发送接口（支持单发和批量发送、多渠道推送、隐藏通知等）
 * @access Admin
 */
router.post("/send", needAdmin, async (req, res) => {
    try {
        const adminId = res.locals.userid;
        const {
            // 接收者配置
            recipients,              // 接收者数组 [user_id1, user_id2] 或单个 user_id
            recipient_type = 'user_id', // 接收者类型: 'user_id' | 'username' | 'email'
            
            // 通知内容
            title,
            content,
            link,
            
            // 推送配置
            push_channels = ['browser'],  // 推送渠道: ['browser', 'email', 'push']
            
            // 通知设置
            hidden = false,               // 是否隐藏通知
            high_priority = false,        // 是否高优先级
            notification_type = 'admin_notification',
            
            // 目标信息
            target_type,
            target_id,
            
            // 额外数据
            metadata = {}
        } = req.body;

        // 验证必要字段
        if (!recipients || !title || !content) {
            return res.status(400).json({
                error: "缺少必要字段",
                required: ["recipients", "title", "content"]
            });
        }

        // 标准化接收者为数组
        const recipientList = Array.isArray(recipients) ? recipients : [recipients];
        
        if (recipientList.length === 0) {
            return res.status(400).json({
                error: "接收者列表不能为空"
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

        // 构建通知数据
        const notificationConfig = {
            title,
            content,
            link,
            pushChannels: push_channels,
            hidden,
            actorId: adminId,
            targetType: target_type,
            targetId: target_id,
            metadata: {
                admin_sent: true,
                admin_id: adminId,
                high_priority,
                notification_type,
                recipient_type,
                batch_size: recipientList.length,
                ...metadata
            }
        };

        // 统一发送处理
        const result = await notificationUtils.adminSendUnified({
            recipients: recipientList,
            recipientType: recipient_type,
            notificationConfig,
            adminId
        });

        res.json({
            success: true,
            message: recipientList.length === 1 
                ? (hidden ? "隐藏通知发送成功" : "通知发送成功")
                : `批量通知发送完成: 成功 ${result.successful.length}/${result.total}`,
            result,
            config: {
                channels: push_channels,
                hidden,
                batch_size: recipientList.length,
                recipient_type
            }
        });

    } catch (error) {
        logger.error("管理员发送通知出错:", error);
        res.status(500).json({
            error: "发送通知失败",
            details: error.message
        });
    }
});

/**
 * @route GET /admin/notifications/list
 * @desc 获取所有通知的管理视图（包含推送状态）
 * @access Admin
 */
router.get("/list", needAdmin, async (req, res) => {
    try {
        const {
            limit,
            offset,
            user_id,
            notification_type,
            unread_only,
            date_from,
            date_to,
            hidden_only,
            push_error_only
        } = req.query;

        const options = {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            userId: user_id,
            notificationType: notification_type,
            unreadOnly: unread_only === 'true',
            hiddenOnly: hidden_only === 'true',
            pushErrorOnly: push_error_only === 'true',
            dateFrom: date_from,
            dateTo: date_to
        };

        const result = await notificationUtils.getAdminNotificationsListEnhanced(options);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error("获取管理员通知列表出错:", error);
        res.status(500).json({
            error: "获取通知列表失败",
            details: error.message
        });
    }
});

/**
 * @route GET /admin/notifications/stats
 * @desc 获取通知统计信息
 * @access Admin
 */
router.get("/stats", needAdmin, async (req, res) => {
    try {
        const stats = await notificationUtils.getNotificationStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        logger.error("获取通知统计信息出错:", error);
        res.status(500).json({
            error: "获取统计信息失败",
            details: error.message
        });
    }
});

/**
 * @route GET /admin/notifications/users/search
 * @desc 搜索用户（用于发送通知时的用户选择）
 * @access Admin
 */
router.get("/users/search", needAdmin, async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                error: "查询字符串至少需要2个字符"
            });
        }

        const users = await prisma.ow_users.findMany({
            where: {
                OR: [
                    {
                        username: {
                            contains: query,
                            lte: 'insensitive'
                        }
                    },
                    {
                        display_name: {
                            contains: query,
                            lte: 'insensitive'
                        }
                    },
                    {
                        email: {
                            contains: query,
                            lte: 'insensitive'
                        }
                    }
                ],
                status: 'active' // 只搜索活跃用户
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
                email: true,
                type: true
            },
            take: parseInt(limit, 10),
            orderBy: {
                username: 'asc'
            }
        });

        res.json({
            success: true,
            users,
            total: users.length
        });
    } catch (error) {
        logger.error("搜索用户出错:", error);
        res.status(500).json({
            error: "搜索用户失败",
            details: error.message
        });
    }
});

export default router;