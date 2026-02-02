import {prisma} from "./prisma.js";
import logger from "./logger.js";
import {EventConfig} from "../config/eventConfig.js";

// 控制是否显示非公开事件的变量，默认为false
const SHOW_PRIVATE_EVENTS = false;

/**
 * 格式化事件数据
 */
async function formatEvents(events, actorMap) {
    return (await Promise.all(
        events.map(async (event) => {
            try {
                const actor = actorMap.get(Number(event.actor_id));
                if (!actor) {
                    logger.warn(
                        `Actor not found for event ${event.id}, actor_id: ${event.actor_id}`
                    );
                    return null;
                }

                const eventConfig = EventConfig[event.event_type];
                if (!eventConfig) {
                    logger.warn(`Event type config not found: ${event.event_type}`);
                    return null;
                }

                // 检查事件是否为公开事件
                if (!SHOW_PRIVATE_EVENTS && !eventConfig.public) {
                    return null;
                }

                const formattedEvent = {
                    id: event.id.toString(),
                    type: event.event_type,
                    actor: {
                        id: actor.id,
                        username: actor.username,
                        display_name: actor.display_name,
                        avatar: actor.avatar,
                    },
                    target: {
                        type: event.target_type,
                        id: Number(event.target_id),
                        page: {},
                    },
                    created_at: event.created_at,
                    event_data: event.event_data,
                    public: eventConfig.public,
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
    )).filter(event => event !== null);
}

/**
 * 获取用户时间线
 */
export async function getUserTimeline(userId, page = 1, limit = 20, isOwner = false) {
    try {
        const where = {
            actor_id: Number(userId),
            ...(isOwner ? {} : {public: true}),
        };

        const [events, total] = await Promise.all([
            prisma.ow_events.findMany({
                where,
                orderBy: {created_at: "desc"},
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.ow_events.count({where})
        ]);

        const actorIds = [...new Set(events.map((event) => Number(event.actor_id)))];
        const actors = await prisma.ow_users.findMany({
            where: {id: {in: actorIds}},
            select: {id: true, username: true, display_name: true, avatar: true},
        });

        const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
        const formattedEvents = await formatEvents(events, actorMap);

        return {
            events: formattedEvents,
            pagination: {
                current: Number(page),
                size: Number(limit),
                total,
            },
        };
    } catch (error) {
        logger.error("Error fetching user timeline:", error);
        throw error;
    }
}

/**
 * 获取关注的用户时间线
 */
export async function getFollowingTimeline(userId, page = 1, limit = 20) {
    try {
        // 获取用户关注的人
        const following = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: Number(userId),
                relationship_type: 'follow'
            },
        });

        const followingIds = following.map((f) => f.target_user_id);

        if (followingIds.length === 0) {
            return {
                events: [],
                pagination: {
                    current: Number(page),
                    size: Number(limit),
                    total: 0,
                },
            };
        }

        const [events, total] = await Promise.all([
            prisma.ow_events.findMany({
                where: {
                    actor_id: {in: followingIds.map((id) => Number(id))},
                    public: true,
                },
                orderBy: {created_at: "desc"},
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.ow_events.count({
                where: {
                    actor_id: {in: followingIds.map((id) => Number(id))},
                    public: true,
                },
            })
        ]);

        const actorIds = [...new Set(events.map((event) => Number(event.actor_id)))];
        const actors = await prisma.ow_users.findMany({
            where: {id: {in: actorIds}},
            select: {id: true, username: true, display_name: true, avatar: true},
        });

        const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
        const formattedEvents = await formatEvents(events, actorMap);

        return {
            events: formattedEvents,
            pagination: {
                current: Number(page),
                size: Number(limit),
                total,
            },
        };
    } catch (error) {
        logger.error("Error fetching following timeline:", error);
        throw error;
    }
}

/**
 * 获取我的时间线（包含自己和关注的人的事件）
 */
export async function getMyTimeline(userId, page = 1, limit = 20) {
    try {
        // 获取用户关注的人
        const following = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: Number(userId),
                relationship_type: 'follow'
            },
        });

        const followingIds = following.map((f) => f.target_user_id);
        // 添加用户自己的ID
        followingIds.push(Number(userId));

        const [events, total] = await Promise.all([
            prisma.ow_events.findMany({
                where: {
                    actor_id: {in: followingIds},
                    public: true,
                },
                orderBy: {created_at: "desc"},
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
            }),
            prisma.ow_events.count({
                where: {
                    actor_id: {in: followingIds},
                    public: true,
                },
            })
        ]);

        const actorIds = [...new Set(events.map((event) => Number(event.actor_id)))];
        const actors = await prisma.ow_users.findMany({
            where: {id: {in: actorIds}},
            select: {id: true, username: true, display_name: true, avatar: true},
        });

        const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
        const formattedEvents = await formatEvents(events, actorMap);

        return {
            events: formattedEvents,
            pagination: {
                current: Number(page),
                size: Number(limit),
                total,
            },
        };
    } catch (error) {
        logger.error("Error fetching my timeline:", error);
        throw error;
    }
}