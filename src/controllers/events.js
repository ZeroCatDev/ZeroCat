import {prisma} from "../services/prisma.js";
import logger from "../services/logger.js";
import {createNotification} from "./notifications.js";
import {AudienceDataDependencies, EventConfig,} from "../config/eventConfig.js";

// 重新导出这些常量供外部使用
export {EventConfig};

/**
 * 创建事件并异步发送通知
 * @param {string} eventType - 事件类型
 * @param {number} actorId - 行为者ID
 * @param {string} targetType - 目标类型
 * @param {number} targetId - 目标ID
 * @param {Object} eventData - 事件数据
 * @returns {Promise<Object|null>} 创建的事件对象
 */
export async function createEvent(eventType, actorId, targetType, targetId, eventData = {}) {
    try {
        const normalizedEventType = eventType.toLowerCase();
        const eventConfig = EventConfig[normalizedEventType];

        if (!eventConfig) {
            logger.warn(`未知的事件类型: ${eventType}`);
            return null;
        }

        // 创建事件记录
        const event = await prisma.ow_events.create({
            data: {
                event_type: normalizedEventType,
                actor_id: Number(actorId),
                target_type: targetType,
                target_id: Number(targetId),
                event_data: {
                    ...eventData,
                    actor_id: Number(actorId),
                    target_type: targetType,
                    target_id: Number(targetId)
                },
                public: eventConfig.public ? 1 : 0
            }
        });

        // 异步处理通知 - 使用 setImmediate 确保事件创建完成后再处理通知
        if (eventConfig.notifyTargets && eventConfig.notifyTargets.length > 0) {
            setImmediate(() => {
                processNotifications(event, eventConfig, eventData)
                    .catch(error => logger.error('异步通知处理错误:', error));
            });
        }

        return event;
    } catch (error) {
        logger.error('事件创建错误:', error);
        return null;
    }
}

/**
 * 获取特定目标的事件
 */
