/**
 * @fileoverview 通知系统辅助函数和常量
 */
import {prisma} from "../services/prisma.js";
import logger from "../services/logger.js";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendEmail } from "../services/email/emailService.js";
import zcconfig from "../services/config/zcconfig.js";
import { sendPushNotificationToUser } from "../services/pushNotification.js";
import emailTemplateService from "../services/email/emailTemplateService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NotificationTemplates = JSON.parse(
    readFileSync(join(__dirname, '../config/notificationTemplates.json'), 'utf8')
);

/**
 * 渲染模板字符串
 * @param {string} template - 模板字符串
 * @param {Object} vars - 变量对象
 * @returns {string} 渲染后的字符串
 */
function renderTemplate(template, vars) {
    if (!template || typeof template !== 'string') {
        return '';
    }

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = vars?.[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

/**
 * 获取目标对象信息
 * @param {string} targetType - 目标类型
 * @param {number} targetId - 目标ID
 * @returns {Promise<Object|null>} 目标对象信息
 */
async function getTargetInfo(targetType, targetId) {
    try {
        switch (targetType) {
            case 'project':
                return await prisma.ow_projects.findUnique({
                    where: { id: Number(targetId) },
                    select: {
                        id: true,
                        name: true,
                        title: true,
                        authorid: true,
                        author: {
                            select: {
                                username: true,
                                display_name: true,
                            },
                        },
                    },
                });
            case 'post':
                return await prisma.ow_posts.findUnique({
                    where: { id: Number(targetId) },
                    select: {
                        id: true,
                        content: true,
                        author_id: true,
                        author: {
                            select: {
                                username: true,
                                display_name: true,
                            },
                        },
                    },
                });
            case 'user':
                return await prisma.ow_users.findUnique({
                    where: { id: Number(targetId) },
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                    },
                });
            case 'comment':
                return await prisma.ow_comment.findUnique({
                    where: { id: Number(targetId) },
                    select: {
                        id: true,
                        text: true,
                        user_id: true,
                        user: {
                            select: {
                                username: true,
                                display_name: true,
                            },
                        },
                    },
                });
            default:
                return null;
        }
    } catch (error) {
        logger.error(`获取目标信息错误 ${targetType}/${targetId}:`, error);
        return null;
    }
}

/**
 * 生成目标对象的链接
 * @param {string} targetType - 目标类型
 * @param {number} targetId - 目标ID
 * @returns {string|null} 生成的链接
 */
/**
 * 生成目标对象的链接
 * @param {string} targetType - 目标类型
 * @param {number} targetId - 目标ID
 * @returns {string|null} 生成的链接
 */
function generateTargetLink(targetType, targetId) {
    switch (targetType) {
        case 'project':
            return `/app/link/project?id=${targetId}`;
        case 'post':
            return `/posts/${targetId}`;
        case 'user':
            return `/app/link/user?id=${targetId}`;
        default:
            return null;
    }
}

/**
 * 执行多渠道推送
 * @param {Object} pushData - 推送数据
 * @param {Object} pushData.notification - 通知对象
 * @param {number} pushData.userId - 用户ID
 * @param {string} pushData.title - 标题
 * @param {string} pushData.content - 内容
 * @param {string} pushData.link - 链接
 * @param {Object} pushData.template - 模板信息
 * @param {Array} pushData.pushChannels - 推送渠道
 * @param {Object} pushData.notificationData - 原始通知数据
 */
async function executeMultiChannelPush(pushData) {
    const { notification, userId, title, content, link, template, pushChannels, notificationData } = pushData;
    const pushResults = {};
    let hasError = false;

    // 遍历所有推送渠道
    for (const channel of pushChannels) {
        try {
            let result = null;

            switch (channel) {
                case 'browser':
                case 'push':
                    // 浏览器推送通知 - 需要用户ID
                    if (!userId) {
                        logger.warn(`跳过 ${channel} 推送：没有用户ID`);
                        continue;
                    }
                    result = await sendPushNotificationToUser(userId, {
                        title: title,
                        body: content,
                        url: link,
                        icon: template.icon ? `/icons/${template.icon}.png` : undefined,
                        data: {
                            notificationId: notification.id,
                            type: notificationData.notificationType,
                            ...notificationData.data
                        }
                    });
                    break;

                case 'email':
                    // 邮件推送
                    if (notificationData.data && notificationData.data.email_to) {
                        // 使用EmailTemplateService渲染和发送邮件
                        const emailData_details = notificationData.data;
                        const {
                            email_to,
                            email_username,
                            email_link,
                            email_buttons
                        } = emailData_details;

                        // 获取用户信息以显示display_name
                        let userDisplayInfo = {};
                        if (userId) {
                            const user = await prisma.ow_users.findUnique({
                                where: { id: Number(userId) },
                                select: {
                                    display_name: true,
                                    username: true,
                                },
                            });
                            userDisplayInfo = {
                                display_name: user?.display_name || user?.username || email_username || email_to.split('@')[0]
                            };
                        } else {
                            userDisplayInfo = {
                                display_name: email_username || email_to.split('@')[0]
                            };
                        }

                        const rendered = await emailTemplateService.renderTemplate('notification', {
                            title,
                            content,
                            email: email_to,
                            username: userDisplayInfo.display_name,
                            userId: userId,
                            link: email_link,
                            buttons: email_buttons
                        });

                        const { sendEmail } = await import('../services/email/emailService.js');
                        await sendEmail(email_to, rendered.subject, rendered.html);

                        result = {
                            success: true,
                            to: email_to,
                            subject: rendered.subject
                        };
                    } else {
                        // 原有逻辑，发送给已知用户
                        result = await sendEmailNotificationDirect({
                            userId,
                            title,
                            content,
                            link,
                            notificationId: notification.id
                        });
                    }
                    break;

                default:
                    logger.warn(`未知的推送渠道: ${channel}`);
                    continue;
            }

            pushResults[channel] = {
                success: true,
                result: result,
                timestamp: new Date()
            };

        } catch (error) {
            hasError = true;
            pushResults[channel] = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            logger.warn(`${channel}推送失败 (用户 ${userId}):`, error.message);
        }
    }

    // 更新通知的推送结果
    try {
        await prisma.ow_notifications.update({
            where: { id: notification.id },
            data: {
                push_results: pushResults,
                push_error: hasError
            }
        });
    } catch (updateError) {
        logger.error('更新推送结果失败:', updateError);
    }

    return { pushResults, hasError };
}

/**
 * 直接发送邮件通知（内部函数）
 * @param {Object} emailData - 邮件数据
 * @param {number} emailData.userId - 用户ID
 * @param {string} emailData.title - 标题
 * @param {string} emailData.content - 内容
 * @param {string} [emailData.link] - 链接
 * @param {number} [emailData.notificationId] - 关联的通知ID
 * @returns {Promise<Object>} 发送结果
 */
async function sendEmailNotificationDirect(emailData) {
    const { userId, title, content, link, notificationId } = emailData;

    // 获取用户邮箱
    const user = await prisma.ow_users.findUnique({
        where: { id: Number(userId) },
        select: {
            email: true,
            display_name: true,
            username: true,
        },
    });

    if (!user || !user.email) {
        throw new Error('用户邮箱不存在');
    }

    // 从通知的data中获取邮件相关信息
    const notification = await prisma.ow_notifications.findUnique({
        where: { id: notificationId },
        select: { data: true }
    });

    const emailData_details = notification?.data || {};
    const {
        email_to,
        email_username,
        email_link,
        email_buttons,
        has_link,
        has_buttons
    } = emailData_details;

    // 使用EmailTemplateService渲染邮件
    const rendered = await emailTemplateService.renderTemplate('notification', {
        title,
        content,
        email: user.email,
        username: user.display_name || user.username,
        userId: userId,
        link: email_link,
        buttons: email_buttons
    });

    // 发送邮件
    await sendEmail(user.email, rendered.subject, rendered.html);

    return {
        success: true,
        to: user.email,
        subject: rendered.subject
    };
}


/**
 * 创建新通知
 * 使用模板生成通知内容并存储到数据库
 *
 * @param {Object} notificationData - 通知数据
 * @param {number} notificationData.userId - 接收通知的用户ID
 * @param {string} notificationData.notificationType - 通知类型
 * @param {number} [notificationData.actorId] - 触发通知的用户ID
 * @param {string} [notificationData.targetType] - 目标类型
 * @param {number} [notificationData.targetId] - 目标ID
 * @param {Object} [notificationData.data] - 通知的附加数据
 * @param {boolean} [notificationData.highPriority] - 是否为高优先级通知
 * @param {boolean} [notificationData.hidden] - 是否为隐藏通知(不在用户列表中显示)
 * @param {Array} [notificationData.pushChannels] - 推送渠道数组 ['email', 'browser', 'push']
 * @param {string} [notificationData.title] - 自定义标题(覆盖模板)
 * @param {string} [notificationData.content] - 自定义内容(覆盖模板)
 * @param {string} [notificationData.link] - 自定义链接
 * @returns {Promise<Object>} 创建的通知
 */
export async function createNotification(notificationData) {
    try {
        const notificationType = notificationData.notificationType
            ? String(notificationData.notificationType)
            : 'custom_notification';

        const template = NotificationTemplates[notificationType] || {
            title: notificationType,
            icon: 'notification',
            requiresActor: false,
        };

        const data = notificationData.data || {};
        const normalizeNotificationText = (value) => {
            if (value === null || value === undefined) return '';
            return String(value).trim();
        };

        // 通知文案以调用方传入为准，不再走集中模板渲染。
        const title =
            normalizeNotificationText(notificationData.title) ||
            normalizeNotificationText(data.notification_title) ||
            normalizeNotificationText(data.custom_title) ||
            '通知';

        const content =
            normalizeNotificationText(notificationData.content) ||
            normalizeNotificationText(data.notification_content) ||
            normalizeNotificationText(data.custom_content) ||
            normalizeNotificationText(data.content) ||
            '您有一条新通知';

        const link = notificationData.link || null;

        // 默认推送渠道设置
        const defaultChannels = notificationData.hidden ? [] : ['browser'];
        const pushChannels = Array.isArray(notificationData.pushChannels)
            ? notificationData.pushChannels
            : defaultChannels;

        // 在数据库中创建通知
        const notificationCreateData = {
            title,
            content,
            link,
            metadata: {
                template_used: notificationType,
                ...data,
            },
            notification_type: notificationType,
            actor_id: notificationData.actorId ? Number(notificationData.actorId) : null,
            target_type: notificationData.targetType ? String(notificationData.targetType) : null,
            target_id: notificationData.targetId ? Number(notificationData.targetId) : null,
            data,
            high_priority: notificationData.highPriority || false,
            hidden: notificationData.hidden || false,
            push_channels: pushChannels,
            push_results: {},
            push_error: false,
            read: false,
        };

        // 如果有userId，则设置user_id字段
        if (notificationData.userId !== undefined && notificationData.userId !== null) {
            notificationCreateData.user_id = Number(notificationData.userId);
        }

        const notification = await prisma.ow_notifications.create({
            data: notificationCreateData
        });

        // 执行多渠道推送
        if (!notificationData.skipPush && pushChannels.length > 0) {
            await executeMultiChannelPush({
                notification,
                userId: notificationData.userId,
                title,
                content,
                link,
                template,
                pushChannels,
                notificationData: {
                    ...notificationData,
                    notificationType,
                    data
                }
            });
        }

        logger.debug('创建通知 ID ' + notification.id + ' 给用户 ' + notificationData.userId);
        return notification;
    } catch (error) {
        logger.error('创建通知出错:', error);
        throw error;
    }
}


/**
 * 获取用户的通知
 *
 * @param {Object} options - 查询选项
 * @param {number} options.userId - 用户ID
 * @param {boolean} [options.unreadOnly] - 是否只获取未读通知
 * @param {boolean} [options.includeHidden] - 是否包含隐藏通知
 * @param {number} [options.limit] - 返回的最大通知数量
 * @param {number} [options.offset] - 分页偏移量
 * @returns {Promise<Object>} 通知数组及分页信息
 */
export async function getUserNotifications(options) {
    const {userId, unreadOnly = false, includeHidden = false, limit = 20, offset = 0} = options;

    try {
        const whereConditions = {
            user_id: userId,
            ...(unreadOnly ? {read: false} : {}),
            ...(includeHidden ? {} : {hidden: false}),
        };

        const notifications = await prisma.ow_notifications.findMany({
            where: whereConditions,
            orderBy: {
                created_at: "desc",
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
            take: limit,
            skip: offset,
        });

        // 获取总数
        const totalCount = await prisma.ow_notifications.count({
            where: whereConditions,
        });
        //logger.debug(notifications);
        const formattedNotifications = notifications.map((notification) => ({
            id: Number(notification.id),
            title: notification.title,
            content: notification.content,
            link: notification.link,
            metadata: notification.metadata,
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
    const {notificationIds, userId} = options;

    try {
        if (!notificationIds || notificationIds.length === 0) {
            return 0;
        }

        const result = await prisma.ow_notifications.updateMany({
            where: {
                id: {in: notificationIds},
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
                hidden: false,
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
    const {notificationIds, userId} = options;

    try {
        if (!notificationIds || notificationIds.length === 0) {
            return 0;
        }

        const result = await prisma.ow_notifications.deleteMany({
            where: {
                id: {in: notificationIds.map((id) => Number(id))},
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
 * 现在主要用于添加模板图标信息
 *
 * @param {Object} notification - 原始通知对象
 * @returns {Object} 格式化后的通知对象
 */
export async function formatNotificationForClient(notification) {
    // 基本通知信息
    const formattedNotification = {
        id: Number(notification.id),
        title: notification.title,
        content: notification.content,
        link: notification.link,
        metadata: notification.metadata,
        type: notification.type || notification.notification_type,
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

    // 获取模板信息（主要用于图标）
    const template = NotificationTemplates[formattedNotification.type] || {
        title: formattedNotification.type,
        icon: "notification",
        template: "通知内容",
        requiresActor: true,
    };

    formattedNotification.template_info = {
        title: template.title,
        icon: template.icon,
    };

    return formattedNotification;
}

/**
 * 增强版通知发送接口
 * 支持隐藏通知和多种推送渠道
 *
 * @param {Object} notificationData - 通知数据
 * @param {number} notificationData.userId - 接收通知的用户ID
 * @param {string} notificationData.title - 通知标题
 * @param {string} notificationData.content - 通知内容
 * @param {string} [notificationData.link] - 通知链接
 * @param {Array} [notificationData.pushChannels] - 推送渠道 ['email', 'browser', 'push']
 * @param {boolean} [notificationData.hidden] - 是否为隐藏通知
 * @param {number} [notificationData.actorId] - 行为者ID
 * @param {string} [notificationData.targetType] - 目标类型
 * @param {number} [notificationData.targetId] - 目标ID
 * @param {Object} [notificationData.metadata] - 元数据
 * @returns {Promise<Object>} 发送结果
 */
export async function sendEnhancedNotification(notificationData) {
    try {
        const {
            userId,
            title,
            content,
            link,
            pushChannels = ['browser'],
            hidden = false,
            actorId,
            targetType,
            targetId,
            metadata = {}
        } = notificationData;

        // 处理特殊的 link 类型
        let finalLink = link;
        if (link === 'target' && targetType && targetId) {
            finalLink = generateTargetLink(targetType, targetId);
        }

        // 创建通知
        const notification = await createNotification({
            userId,
            title,
            content,
            link: finalLink,
            notificationType: 'enhanced_notification',
            actorId,
            targetType,
            targetId,
            hidden,
            pushChannels,
            data: {
                custom_title: title,
                custom_content: content,
                ...metadata
            },
            skipPush: false // 使用新的多渠道推送
        });

        return {
            success: true,
            notification,
            channels: pushChannels,
            hidden
        };
    } catch (error) {
        logger.error('发送增强通知失败:', error);
        throw error;
    }
}

/**
 * 发送通知的便捷接口
 * 支持多种通知渠道：browser（默认）、email 或留空
 *
 * @param {Object} notificationData - 通知数据
 * @param {number} notificationData.userId - 接收通知的用户ID
 * @param {string} notificationData.title - 通知标题
 * @param {string} notificationData.content - 通知内容
 * @param {string} [notificationData.link] - 通知链接
 * @param {string} [notificationData.channel] - 通知渠道：browser、email 或留空
 * @param {number} [notificationData.actorId] - 行为者ID
 * @param {string} [notificationData.targetType] - 目标类型，当link为'target'时使用
 * @param {number} [notificationData.targetId] - 目标ID，当link为'target'时使用
 * @param {Object} [notificationData.metadata] - 元数据
 * @returns {Promise<Object>} 发送结果
 */
export async function sendNotification(notificationData) {
    try {
        const {
            userId,
            title,
            content,
            link,
            channel = 'browser',
            actorId,
            targetType,
            targetId,
            metadata = {}
        } = notificationData;

        // 处理特殊的 link 类型
        let finalLink = link;
        if (link === 'target' && targetType && targetId) {
            finalLink = generateTargetLink(targetType, targetId);
        }

        const result = { browser: null, email: null, push: null };

        // 发送浏览器通知（默认）
        if (channel === 'browser' || !channel) {
            const browserNotification = await createNotification({
                userId,
                title,
                content,
                link: finalLink,
                notificationType: 'custom_notification',
                actorId,
                targetType,
                targetId,
                data: { custom_title: title, custom_content: content },
                metadata,
                skipPush: true // 手动发送推送通知以获得更好的控制
            });
            result.browser = browserNotification;

            // 同时发送推送通知
            try {
                const pushResult = await sendPushNotificationToUser(userId, {
                    title,
                    body: content,
                    url: finalLink,
                    data: { notificationId: browserNotification.id, ...metadata }
                });
                result.push = pushResult;
            } catch (pushError) {
                logger.warn('发送推送通知失败:', pushError);
                result.push = { success: false, error: pushError.message };
            }
        }

        // 发送邮件通知
        if (channel === 'email') {
            // 这里将在后面实现邮件通知发送
            result.email = await sendEmailNotification({
                userId,
                title,
                content,
                link: finalLink,
                notificationId: result.browser?.id
            });
        }

        return result;
    } catch (error) {
        logger.error('发送通知失败:', error);
        throw error;
    }
}

/**
 * 发送邮件通知
 * @param {Object} emailData - 邮件数据
 * @param {number} emailData.userId - 用户ID
 * @param {string} emailData.title - 标题
 * @param {string} emailData.content - 内容
 * @param {string} [emailData.link] - 链接
 * @param {number} [emailData.notificationId] - 关联的通知ID
 * @returns {Promise<Object>} 发送结果
 */
async function sendEmailNotification(emailData) {
    try {
        const { userId, title, content, link, notificationId } = emailData;

        // 获取用户邮箱
        const user = await prisma.ow_users.findUnique({
            where: { id: Number(userId) },
            select: {
                email: true,
                display_name: true,
                username: true,
            },
        });

        if (!user || !user.email) {
            throw new Error('用户邮箱不存在');
        }

        // 获取前端地址配置
        const frontendUrl = await zcconfig.get("urls.frontend") || 'https://zerocat.top';

        // 构建邮件内容
        const notificationLink = notificationId
            ? `${frontendUrl}/app/notifications/${notificationId}`
            : (link ? (link.startsWith('http') ? link : `${frontendUrl}${link}`) : null);

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
        </div>
        <div class="content">
            <p>您好 ${user.display_name || user.username}，</p>
            <p>${content}</p>
            ${notificationLink ? `<p><a href="${notificationLink}" class="btn">查看详情</a></p>` : ''}
        </div>
        <div class="footer">
            <p>此邮件由 ZeroCat 系统自动发送，请勿回复。</p>
            ${notificationLink ? `<p><a href="${notificationLink}">在浏览器中查看</a></p>` : ''}
        </div>
    </div>
</body>
</html>`;

        await sendEmail(user.email, title, emailHtml);

        return {
            success: true,
            email: user.email,
            notificationId
        };
    } catch (error) {
        logger.error('发送邮件通知失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 管理员统一通知发送接口
 * 支持多种接收者类型、单发和批量发送、多渠道推送等
 *
 * @param {Object} unifiedData - 统一发送数据
 * @param {Array} unifiedData.recipients - 接收者列表
 * @param {string} unifiedData.recipientType - 接收者类型 'user_id' | 'username' | 'email'
 * @param {Object} unifiedData.notificationConfig - 通知配置
 * @param {number} unifiedData.adminId - 管理员ID
 * @returns {Promise<Object>} 发送结果
 */
export async function adminSendUnified(unifiedData) {
    try {
        const { recipients, recipientType = 'user_id', notificationConfig, adminId } = unifiedData;

        const results = {
            total: recipients.length,
            successful: [],
            failed: [],
            errors: [],
            config: {
                recipient_type: recipientType,
                push_channels: notificationConfig.pushChannels,
                hidden: notificationConfig.hidden,
                admin_id: adminId
            }
        };

        // 解析接收者为用户ID
        const resolvedUserIds = await resolveRecipients(recipients, recipientType);

        // 批量发送通知
        for (let i = 0; i < resolvedUserIds.length; i++) {
            const recipientInfo = resolvedUserIds[i];
            const originalRecipient = recipients[i];

            try {
                if (!recipientInfo.userId) {
                    throw new Error(recipientInfo.error || '无效的接收者');
                }

                // 发送增强通知
                const result = await sendEnhancedNotification({
                    userId: recipientInfo.userId,
                    title: notificationConfig.title,
                    content: notificationConfig.content,
                    link: notificationConfig.link,
                    pushChannels: notificationConfig.pushChannels,
                    hidden: notificationConfig.hidden,
                    actorId: notificationConfig.actorId,
                    targetType: notificationConfig.targetType,
                    targetId: notificationConfig.targetId,
                    metadata: {
                        ...notificationConfig.metadata,
                        original_recipient: originalRecipient,
                        recipient_type: recipientType,
                        unified_send: true
                    }
                });

                results.successful.push({
                    original_recipient: originalRecipient,
                    user_id: recipientInfo.userId,
                    username: recipientInfo.username,
                    notification_id: result.notification.id,
                    channels: notificationConfig.pushChannels
                });

            } catch (error) {
                results.failed.push(originalRecipient);
                results.errors.push({
                    original_recipient: originalRecipient,
                    user_id: recipientInfo?.userId || null,
                    error: error.message
                });
                logger.warn(`向接收者 ${originalRecipient} 发送统一通知失败:`, error.message);
            }
        }

        logger.info(`管理员 ${adminId} 统一通知发送完成: 成功 ${results.successful.length}/${results.total}`);
        return results;

    } catch (error) {
        logger.error('管理员统一通知发送失败:', error);
        throw error;
    }
}

/**
 * 解析接收者为用户ID
 * @param {Array} recipients - 接收者列表
 * @param {string} recipientType - 接收者类型
 * @returns {Promise<Array>} 解析结果数组
 */
async function resolveRecipients(recipients, recipientType) {
    const results = [];

    for (const recipient of recipients) {
        try {
            let userInfo = null;

            switch (recipientType) {
                case 'user_id':
                    userInfo = await prisma.ow_users.findUnique({
                        where: { id: Number(recipient) },
                        select: { id: true, username: true, display_name: true }
                    });
                    break;

                case 'username':
                    userInfo = await prisma.ow_users.findUnique({
                        where: { username: String(recipient) },
                        select: { id: true, username: true, display_name: true }
                    });
                    break;

                case 'email':
                    userInfo = await prisma.ow_users.findFirst({
                        where: { email: String(recipient) },
                        select: { id: true, username: true, display_name: true, email: true }
                    });
                    break;

                default:
                    results.push({
                        userId: null,
                        error: `不支持的接收者类型: ${recipientType}`
                    });
                    continue;
            }

            if (userInfo) {
                results.push({
                    userId: userInfo.id,
                    username: userInfo.username,
                    displayName: userInfo.display_name,
                    email: userInfo.email || null
                });
            } else {
                results.push({
                    userId: null,
                    error: `找不到${recipientType}: ${recipient}`
                });
            }

        } catch (error) {
            results.push({
                userId: null,
                error: `解析${recipientType} ${recipient}时出错: ${error.message}`
            });
        }
    }

    return results;
}

/**
 * 获取所有通知的增强管理视图（管理员权限）
 * 支持隐藏通知和推送错误过滤
 *
 * @param {Object} options - 查询选项
 * @param {number} [options.limit] - 返回的最大通知数量
 * @param {number} [options.offset] - 分页偏移量
 * @param {string} [options.userId] - 筛选特定用户的通知
 * @param {string} [options.notificationType] - 筛选特定类型的通知
 * @param {boolean} [options.unreadOnly] - 是否只获取未读通知
 * @param {boolean} [options.hiddenOnly] - 是否只获取隐藏通知
 * @param {boolean} [options.pushErrorOnly] - 是否只获取推送错误的通知
 * @param {string} [options.dateFrom] - 开始日期筛选
 * @param {string} [options.dateTo] - 结束日期筛选
 * @returns {Promise<Object>} 通知列表及统计信息
 */
export async function getAdminNotificationsListEnhanced(options) {
    try {
        const {
            limit = 50,
            offset = 0,
            userId,
            notificationType,
            unreadOnly = false,
            hiddenOnly = false,
            pushErrorOnly = false,
            dateFrom,
            dateTo
        } = options;

        // 构建查询条件
        const whereConditions = {};

        if (userId) {
            whereConditions.user_id = Number(userId);
        }

        if (notificationType) {
            whereConditions.notification_type = notificationType;
        }

        if (unreadOnly) {
            whereConditions.read = false;
        }

        if (hiddenOnly) {
            whereConditions.hidden = true;
        }

        if (pushErrorOnly) {
            whereConditions.push_error = true;
        }

        if (dateFrom || dateTo) {
            whereConditions.created_at = {};
            if (dateFrom) {
                whereConditions.created_at.gte = new Date(dateFrom);
            }
            if (dateTo) {
                whereConditions.created_at.lte = new Date(dateTo);
            }
        }

        // 获取通知列表
        const notifications = await prisma.ow_notifications.findMany({
            where: whereConditions,
            orderBy: {
                created_at: "desc",
            },
            select: {
                id: true,
                user_id: true,
                title: true,
                content: true,
                link: true,
                metadata: true,
                notification_type: true,
                read: true,
                created_at: true,
                read_at: true,
                high_priority: true,
                hidden: true,
                push_channels: true,
                push_results: true,
                push_error: true,
                data: true,
                actor_id: true,
                target_type: true,
                target_id: true,
                actor: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        avatar: true,
                    },
                },
            },
            take: limit,
            skip: offset,
        });

        // 获取用户信息（批量查询优化）
        const userIds = [...new Set(notifications.map(n => n.user_id))];
        const users = await prisma.ow_users.findMany({
            where: {
                id: { in: userIds }
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
            }
        });
        const userMap = users.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // 格式化通知数据
        const formattedNotifications = notifications.map((notification) => ({
            id: Number(notification.id),
            user_id: notification.user_id,
            user: userMap[notification.user_id] || null,
            title: notification.title,
            content: notification.content,
            link: notification.link,
            metadata: notification.metadata,
            type: notification.notification_type,
            read: notification.read,
            created_at: notification.created_at,
            read_at: notification.read_at,
            high_priority: notification.high_priority,
            hidden: notification.hidden,
            push_channels: notification.push_channels,
            push_results: notification.push_results,
            push_error: notification.push_error,
            data: notification.data || {},
            actor_id: notification.actor_id,
            actor: notification.actor,
            target_type: notification.target_type,
            target_id: notification.target_id,
        }));

        // 获取总数
        const totalCount = await prisma.ow_notifications.count({
            where: whereConditions,
        });

        // 获取增强统计信息
        const stats = await getEnhancedNotificationStats();

        return {
            notifications: formattedNotifications,
            total: totalCount,
            limit,
            offset,
            stats,
            filters: {
                userId,
                notificationType,
                unreadOnly,
                hiddenOnly,
                pushErrorOnly,
                dateFrom,
                dateTo
            }
        };
    } catch (error) {
        logger.error("获取增强管理员通知列表出错:", error);
        throw error;
    }
}

/**
 * 获取增强的通知统计信息
 *
 * @returns {Promise<Object>} 统计数据
 */
export async function getEnhancedNotificationStats() {
    try {
        const [
            totalCount,
            unreadCount,
            hiddenCount,
            pushErrorCount,
            todayCount,
            weekCount,
            typeStats,
            channelStats
        ] = await Promise.all([
            // 总通知数
            prisma.ow_notifications.count(),

            // 未读通知数
            prisma.ow_notifications.count({
                where: { read: false }
            }),

            // 隐藏通知数
            prisma.ow_notifications.count({
                where: { hidden: true }
            }),

            // 推送错误通知数
            prisma.ow_notifications.count({
                where: { push_error: true }
            }),

            // 今日通知数
            prisma.ow_notifications.count({
                where: {
                    created_at: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),

            // 本周通知数
            prisma.ow_notifications.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),

            // 按类型统计
            prisma.ow_notifications.groupBy({
                by: ['notification_type'],
                _count: {
                    id: true
                },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                },
                take: 10
            }),

            // 按推送渠道统计（需要自定义查询）
            prisma.ow_notifications.findMany({
                where: {
                    push_channels: {
                        not: null
                    }
                },
                select: {
                    push_channels: true
                }
            })
        ]);

        // 处理推送渠道统计
        const channelCount = {};
        channelStats.forEach(notification => {
            if (notification.push_channels && Array.isArray(notification.push_channels)) {
                notification.push_channels.forEach(channel => {
                    channelCount[channel] = (channelCount[channel] || 0) + 1;
                });
            }
        });

        return {
            total: totalCount,
            unread: unreadCount,
            hidden: hiddenCount,
            push_error: pushErrorCount,
            today: todayCount,
            week: weekCount,
            byType: typeStats.map(stat => ({
                type: stat.notification_type,
                count: stat._count.id
            })),
            byChannel: Object.entries(channelCount).map(([channel, count]) => ({
                channel,
                count
            }))
        };
    } catch (error) {
        logger.error("获取增强通知统计信息出错:", error);
        throw error;
    }
}

/**
 * 获取所有通知的管理视图（管理员权限）
 *
 * @param {Object} options - 查询选项
 * @param {number} [options.limit] - 返回的最大通知数量
 * @param {number} [options.offset] - 分页偏移量
 * @param {string} [options.userId] - 筛选特定用户的通知
 * @param {string} [options.notificationType] - 筛选特定类型的通知
 * @param {boolean} [options.unreadOnly] - 是否只获取未读通知
 * @param {string} [options.dateFrom] - 开始日期筛选
 * @param {string} [options.dateTo] - 结束日期筛选
 * @returns {Promise<Object>} 通知列表及统计信息
 */
export async function getAdminNotificationsList(options) {
    try {
        const {
            limit = 50,
            offset = 0,
            userId,
            notificationType,
            unreadOnly = false,
            dateFrom,
            dateTo
        } = options;

        // 构建查询条件
        const whereConditions = {};

        if (userId) {
            whereConditions.user_id = Number(userId);
        }

        if (notificationType) {
            whereConditions.notification_type = notificationType;
        }

        if (unreadOnly) {
            whereConditions.read = false;
        }

        if (dateFrom || dateTo) {
            whereConditions.created_at = {};
            if (dateFrom) {
                whereConditions.created_at.gte = new Date(dateFrom);
            }
            if (dateTo) {
                whereConditions.created_at.lte = new Date(dateTo);
            }
        }

        // 获取通知列表
        const notifications = await prisma.ow_notifications.findMany({
            where: whereConditions,
            orderBy: {
                created_at: "desc",
            },
            select: {
                id: true,
                user_id: true,
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
                target_type: true,
                target_id: true,
                actor: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        avatar: true,
                    },
                },
            },
            take: limit,
            skip: offset,
        });

        // 获取用户信息（批量查询优化）
        const userIds = [...new Set(notifications.map(n => n.user_id))];
        const users = await prisma.ow_users.findMany({
            where: {
                id: { in: userIds }
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
            }
        });
        const userMap = users.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // 格式化通知数据
        const formattedNotifications = notifications.map((notification) => ({
            id: Number(notification.id),
            user_id: notification.user_id,
            user: userMap[notification.user_id] || null,
            title: notification.title,
            content: notification.content,
            link: notification.link,
            metadata: notification.metadata,
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

        // 获取总数
        const totalCount = await prisma.ow_notifications.count({
            where: whereConditions,
        });

        // 获取统计信息
        const stats = await getNotificationStats();

        return {
            notifications: formattedNotifications,
            total: totalCount,
            limit,
            offset,
            stats,
            filters: {
                userId,
                notificationType,
                unreadOnly,
                dateFrom,
                dateTo
            }
        };
    } catch (error) {
        logger.error("获取管理员通知列表出错:", error);
        throw error;
    }
}

/**
 * 获取通知统计信息
 *
 * @returns {Promise<Object>} 统计数据
 */
export async function getNotificationStats() {
    try {
        const [
            totalCount,
            unreadCount,
            todayCount,
            weekCount,
            typeStats
        ] = await Promise.all([
            // 总通知数
            prisma.ow_notifications.count(),

            // 未读通知数
            prisma.ow_notifications.count({
                where: { read: false }
            }),

            // 今日通知数
            prisma.ow_notifications.count({
                where: {
                    created_at: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),

            // 本周通知数
            prisma.ow_notifications.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),

            // 按类型统计
            prisma.ow_notifications.groupBy({
                by: ['notification_type'],
                _count: {
                    id: true
                },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                },
                take: 10
            })
        ]);

        return {
            total: totalCount,
            unread: unreadCount,
            today: todayCount,
            week: weekCount,
            byType: typeStats.map(stat => ({
                type: stat.notification_type,
                count: stat._count.id
            }))
        };
    } catch (error) {
        logger.error("获取通知统计信息出错:", error);
        throw error;
    }
}

export default {
    NotificationTemplates,
    createNotification,
    sendNotification,
    sendEnhancedNotification,
    getUserNotifications,
    markNotificationsAsRead,
    getUnreadNotificationCount,
    deleteNotifications,
    formatNotificationForClient,
    getNotificationTemplates,
    adminSendUnified,
    getAdminNotificationsList,
    getAdminNotificationsListEnhanced,
    getNotificationStats,
    getEnhancedNotificationStats,
};
