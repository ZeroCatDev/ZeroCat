import { prisma } from "../services/global.js";
import logger from "../services/logger.js";
import { createNotification } from "./notifications.js";
import {
  EventConfig,
  AudienceDataDependencies,
} from "../config/eventConfig.js";

// 重新导出这些常量供外部使用
export {  EventConfig };

/**
 * 创建事件并异步发送通知
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

    // 异步处理通知
    if (eventConfig.notifyTargets && eventConfig.notifyTargets.length > 0 ) {
      // 使用 Promise.resolve().then() 使其异步执行
      Promise.resolve().then(() => {
        processNotifications(event, eventConfig, eventData);
      }).catch(error => {
        logger.error('异步通知处理错误:', error);
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
    logger.error('获取目标事件错误:', error);
    return [];
  }
}

/**
 * 获取特定行为者的事件
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
      where: { id: Number(actorId) },
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
          where: { id: Number(targetId) }
        });
      case "user":
        return await prisma.ow_users.findUnique({
          where: { id: Number(targetId) }
        });
      case "comment":
        return await prisma.ow_comment.findUnique({
          where: { id: Number(targetId) }
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
 * 处理事件的通知
 */
async function processNotifications(event, eventConfig, eventData) {
  try {
    const actorId = Number(event.actor_id);
    const targetId = Number(event.target_id);

    // 收集所有受众用户ID
    const usersMap = new Map(); // 使用Map去重



    // 用于存储中间结果的对象，供依赖关系使用
    const audienceResults = {};

    // 为每个受众类型获取用户并合并
    for (const audienceType of eventConfig.notifyTargets) {
      try {
        const audienceUsers = await getAudienceUsers(audienceType, event, eventData, audienceResults);
        logger.error(audienceUsers);
        audienceResults[audienceType] = audienceUsers;
        logger.error(audienceResults);
        // 将用户添加到Map中以去重
        for (const userId of audienceUsers) {
          if (userId && userId !== actorId) { // 排除空值和事件创建者自己
            usersMap.set(userId, true);
          }
        }
      } catch (err) {
        logger.error(`获取受众 ${audienceType} 用户出错:`, err);
        // 继续处理其他受众类型
      }
    }

    // 没有用户需要通知则直接返回
    if (usersMap.size === 0) return;

    // 转换为数组
    let userIds = Array.from(usersMap.keys());

    // 排除在黑名单中的用户
    userIds = await filterBlacklistedUsers(actorId, userIds);
    if (userIds.length === 0) return;

    // 获取对应的通知类型
    const notificationType = event.event_type;


    // 创建通知
    const notificationPromises = userIds.map(userId =>
      createNotification({
        userId,
        notificationType,
        actorId,
        targetType: event.target_type,
        targetId,
        data: {}
      })
    );

    await Promise.all(notificationPromises);
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
    const blacklistRelations = await prisma.user_relationships.findMany({
      where: {
        OR: [
          // 用户将行为者拉黑
          {
            source_user_id: { in: userIds },
            target_user_id: actorId,
            relationship_type: 'block'
          },
          // 行为者将用户拉黑
          {
            source_user_id: actorId,
            target_user_id: { in: userIds },
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
  logger.error(audienceResults);
  try {
    const audienceConfig = AudienceDataDependencies[audienceType];
    if (!audienceConfig) {
      logger.warn(`未找到受众类型配置: ${audienceType}`);
      return [];
    }

    const actorId = Number(event.actor_id);
    const targetId = Number(event.target_id);
    if(eventData.NotificationTo){
      return eventData.NotificationTo
    }
    // 处理依赖关系：如果这个受众类型依赖于另一个受众类型的结果
    if (audienceConfig.dependsOn) {
      const { audienceType: dependencyType, field } = audienceConfig.dependsOn;

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
          where: { id: targetId },
          select: audienceConfig.fields.reduce((obj, field) => ({ ...obj, [field]: true }), {})
        });
      } else if (targetType === 'comment' && event.target_type === "comment") {
        target = await prisma.ow_comment.findUnique({
          where: { id: targetId },
          select: audienceConfig.fields.reduce((obj, field) => ({ ...obj, [field]: true }), {})
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
    // 构建查询
    const where = {
      [config.relationField]: relationId,
      ...config.additionalFilters
    };

    // 执行查询
    const relations = await prisma[config.query].findMany({
      where,
      select: { [config.userField]: true }
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

/**
 * 获取项目关注者 - 导出供外部使用
 */
export async function getProjectFollowersExternal(projectId) {
  const followers = await prisma.user_relationships.findMany({
    where: {
      target_user_id: Number(projectId),
      relationship_type: 'follow'
    },
    select: { source_user_id: true }
  });
  return followers.map(f => f.source_user_id);
}

/**
 * 获取用户关注者 - 导出供外部使用
 */
export async function getUserFollowersExternal(userId) {
  const followers = await prisma.user_relationships.findMany({
    where: {
      target_user_id: Number(userId),
      relationship_type: 'follow'
    },
    select: { source_user_id: true }
  });
  return followers.map(f => f.source_user_id);
}