export async function getTargetEvents(targetType, targetId, limit = 10, offset = 0, includePrivate = false) {
    try {
        const events = await prisma.ow_events.findMany({
            where: {
                target_type: targetType,
                target_id: targetId,
                ...(includePrivate ? {} : {public: 1}),
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
            skip: offset,
        });

        return await enrichEvents(events);
    } catch (error) {
        logger.error('获取目标事件错误:', error);
        return [];
    }
}

/**
 * 获取特定行为者的事件
 */
export async function getActorEvents(actorId, limit = 10, offset = 0, includePrivate = false) {
    try {
        const events = await prisma.ow_events.findMany({
            where: {
                actor_id: actorId,
                ...(includePrivate ? {} : {public: 1}),
            },
            orderBy: {
                created_at: 'desc',
            },
            take: limit,
            skip: offset,
        });

        return await enrichEvents(events);
    } catch (error) {
        logger.error('获取行为者事件错误:', error);
        return [];
    }
}

/**
 * 用行为者和目标信息丰富事件数据
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
        logger.error('丰富事件数据错误:', error);
        return events;
    }
}

/**
 * 获取行为者信息
 */
async function getActor(actorId) {
    try {
        return await prisma.ow_users.findUnique({
            where: {id: Number(actorId)},
            select: {
                id: true,
                username: true,
                display_name: true,
                type: true
            }
        });
    } catch (error) {
        logger.error(`获取行为者 ${actorId} 错误:`, error);
        return null;
    }
}

/**
 * 获取目标信息
 */
async function getTarget(targetType, targetId) {
    try {
        switch (targetType) {
            case "project":
                return await prisma.ow_projects.findUnique({
                    where: {id: Number(targetId)}
                });
            case "user":
                return await prisma.ow_users.findUnique({
                    where: {id: Number(targetId)}
                });
            case "comment":
                return await prisma.ow_comment.findUnique({
                    where: {id: Number(targetId)}
                });
            default:
                return null;
        }
    } catch (error) {
        logger.error(`获取目标 ${targetType}/${targetId} 错误:`, error);
        return null;
    }
}

/**
 * 处理事件通知
 * 根据事件配置向相关用户发送通知
 * @param {Object} event - 事件对象
 * @param {Object} eventConfig - 事件配置
 * @param {Object} eventData - 事件数据
 */
async function processNotifications(event, eventConfig, eventData) {
    try {
        const actorId = Number(event.actor_id);
        const targetId = Number(event.target_id);

        // 收集所有需要通知的用户ID
        const notificationUsers = new Set();
        const audienceResults = {};

        // 为每个受众类型获取用户
        for (const audienceType of eventConfig.notifyTargets) {
            try {
                const audienceUsers = await getAudienceUsers(audienceType, event, eventData, audienceResults);
                audienceResults[audienceType] = audienceUsers;

                // 添加用户到通知列表（排除事件创建者）
                audienceUsers.forEach(userId => {
                    if (userId && userId !== actorId) {
                        notificationUsers.add(userId);
                    }
                });
            } catch (err) {
                logger.error(`获取受众 ${audienceType} 用户出错:`, err);
            }
        }

        if (notificationUsers.size === 0) {
            logger.debug(`事件 ${event.event_type} 无需要通知的用户`);
            return;
        }

        // 过滤黑名单用户
        const userIds = await filterBlacklistedUsers(actorId, Array.from(notificationUsers));
        if (userIds.length === 0) {
            logger.debug(`事件 ${event.event_type} 所有用户都在黑名单中`);
            return;
        }

        // 批量创建通知
        const notificationPromises = userIds.map(userId =>
            createNotification({
                userId,
                notificationType: event.event_type,
                actorId,
                targetType: event.target_type,
                targetId,
                data: eventData
            }).catch(error => {
                logger.error(`为用户 ${userId} 创建通知失败:`, error);
                return null;
            })
        );

        const results = await Promise.allSettled(notificationPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

        logger.debug(`事件 ${event.event_type} 通知发送完成: ${successCount}/${userIds.length} 成功`);
    } catch (error) {
        logger.error('通知处理错误:', error);
    }
}

/**
 * 过滤黑名单用户
 */
async function filterBlacklistedUsers(actorId, userIds) {
    if (!userIds.length) return [];

    try {
        // 找出用户间的黑名单关系
        const blacklistRelations = await prisma.ow_user_relationships.findMany({
            where: {
                OR: [
                    // 用户将行为者拉黑
                    {
                        source_user_id: {in: userIds},
                        target_user_id: actorId,
                        relationship_type: 'block'
                    },
                    // 行为者将用户拉黑
                    {
                        source_user_id: actorId,
                        target_user_id: {in: userIds},
                        relationship_type: 'block'
                    }
                ]
            },
            select: {
                source_user_id: true,
                target_user_id: true
            }
        });

        // 创建黑名单用户集合
        const blacklistedUsers = new Set();

        blacklistRelations.forEach(relation => {
            // 如果是用户拉黑行为者，添加用户到黑名单
            if (relation.target_user_id === actorId) {
                blacklistedUsers.add(relation.source_user_id);
            }
            // 如果是行为者拉黑用户，添加用户到黑名单
            else if (relation.source_user_id === actorId) {
                blacklistedUsers.add(relation.target_user_id);
            }
        });

        // 过滤掉黑名单中的用户
        return userIds.filter(userId => !blacklistedUsers.has(userId));
    } catch (error) {
        logger.error('过滤黑名单用户错误:', error);
        return userIds; // 如果出错，返回原始列表
    }
}

/**
 * 根据配置获取特定受众类型的用户
 * @param {string} audienceType - 受众类型
 * @param {Object} event - 事件对象
 * @param {Object} eventData - 事件数据
 * @param {Object} audienceResults - 已获取的受众结果（用于依赖关系）
 * @returns {Promise<number[]>} 用户ID数组
 */
async function getAudienceUsers(audienceType, event, eventData, audienceResults = {}) {
    try {
        const audienceConfig = AudienceDataDependencies[audienceType];
        if (!audienceConfig) {
            logger.warn(`未找到受众类型配置: ${audienceType}`);
            return [];
        }

        const actorId = Number(event.actor_id);
        const targetId = Number(event.target_id);

        // 如果事件数据中指定了通知对象，直接返回
        if (eventData.NotificationTo) {
            return eventData.NotificationTo;
        }

        // Handle direct target user notification
        if (audienceType === "target_user") {
            if (event.target_type === "user") {
                // If target is a user, directly notify them
                return [targetId];
            }

            // For other target types, notify their owners
            let ownerId;
            switch (event.target_type) {
                case "project":
                    const project = await prisma.ow_projects.findUnique({
                        where: {id: targetId},
                        select: {authorid: true}
                    });
                    ownerId = project?.authorid;
                    break;
                case "list":
                    const list = await prisma.ow_lists.findUnique({
                        where: {id: targetId},
                        select: {owner_id: true}
                    });
                    ownerId = list?.owner_id;
                    break;
                // Add more cases for other target types as needed
            }

            return ownerId ? [ownerId] : [];
        }

        // 处理依赖关系：如果这个受众类型依赖于另一个受众类型的结果
        if (audienceConfig.dependsOn) {
            const {audienceType: dependencyType, field} = audienceConfig.dependsOn;

            // 如果依赖的受众结果尚未获取，先获取它
            if (!audienceResults[dependencyType]) {
                audienceResults[dependencyType] = await getAudienceUsers(dependencyType, event, eventData, audienceResults);
            }

            // 没有依赖结果则直接返回空数组
            if (!audienceResults[dependencyType] || audienceResults[dependencyType].length === 0) {
                return [];
            }

            // 生成所有依赖受众的结果
            let allResults = [];
            for (const dependentId of audienceResults[dependencyType]) {
                const usersForDependent = await getRelatedUsers(audienceConfig, dependentId);
                allResults = [...allResults, ...usersForDependent];
            }

            // 去重并返回
            return [...new Set(allResults)];
        }

        // 1. 从事件目标直接获取用户
        if (audienceConfig.target) {
            const targetType = audienceConfig.target;
            let target;

            if (targetType === 'project' && event.target_type === "project") {
                target = await prisma.ow_projects.findUnique({
                    where: {id: targetId},
                    select: audienceConfig.fields.reduce((obj, field) => ({...obj, [field]: true}), {})
                });
            } else if (targetType === 'comment' && event.target_type === "comment") {
                target = await prisma.ow_comment.findUnique({
                    where: {id: targetId},
                    select: audienceConfig.fields.reduce((obj, field) => ({...obj, [field]: true}), {})
                });
            }

            if (target) {
                // 提取用户ID字段
                return audienceConfig.fields
                    .map(field => target[field])
                    .filter(id => id !== null && id !== undefined);
            }
            return [];
        }

        // 2. 从事件数据中直接提取用户
        if (audienceConfig.eventData) {
            const NotificationTo = eventData[audienceConfig.eventData];
            return Array.isArray(NotificationTo) ? NotificationTo : [NotificationTo];
        }

        // 3. 从数据库查询用户关系
        if (audienceConfig.query) {
            // 确定关联ID
            const relationId = audienceConfig.sourceField === 'actor_id' ?
                actorId : targetId;

            return await getRelatedUsers(audienceConfig, relationId);
        }

        return [];
    } catch (error) {
        logger.error(`获取受众 ${audienceType} 错误:`, error);
        return [];
    }
}

/**
 * 获取与特定ID相关的用户
 * 根据配置从数据库获取相关用户
 * @param {Object} config - 受众配置
 * @param {number} relationId - 关联ID
 * @returns {Promise<number[]>} 用户ID数组
 */
async function getRelatedUsers(config, relationId) {
    try {
        let where = {};

        // 处理特殊过滤器
        if (config.specialFilter === 'thread') {
            // 对于线程参与者，需要根据评论线程查询
            where = {
                pid: relationId,
                ...config.additionalFilters
            };
        } else if (config.relationField) {
            // 标准关联字段查询
            where = {
                [config.relationField]: relationId,
                ...config.additionalFilters
            };
        } else {
            logger.error(`配置缺少 relationField 或 specialFilter: ${JSON.stringify(config)}`);
            return [];
        }

        // 执行查询
        const relations = await prisma[config.query].findMany({
            where,
            select: {[config.userField]: true}
        });

        // 提取用户ID
        return relations
            .map(r => r[config.userField])
            .filter(id => id !== null && id !== undefined);
    } catch (error) {
        logger.error(`获取相关用户错误:`, error);
        return [];
    }
}