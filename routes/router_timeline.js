import { Router } from "express";
import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import { EventTypes } from "../controllers/events.js";
import { needlogin } from "../middleware/auth.js";

const router = Router();

/**
 * 格式化事件显示文本
 */
async function formatEventDisplay(event, actor, target) {
  try {
    const eventConfig = EventTypes[event.event_type];
    if (!eventConfig) {
      logger.warn(`Unknown event type: ${event.event_type}`);
      return null;
    }

    let displayText = eventConfig.displayFormat;
    if (!displayText) {
      displayText = eventConfig.description || '未知事件';
    }
    
    // 处理已删除的目标
    const targetName = target?.state === 'deleted' 
      ? `${target.name || target.title}` 
      : (target?.name || target?.title || '未知目标');

    // 替换模板中的变量
    displayText = displayText.replace('{actor.name}', actor?.display_name || actor?.username || '未知用户');
    displayText = displayText.replace('{target.name}', targetName);

    // 如果目标已删除，在描述中添加说明
    if (target?.state === 'deleted') {
      displayText += ' (已删除)';
    }

    return {
      id: event.id.toString(),
      type: event.event_type,
      description: eventConfig.description,
      display_text: displayText,
      actor: {
        id: actor?.id,
        username: actor?.username,
        display_name: actor?.display_name
      },
      target: {
        id: target?.id,
        type: event.target_type,
        name: targetName,
        state: target?.state
      },
      created_at: event.created_at,
      event_data: event.event_data
    };
  } catch (error) {
    logger.error('Error formatting event display:', error);
    return null;
  }
}

/**
 * 获取目标对象信息，包括处理已删除的目标
 */
async function getTargetInfo(type, id) {
  try {
    logger.debug(`Getting target info for type: ${type}, id: ${id}`);
    
    let result = null;
    switch (type) {
      case 'project':
        // 先尝试从正常项目表获取
        result = await prisma.ow_projects.findUnique({
          where: { id: Number(id) },
          select: {
            id: true,
            name: true,
            title: true,
            authorid: true,
            state: true
          }
        });

        // 如果项目不存在，返回一个表示已删除项目的对象
        if (!result) {
          return {
            id: Number(id),
            name: '已删除的项目',
            title: '已删除的项目',
            state: 'deleted'
          };
        }
        break;

      case 'user':
        result = await prisma.ow_users.findUnique({
          where: { id: Number(id) },
          select: {
            id: true,
            username: true,
            display_name: true,
            state: true
          }
        });

        // 处理已删除的用户
        if (!result) {
          return {
            id: Number(id),
            username: 'deleted_user',
            display_name: '已删除的用户',
            state: 'deleted'
          };
        }
        break;

      case 'comment':
        result = await prisma.ow_comment.findUnique({
          where: { id: Number(id) },
          select: {
            id: true,
            text: true,
            page_type: true,
            page_id: true
          }
        });

        // 处理已删除的评论
        if (!result) {
          return {
            id: Number(id),
            text: '该评论已被删除',
            state: 'deleted'
          };
        }
        break;

      default:
        logger.warn(`Unknown target type: ${type}`);
        return null;
    }

    logger.debug(`Found target:`, result);
    return result;
  } catch (error) {
    logger.error(`Error getting target info for type ${type} and id ${id}:`, error);
    return null;
  }
}

