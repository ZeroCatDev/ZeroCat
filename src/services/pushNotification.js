/**
 * @fileoverview 浏览器推送通知服务
 */
import webpush from 'web-push';
import { prisma } from './global.js';
import logger from './logger.js';
import zcconfig from './config/zcconfig.js';

let vapidConfigured = false;

/**
 * 初始化 Web Push 配置
 */
async function initializeWebPush() {
    try {
        const vapidPublicKey = await zcconfig.get('webpush.vapid_public_key');
        const vapidPrivateKey = await zcconfig.get('webpush.vapid_private_key');
        const vapidSubject = await zcconfig.get('webpush.vapid_subject') || 'mailto:admin@zerocat.top';

        if (!vapidPublicKey || !vapidPrivateKey) {
            logger.warn('[推送通知] VAPID 密钥未配置，推送通知功能不可用');
            return false;
        }

        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );

        vapidConfigured = true;
        logger.info('[推送通知] Web Push 配置初始化成功');
        return true;
    } catch (error) {
        logger.error('[推送通知] Web Push 配置初始化失败:', error);
        return false;
    }
}

/**
 * 注册推送订阅
 * @param {number} userId - 用户ID
 * @param {Object} subscription - 推送订阅对象
 * @param {string} subscription.endpoint - 推送端点
 * @param {Object} subscription.keys - 密钥对象
 * @param {string} subscription.keys.p256dh - P256DH 公钥
 * @param {string} subscription.keys.auth - 认证密钥
 * @param {Object} [deviceInfo] - 设备信息
 * @param {string} [userAgent] - 用户代理
 * @returns {Promise<Object>} 注册结果
 */
