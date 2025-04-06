import { Router } from "express";
import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import { EventTypes } from "../controllers/events.js";
import { needlogin, strictTokenCheck, needadmin } from "../middleware/auth.js";

const router = Router();

// 新增一个函数来处理事件格式化
async function formatEvents(events, actorMap) {
  return await Promise.all(
    events.map(async (event) => {
      try {
        const actor = actorMap.get(Number(event.actor_id));
        if (!actor) {
          logger.warn(
            `Actor not found for event ${event.id}, actor_id: ${event.actor_id}`
          );
          return null;
        }

        const eventConfig = EventTypes[event.event_type];
        if (!eventConfig) {
          logger.warn(`Event type config not found: ${event.event_type}`);
          return null;
        }

        const formattedEvent = {
          id: event.id.toString(),
          type: event.event_type,
          actor: {
            id: actor.id,
            username: actor.username,
            display_name: actor.display_name,
          },
          target: {
            type: event.target_type,
            id: Number(event.target_id),
            page: {},
          },
          created_at: event.created_at,
          event_data: event.event_data,
          public: event.public === 1,
        };

        // 对于评论类型的事件，添加额外的定位信息到 page 中
        if (event.event_type === "comment_create" && event.event_data) {
          formattedEvent.target.id =
            event.event_data.page_id || event.event_data.page.id;
          formattedEvent.target.type =
            event.event_data.page_type || event.event_data.page.type;
          formattedEvent.target.page = {
            page_type: event.event_data.page_type,
            page_id: event.event_data.page_id,
            parent_id: event.event_data.parent_id,
            reply_id: event.event_data.reply_id,
          };
        }

        return formattedEvent;
      } catch (error) {
        logger.error("Error formatting event:", {
          error,
          event_id: event.id,
          event_type: event.event_type,
        });
        return null;
      }
    })
  );
}

// 获取用户时间线
router.get("/user/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const isOwner = res.locals.userid === Number(userid);

    logger.debug("Fetching timeline for user", {
      userid,
      isOwner,
      currentUser: res.locals.userid,
    });

    const where = {
      actor_id: BigInt(userid),
      ...(isOwner ? {} : { public: 1 }),
    };

    const events = await prisma.events.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.events.count({ where });

    const actorIds = [
      ...new Set(events.map((event) => Number(event.actor_id))),
    ];
    const actors = await prisma.ow_users.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, username: true, display_name: true },
    });

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    // 使用新函数格式化事件
    const formattedEvents = await formatEvents(events, actorMap);
    const filteredEvents = formattedEvents.filter((e) => e !== null);

    res.status(200).send({
      status: "success",
      data: {
        events: filteredEvents,
        pagination: {
          current: Number(page),
          size: Number(limit),
          total,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取时间线失败",
      details: error.message,
    });
  }
});

// 获取关注的用户的时间线（只显示公开事件）
router.get("/following", needlogin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const following = await prisma.ow_users_follows.findMany({
      where: { follower_id: res.locals.userid },
    });

    const followingIds = following.map((f) => f.following_id);

    const events = await prisma.events.findMany({
      where: {
        actor_id: { in: followingIds.map((id) => BigInt(id)) },
        public: 1,
      },
      orderBy: { created_at: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const actorIds = [
      ...new Set(events.map((event) => Number(event.actor_id))),
    ];
    const actors = await prisma.ow_users.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, username: true, display_name: true },
    });

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    // 使用新函数格式化事件
    const formattedEvents = await formatEvents(events, actorMap);

    res.status(200).send({
      status: "success",
      data: {
        events: formattedEvents.filter((e) => e !== null),
      },
    });
  } catch (error) {
    logger.error("Error fetching following timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取关注时间线失败",
    });
  }
});

export default router;
