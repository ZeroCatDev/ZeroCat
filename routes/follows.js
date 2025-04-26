import express from 'express';
import { needLogin } from "../middleware/auth.js";
import followsController from "../controllers/follows.js";
import errorHandlerService from "../services/errorHandler.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * Handle API errors with proper response formatting
 * @param {Response} res - Express response object
 * @param {Error} error - Error object
 */
function handleError(res, error) {
  logger.error('API Error:', error);
  const statusCode = error.status || 500;
  const errorMessage = process.env.NODE_ENV === 'production'
    ? '操作失败'
    : error.message || '未知错误';

  res.status(statusCode).json({
    success: false,
    error: {
      message: errorMessage,
      code: statusCode
    }
  });
}

/**
 * @route POST /api/follows/:userId
 * @desc Follow a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to follow
 * @param {string} [note] - Optional note about the follow
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the relationship record
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "source_user_id": 456,
 *     "target_user_id": 789,
 *     "relationship_type": "follow",
 *     "created_at": "2023-06-15T10:30:45Z",
 *     "updated_at": "2023-06-15T10:30:45Z",
 *     "metadata": { "note": "我们在某课程上认识的" }
 *   }
 * }
 *
 * // Error response
 * {
 *   "success": false,
 *   "error": {
 *     "message": "不能关注自己",
 *     "code": 400
 *   }
 * }
 */