// 获取用户时间线
router.get("/user/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const isOwner = res.locals.userid === Number(userid);

    logger.debug('Fetching timeline for user', { 
      userid,
      isOwner,
      currentUser: res.locals.userid
    });

    // 构建查询条件，非本人只能看到公开事件
    const where = {
      actor_id: BigInt(userid),
      ...(isOwner ? {} : { public: 1 })
    };

    // 获取事件列表
    const events = await prisma.events.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    logger.debug('Raw events:', events);

    // 获取总数
    const total = await prisma.events.count({ where });

    // 获取事件相关的用户信息
    const actorIds = [...new Set(events.map(event => Number(event.actor_id)))];
    const actors = await prisma.ow_users.findMany({
      where: {
        id: {
          in: actorIds
        }
      },
      select: {
        id: true,
        username: true,
        display_name: true
      }
    });

    logger.debug('Found actors:', actors);

    // 创建用户ID到用户信息的映射
    const actorMap = new Map(actors.map(actor => [actor.id, actor]));

    // 格式化事件数据
    const formattedEvents = await Promise.all(
      events.map(async (event) => {
        try {
          const actor = actorMap.get(Number(event.actor_id));
          if (!actor) {
            logger.warn(`Actor not found for event ${event.id}, actor_id: ${event.actor_id}`);
            return null;
          }

          const target = await getTargetInfo(event.target_type, event.target_id);
          if (!target) {
            logger.warn(`Target not found for event ${event.id}, type: ${event.target_type}, id: ${event.target_id}`);
            return null;
          }

          const eventConfig = EventTypes[event.event_type];
          if (!eventConfig) {
            logger.warn(`Event type config not found: ${event.event_type}`);
            return null;
          }

          let displayText = eventConfig.displayFormat;
          if (!displayText) {
            logger.warn(`Display format not found for event type: ${event.event_type}`);
            displayText = eventConfig.description || '未知事件';
          }

          // 替换模板中的变量
          displayText = displayText.replace('{actor.name}', actor.display_name || actor.username || '未知用户');
          displayText = displayText.replace('{target.name}', target.name || target.title || '未知目标');

          const formattedEvent = {
            id: event.id.toString(),
            type: event.event_type,
            description: eventConfig.description,
            display_text: displayText,
            actor: {
              id: actor.id,
              username: actor.username,
              display_name: actor.display_name
            },
            target: {
              id: target.id,
              type: event.target_type,
              name: target.name || target.title
            },
            created_at: event.created_at,
            event_data: event.event_data
          };

          logger.debug('Formatted event:', formattedEvent);
          return formattedEvent;
        } catch (error) {
          logger.error('Error formatting event:', {
            error,
            event_id: event.id,
            event_type: event.event_type
          });
          return null;
        }
      })
    );

    const filteredEvents = formattedEvents.filter(e => e !== null);
    logger.debug(`Formatted ${filteredEvents.length} valid events out of ${events.length} total events`);

    res.status(200).send({
      status: "success",
      data: {
        events: filteredEvents,
        pagination: {
          current: Number(page),
          size: Number(limit),
          total
        }
      }
    });
  } catch (error) {
    logger.error("Error fetching timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取时间线失败",
      details: error.message
    });
  }
});

// 获取关注的用户的时间线（只显示公开事件）
router.get("/following", needlogin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // 获取用户关注的人
    const following = await prisma.ow_users_follows.findMany({
      where: { follower_id: res.locals.userid }
    });
    
    const followingIds = following.map(f => f.following_id);
    
    // 获取关注用户的公开事件
    const events = await prisma.events.findMany({
      where: {
        actor_id: { in: followingIds.map(id => BigInt(id)) },
        public: 1 // 只获取公开事件
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    // 获取所有相关用户信息
    const actorIds = [...new Set(events.map(event => Number(event.actor_id)))];
    const actors = await prisma.ow_users.findMany({
      where: {
        id: {
          in: actorIds
        }
      },
      select: {
        id: true,
        username: true,
        display_name: true
      }
    });

    const actorMap = new Map(actors.map(actor => [actor.id, actor]));

    // 格式化和返回数据
    const formattedEvents = await Promise.all(
      events.map(async (event) => {
        const actor = actorMap.get(Number(event.actor_id));
        const target = await getTargetInfo(event.target_type, event.target_id);
        return await formatEventDisplay(event, actor, target);
      })
    );

    res.status(200).send({
      status: "success",
      data: {
        events: formattedEvents.filter(e => e !== null)
      }
    });
  } catch (error) {
    logger.error("Error fetching following timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取关注时间线失败"
    });
  }
});

export default router; 