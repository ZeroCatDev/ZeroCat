import express from 'express';
import { getTargetEvents, getActorEvents } from '../controllers/events.js';
import { TargetTypes } from '../models/events.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/events/target/:targetType/:targetId
 * @description Get events for a specific target
 * @access Public (filtered by event.public)
 */
router.get('/target/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { limit = 10, offset = 0, includePrivate = false } = req.query;

    // Validate target type
    if (!Object.values(TargetTypes).includes(targetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    // Check if user has permission to see private events
    const canSeePrivate = req.user && (
      req.user.type === 'admin' ||
      (targetType === TargetTypes.USER && Number(req.user.id) === Number(targetId))
    );

    const events = await getTargetEvents(
      targetType,
      targetId,
      Math.min(parseInt(limit), 100), // Max 100 events at once
      parseInt(offset),
      canSeePrivate && includePrivate === 'true'
    );

    res.json(events);
  } catch (error) {
    logger.error('Error in GET /events/target:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/events/actor/:actorId
 * @description Get events for a specific actor
 * @access Public (filtered by event.public)
 */
router.get('/actor/:actorId', async (req, res) => {
  try {
    const { actorId } = req.params;
    const { limit = 10, offset = 0, includePrivate = false } = req.query;

    // Check if user has permission to see private events
    const canSeePrivate = req.user && (
      req.user.type === 'admin' ||
      Number(req.user.id) === Number(actorId)
    );

    const events = await getActorEvents(
      actorId,
      Math.min(parseInt(limit), 100), // Max 100 events at once
      parseInt(offset),
      canSeePrivate && includePrivate === 'true'
    );

    res.json(events);
  } catch (error) {
    logger.error('Error in GET /events/actor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;