router.post('/:userId', needLogin, async (req, res) => {
  try {
    const followerId = res.locals.userid;
    const followedId = parseInt(req.params.userId);
    const note = '';

    const result = await followsController.followUser(followerId, followedId, note);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route DELETE /api/follows/:userId
 * @desc Unfollow a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to unfollow
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the count of relationships deleted
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "count": 1
 *   }
 * }
 *
 * // When relationship didn't exist
 * {
 *   "success": true,
 *   "data": {
 *     "count": 0
 *   }
 * }
 */
router.delete('/:userId', needLogin, async (req, res) => {
  try {
    const followerId = res.locals.userid;
    const followedId = parseInt(req.params.userId);

    const result = await followsController.unfollowUser(followerId, followedId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route POST /api/follows/block/:userId
 * @desc Block a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to block
 * @param {string} [reason] - Optional reason for blocking
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the relationship record
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "id": 456,
 *     "source_user_id": 123,
 *     "target_user_id": 789,
 *     "relationship_type": "block",
 *     "created_at": "2023-06-15T10:30:45Z",
 *     "updated_at": "2023-06-15T10:30:45Z",
 *     "metadata": { "reason": "发布不适当内容" }
 *   }
 * }
 *
 * // Error response
 * {
 *   "success": false,
 *   "error": {
 *     "message": "不能拉黑自己",
 *     "code": 400
 *   }
 * }
 */
router.post('/block/:userId', needLogin, async (req, res) => {
  try {
    const blockerId = res.locals.userid;
    const blockedId = parseInt(req.params.userId);
    const reason = req.body.reason || '';

    const result = await followsController.blockUser(blockerId, blockedId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route DELETE /api/follows/block/:userId
 * @desc Unblock a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to unblock
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the count of relationships deleted
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "count": 1
 *   }
 * }
 *
 * // When block relationship didn't exist
 * {
 *   "success": true,
 *   "data": {
 *     "count": 0
 *   }
 * }
 */
router.delete('/block/:userId', needLogin, async (req, res) => {
  try {
    const blockerId = res.locals.userid;
    const blockedId = parseInt(req.params.userId);

    const result = await followsController.unblockUser(blockerId, blockedId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/followers/:userId
 * @desc Get followers of a user
 * @access Public
 *
 * @param {string} userId - The ID of the user whose followers to retrieve
 * @param {number} [limit=20] - Maximum number of followers to return
 * @param {number} [offset=0] - Offset for pagination
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains followers information
 * @returns {Array} data.followers - Array of follower user objects
 * @returns {number} data.total - Total number of followers
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "followers": [
 *       {
 *         "id": 123,
 *         "username": "user1",
 *         "display_name": "User One",
 *         "images": "abc123def456",
 *         "avatar": "https://example.com/avatar/abc123def456",
 *         "relationship": {
 *           "id": 456,
 *           "created_at": "2023-06-15T10:30:45Z"
 *         }
 *       },
 *       // More followers...
 *     ],
 *     "total": 42,
 *     "limit": 20,
 *     "offset": 0
 *   }
 * }
 */
router.get('/followers/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await followsController.getUserFollowers(userId, limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/following/:userId
 * @desc Get users followed by a user
 * @access Public
 *
 * @param {string} userId - The ID of the user whose following list to retrieve
 * @param {number} [limit=20] - Maximum number of users to return
 * @param {number} [offset=0] - Offset for pagination
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains following information
 * @returns {Array} data.following - Array of followed user objects
 * @returns {number} data.total - Total number of following
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "following": [
 *       {
 *         "id": 789,
 *         "username": "user2",
 *         "display_name": "User Two",
 *         "images": "xyz789abc",
 *         "avatar": "https://example.com/avatar/xyz789abc",
 *         "relationship": {
 *           "id": 789,
 *           "created_at": "2023-06-15T10:30:45Z"
 *         }
 *       },
 *       // More followed users...
 *     ],
 *     "total": 35,
 *     "limit": 20,
 *     "offset": 0
 *   }
 * }
 */
router.get('/following/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await followsController.getUserFollowing(userId, limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/blocked
 * @desc Get users blocked by the logged in user
 * @access Private (requires authentication)
 *
 * @param {number} [limit=20] - Maximum number of blocked users to return
 * @param {number} [offset=0] - Offset for pagination
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains blocked users information
 * @returns {Array} data.blocked - Array of blocked user objects
 * @returns {number} data.total - Total number of blocked users
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "blocked": [
 *       {
 *         "id": 555,
 *         "username": "blocked_user",
 *         "display_name": "Blocked User",
 *         "images": "def456ghi789",
 *         "avatar": "https://example.com/avatar/def456ghi789",
 *         "relationship": {
 *           "id": 123,
 *           "created_at": "2023-06-15T10:30:45Z"
 *         }
 *       },
 *       // More blocked users...
 *     ],
 *     "total": 5,
 *     "limit": 20,
 *     "offset": 0
 *   }
 * }
 */
router.get('/blocked', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await followsController.getUserBlocked(userId, limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/check/:userId
 * @desc Check if logged in user is following a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to check follow status with
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains follow status information
 * @returns {boolean} data.isFollowing - Whether the user is being followed
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "isFollowing": true
 *   }
 * }
 */
router.get('/check/:userId', needLogin, async (req, res) => {
  try {
    const followerId = res.locals.userid;
    const followedId = parseInt(req.params.userId);

    const isFollowing = await followsController.isFollowing(followerId, followedId);
    res.json({ success: true, data: { isFollowing } });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/check-block/:userId
 * @desc Check if logged in user has blocked a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to check block status with
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains block status information
 * @returns {boolean} data.isBlocking - Whether the user is being blocked
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "isBlocking": false
 *   }
 * }
 */
router.get('/check-block/:userId', needLogin, async (req, res) => {
  try {
    const blockerId = res.locals.userid;
    const blockedId = parseInt(req.params.userId);

    const isBlocking = await followsController.isBlocking(blockerId, blockedId);
    res.json({ success: true, data: { isBlocking } });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/relationships/:userId
 * @desc Get all relationships between logged in user and another user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to get relationships with
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains relationship information
 * @returns {boolean} data.isFollowing - Whether the logged in user follows the other user
 * @returns {boolean} data.isFollowedBy - Whether the logged in user is followed by the other user
 * @returns {boolean} data.isBlocking - Whether the logged in user blocks the other user
 * @returns {boolean} data.isBlockedBy - Whether the logged in user is blocked by the other user
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "isFollowing": true,
 *     "isFollowedBy": false,
 *     "isBlocking": false,
 *     "isBlockedBy": false
 *   }
 * }
 */
router.get('/relationships/:userId', needLogin, async (req, res) => {
  try {
    const userId1 = res.locals.userid;
    const userId2 = parseInt(req.params.userId);

    const relationships = await followsController.getRelationshipsBetweenUsers(userId1, userId2);
    res.json({ success: true, data: relationships });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route PATCH /api/follows/note/:userId
 * @desc Update note for a followed user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the followed user
 * @param {string} note - Note to add to the follow relationship
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the updated relationship record
 *
 * @example
 * // Request body
 * {
 *   "note": "我们在某课程上认识的"
 * }
 *
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "source_user_id": 456,
 *     "target_user_id": 789,
 *     "relationship_type": "follow",
 *     "created_at": "2023-06-15T10:30:45Z",
 *     "updated_at": "2023-06-15T11:20:15Z",
 *     "metadata": { "note": "我们在某课程上认识的" }
 *   }
 * }
 *
 * // Error response
 * {
 *   "success": false,
 *   "error": {
 *     "message": "关注关系不存在",
 *     "code": 404
 *   }
 * }
 */
router.patch('/note/:userId', needLogin, async (req, res) => {
  try {
    const followerId = res.locals.userid;
    const followedId = parseInt(req.params.userId);
    const { note } = req.body;

    if (!note && note !== '') {
      return res.status(400).json({
        success: false,
        error: {
          message: '备注不能为空',
          code: 400
        }
      });
    }

    const result = await followsController.updateFollowNote(followerId, followedId, note);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route PATCH /api/follows/block-reason/:userId
 * @desc Update reason for blocking a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the blocked user
 * @param {string} reason - Reason for blocking
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the updated relationship record
 *
 * @example
 * // Request body
 * {
 *   "reason": "发布不适当内容"
 * }
 *
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "id": 456,
 *     "source_user_id": 123,
 *     "target_user_id": 789,
 *     "relationship_type": "block",
 *     "created_at": "2023-06-15T10:30:45Z",
 *     "updated_at": "2023-06-15T11:20:15Z",
 *     "metadata": { "reason": "发布不适当内容" }
 *   }
 * }
 *
 * // Error response
 * {
 *   "success": false,
 *   "error": {
 *     "message": "拉黑关系不存在",
 *     "code": 404
 *   }
 * }
 */
router.patch('/block-reason/:userId', needLogin, async (req, res) => {
  try {
    const blockerId = res.locals.userid;
    const blockedId = parseInt(req.params.userId);
    const { reason } = req.body;

    if (!reason && reason !== '') {
      return res.status(400).json({
        success: false,
        error: {
          message: '拉黑原因不能为空',
          code: 400
        }
      });
    }

    const result = await followsController.updateBlockReason(blockerId, blockedId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * @route GET /api/follows/notes/:userId
 * @desc Get notes and reasons for relationship with a user
 * @access Private (requires authentication)
 *
 * @param {string} userId - The ID of the user to get notes for
 *
 * @returns {Object} Response object
 * @returns {boolean} success - Indicates if operation was successful
 * @returns {Object} data - Contains the notes and reasons
 * @returns {Object|null} data.follow - Follow relationship notes if exists
 * @returns {Object|null} data.block - Block relationship reason if exists
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "data": {
 *     "follow": {
 *       "note": "我们在某课程上认识的",
 *       "created_at": "2023-06-15T10:30:45Z",
 *       "updated_at": "2023-06-15T11:20:15Z"
 *     },
 *     "block": null
 *   }
 * }
 *
 * // When both relationships exist
 * {
 *   "success": true,
 *   "data": {
 *     "follow": {
 *       "note": "我们在某课程上认识的",
 *       "created_at": "2023-06-15T10:30:45Z",
 *       "updated_at": "2023-06-15T11:20:15Z"
 *     },
 *     "block": {
 *       "reason": "发布不适当内容",
 *       "created_at": "2023-06-15T12:30:45Z",
 *       "updated_at": "2023-06-15T13:20:15Z"
 *     }
 *   }
 * }
 *
 * // When no relationships exist
 * {
 *   "success": true,
 *   "data": {
 *     "follow": null,
 *     "block": null
 *   }
 * }
 */
router.get('/notes/:userId', needLogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const targetUserId = parseInt(req.params.userId);

    const notes = await followsController.getRelationshipNotes(userId, targetUserId);
    res.json({ success: true, data: notes });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;