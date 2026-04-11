/**
 * @fileoverview Event routes
 */
import express from "express";
import {needLogin} from "../middleware/auth.js";
import {
    createEvent,
    getActorEvents,
    getTargetEvents,
} from "../controllers/events.js";
import logger from "../services/logger.js";

const router = express.Router();

/**
 * @route GET /events/target/:targetType/:targetId
 * @desc Get events for a specific target
 * @access Public/Private (depends on event privacy)
 */
router.get("/target/:targetType/:targetId", async (req, res) => {
    try {
        const {targetType, targetId} = req.params;
        const {limit = 10, offset = 0} = req.query;
        const includePrivate = !!res.locals.userid;

        const events = await getTargetEvents(
            targetType,
            parseInt(targetId, 10),
            parseInt(limit, 10),
            parseInt(offset, 10),
            includePrivate
        );

        res.json({
            success: true,
            events,
            total: events.length
        });
    } catch (error) {
        logger.error("获取目标事件失败:", error);
        res.status(500).json({
            error: "获取事件列表失败"
        });
    }
});

/**
 * @route GET /events/actor/:actorId
 * @desc Get events for a specific actor
 * @access Public/Private (depends on event privacy)
 */
router.get("/actor/:actorId", async (req, res) => {
    try {
        const {actorId} = req.params;
        const {limit = 10, offset = 0} = req.query;
        const currentUserId = res.locals.userid;
        const includePrivate = currentUserId && (currentUserId === parseInt(actorId, 10));

        const events = await getActorEvents(
            parseInt(actorId, 10),
            parseInt(limit, 10),
            parseInt(offset, 10),
            includePrivate
        );

        res.json({
            success: true,
            events,
            total: events.length
        });
    } catch (error) {
        logger.error("获取用户事件失败:", error);
        res.status(500).json({
            error: "获取事件列表失败"
        });
    }
});

/**
 * @route POST /events
 * @desc Create a new event
 * @access Private
 */
router.post("/", needLogin, async (req, res) => {
    try {
        const {eventType, targetType, targetId, ...eventData} = req.body;

        if (!eventType || !targetType || !targetId) {
            return res.status(400).json({
                error: "缺少必要参数: eventType, targetType, targetId"
            });
        }

        // Use current user as actor
        const actorId = res.locals.userid;

        const event = await createEvent(
            eventType,
            actorId,
            targetType,
            parseInt(targetId, 10),
            eventData
        );

        if (!event) {
            return res.status(400).json({
                error: "事件创建失败"
            });
        }

        res.status(201).json({
            success: true,
            event
        });
    } catch (error) {
        logger.error("创建事件失败:", error);
        res.status(500).json({
            error: "创建事件失败"
        });
    }
});

export default router;