export async function registerPushSubscription(userId, subscription, deviceInfo = {}, userAgent = '') {
    try {
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            throw new Error('无效的推送订阅信息');
        }

        // 检查订阅是否已存在
        const existingSubscription = await prisma.ow_push_subscriptions.findFirst({
            where: {
                user_id: userId,
                endpoint: subscription.endpoint
            }
        });

        if (existingSubscription) {
            // 更新现有订阅
            const updatedSubscription = await prisma.ow_push_subscriptions.update({
                where: { id: existingSubscription.id },
                data: {
                    p256dh_key: subscription.keys.p256dh,
                    auth_key: subscription.keys.auth,
                    user_agent: userAgent,
                    device_info: deviceInfo,
                    is_active: true,
                    last_used_at: new Date(),
                    updated_at: new Date()
                }
            });

            logger.info(`[推送通知] 更新用户 ${userId} 的推送订阅: ${existingSubscription.id}`);
            return {
                success: true,
                subscription: updatedSubscription,
                isNew: false
            };
        } else {
            // 创建新订阅
            const newSubscription = await prisma.ow_push_subscriptions.create({
                data: {
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    p256dh_key: subscription.keys.p256dh,
                    auth_key: subscription.keys.auth,
                    user_agent: userAgent,
                    device_info: deviceInfo,
                    is_active: true,
                    last_used_at: new Date()
                }
            });

            logger.info(`[推送通知] 创建用户 ${userId} 的新推送订阅: ${newSubscription.id}`);
            return {
                success: true,
                subscription: newSubscription,
                isNew: true
            };
        }
    } catch (error) {
        logger.error('[推送通知] 注册推送订阅失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 发送推送通知到指定用户
 * @param {number} userId - 用户ID
 * @param {Object} payload - 推送负载
 * @param {string} payload.title - 通知标题
 * @param {string} payload.body - 通知内容
 * @param {string} [payload.icon] - 图标URL
 * @param {string} [payload.url] - 点击URL
 * @param {Object} [payload.data] - 额外数据
 * @returns {Promise<Object>} 发送结果
 */
export async function sendPushNotificationToUser(userId, payload) {
    try {
        if (!vapidConfigured) {
            const initialized = await initializeWebPush();
            if (!initialized) {
                throw new Error('推送通知服务未正确配置');
            }
        }

        // 获取用户的活跃推送订阅
        const subscriptions = await prisma.ow_push_subscriptions.findMany({
            where: {
                user_id: userId,
                is_active: true
            }
        });

        if (subscriptions.length === 0) {
            logger.debug(`[推送通知] 用户 ${userId} 没有活跃的推送订阅`);
            return {
                success: false,
                error: '用户没有推送订阅'
            };
        }

        const results = [];
        const promises = subscriptions.map(async (subscription) => {
            try {
                const pushSubscription = {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dh_key,
                        auth: subscription.auth_key
                    }
                };

                const pushPayload = JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icon-192x192.png',
                    badge: '/icon-72x72.png',
                    url: payload.url,
                    data: payload.data || {},
                    timestamp: Date.now()
                });

                await webpush.sendNotification(pushSubscription, pushPayload);

                // 更新最后使用时间
                await prisma.ow_push_subscriptions.update({
                    where: { id: subscription.id },
                    data: { last_used_at: new Date() }
                });

                logger.debug(`[推送通知] 成功发送推送通知到订阅 ${subscription.id}`);
                return { subscriptionId: subscription.id, success: true };
            } catch (error) {
                logger.warn(`[推送通知] 发送到订阅 ${subscription.id} 失败:`, error.message);

                // 如果是410或404错误，说明订阅已失效
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await prisma.ow_push_subscriptions.update({
                        where: { id: subscription.id },
                        data: { is_active: false }
                    });
                    logger.info(`[推送通知] 标记订阅 ${subscription.id} 为非活跃状态`);
                }

                return { subscriptionId: subscription.id, success: false, error: error.message };
            }
        });

        const pushResults = await Promise.all(promises);
        const successCount = pushResults.filter(r => r.success).length;

        logger.info(`[推送通知] 用户 ${userId} 推送结果: ${successCount}/${subscriptions.length} 成功`);

        return {
            success: successCount > 0,
            totalSubscriptions: subscriptions.length,
            successCount,
            results: pushResults
        };
    } catch (error) {
        logger.error('[推送通知] 发送推送通知失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 取消用户的推送订阅
 * @param {number} userId - 用户ID
 * @param {string} endpoint - 推送端点
 * @returns {Promise<Object>} 取消结果
 */
export async function unregisterPushSubscription(endpoint) {
    try {
        const result = await prisma.ow_push_subscriptions.updateMany({
            where: {
                endpoint: endpoint
            },
            data: {
                is_active: false,
                updated_at: new Date()
            }
        });

        logger.info(`[推送通知] 取消推送订阅: ${endpoint}`);
        return {
            success: true,
            count: result.count
        };
    } catch (error) {
        logger.error('[推送通知] 取消推送订阅失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 获取用户的推送订阅列表
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} 订阅列表
 */
export async function getUserPushSubscriptions(userId) {
    try {
        const subscriptions = await prisma.ow_push_subscriptions.findMany({
            where: {
                user_id: userId,
                is_active: true
            },
            select: {
                id: true,
                endpoint: true,
                device_info: true,
                user_agent: true,
                created_at: true,
                last_used_at: true
            },
            orderBy: {
                last_used_at: 'desc'
            }
        });

        return subscriptions;
    } catch (error) {
        logger.error('[推送通知] 获取用户推送订阅失败:', error);
        return [];
    }
}

/**
 * 清理失效的推送订阅
 * @param {number} [daysBefore=30] - 清理多少天前的失效订阅
 * @returns {Promise<number>} 清理数量
 */
export async function cleanupInactiveSubscriptions(daysBefore = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

        const result = await prisma.ow_push_subscriptions.deleteMany({
            where: {
                is_active: false,
                updated_at: {
                    lt: cutoffDate
                }
            }
        });

        logger.info(`[推送通知] 清理了 ${result.count} 个失效的推送订阅`);
        return result.count;
    } catch (error) {
        logger.error('[推送通知] 清理失效推送订阅失败:', error);
        return 0;
    }
}

// 初始化服务
initializeWebPush().catch(error => {
    logger.error('[推送通知] 服务初始化失败:', error);
});

export default {
    registerPushSubscription,
    sendPushNotificationToUser,
    unregisterPushSubscription,
    getUserPushSubscriptions,
    cleanupInactiveSubscriptions
};