/**
 * @fileoverview Event routes
 */
import express from "express";
import {needLogin} from "../middleware/auth.js";
import {
    createEvent,
    getActorEvents,
    getProjectFollowersExternal,
    getTargetEvents,
    getUserFollowersExternal,
} from "../controllers/events.js";

const router = express.Router();

/**
 * @route GET /events/target/:targetType/:targetId
 * @desc Get events for a specific target
 * @access Public/Private (depends on event privacy)
 */
router.get("/target/:targetType/:targetId", async (req, res, next) => {
    try {
        const {targetType, targetId} = req.params;
        const {limit = 10, offset = 0} = req.query;
        const includePrivate = req.user ? true : false;

        const events = await getTargetEvents(
            targetType,
            targetId,
            Number(limit),
            Number(offset),
            includePrivate
        );

        res.json({
            status: "success",
            data: events,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /events/actor/:actorId
 * @desc Get events for a specific actor
 * @access Public/Private (depends on event privacy)
 */
router.get("/actor/:actorId", async (req, res, next) => {
    try {
        const {actorId} = req.params;
        const {limit = 10, offset = 0} = req.query;
        const includePrivate =
            req.user && (req.user.id === Number(actorId) || req.user.isAdmin);

        const events = await getActorEvents(
            actorId,
            Number(limit),
            Number(offset),
            includePrivate
        );

        res.json({
            status: "success",
            data: events,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /events
 * @desc Create a new event
 * @access Private
 */
router.post("/", needLogin, async (req, res, next) => {
    try {
        const {eventType, targetType, targetId, ...eventData} = req.body;

        // Use current user as actor if not specified
        const actorId = eventData.actor_id || req.user.id;

        const event = await createEvent(
            eventType,
            actorId,
            targetType,
            targetId,
            eventData
        );

        if (!event) {
            return res.status(400).json({
                status: "error",
                message: "Failed to create event",
            });
        }

        res.status(201).json({
            status: "success",
            data: event,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /events/project-followers/:projectId
 * @desc Get followers of a project
 * @access Public
 */
router.get("/project-followers/:projectId", async (req, res, next) => {
    try {
        const {projectId} = req.params;
        const followers = await getProjectFollowersExternal(projectId);

        res.json({
            status: "success",
            data: followers,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /events/user-followers/:userId
 * @desc Get followers of a user
 * @access Public
 */
router.get("/user-followers/:userId", async (req, res, next) => {
    try {
        const {userId} = req.params;
        const followers = await getUserFollowersExternal(userId);

        res.json({
            status: "success",
            data: followers,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
