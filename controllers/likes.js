import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";
import notificationController from "./notifications.js";
import { NotificationTypes } from "./notifications.js";
import notificationUtils from "../utils/notificationUtils.js";

/**
 * Like a project
 *
 * @param {number} userId - User ID liking the project
 * @param {number} projectId - Project ID being liked
 * @returns {Promise<Object>} Like information
 */
export async function likeProject(userId, projectId) {
  try {
    // Check if project exists
    const project = await prisma.ow_projects.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new Error("项目不存在");
    }

    // Check if already liked
    const existingLike = await prisma.$queryRaw`
      SELECT * FROM project_likes
      WHERE user_id = ${userId} AND project_id = ${projectId}
      LIMIT 1
    `;

    if (existingLike && existingLike.length > 0) {
      return existingLike[0];
    }

    // Create like record
    const like = await prisma.$executeRaw`
      INSERT INTO project_likes (user_id, project_id, created_at)
      VALUES (${userId}, ${projectId}, NOW())
    `;

    // Update project like count
    await prisma.ow_projects.update({
      where: { id: projectId },
      data: {
        like_count: {
          increment: 1
        }
      }
    });

    // Create notification if project owner is not the same as liker
    if (project.authorid !== userId) {
      // Create notification data
      const notificationData = await notificationUtils.createProjectNotificationData({
        notificationType: NotificationTypes.PROJECT_LIKE,
        userId: project.authorid,
        actorId: userId,
        projectId: projectId,
        projectTitle: project.title,
        additionalData: {
          like_count: (project.like_count || 0) + 1
        }
      });

      // Create notification
      await notificationController.createNotification(notificationData);
      logger.debug(`Created like notification for user ${project.authorid}`);
    }

    return { userId, projectId };
  } catch (error) {
    logger.error("Error in likeProject:", error);
    throw error;
  }
}

/**
 * Unlike a project
 *
 * @param {number} userId - User ID unliking the project
 * @param {number} projectId - Project ID being unliked
 * @returns {Promise<Object>} Unlike information
 */
export async function unlikeProject(userId, projectId) {
  try {
    // Check if like exists
    const existingLike = await prisma.$queryRaw`
      SELECT * FROM project_likes
      WHERE user_id = ${userId} AND project_id = ${projectId}
      LIMIT 1
    `;

    if (!existingLike || existingLike.length === 0) {
      return { count: 0 };
    }

    // Remove like
    const result = await prisma.$executeRaw`
      DELETE FROM project_likes
      WHERE user_id = ${userId} AND project_id = ${projectId}
    `;

    // Update project like count
    await prisma.ow_projects.update({
      where: { id: projectId },
      data: {
        like_count: {
          decrement: 1
        }
      }
    });

    return { count: result };
  } catch (error) {
    logger.error("Error in unlikeProject:", error);
    throw error;
  }
}

/**
 * Like a comment
 *
 * @param {number} userId - User ID liking the comment
 * @param {number} commentId - Comment ID being liked
 * @returns {Promise<Object>} Like information
 */
export async function likeComment(userId, commentId) {
  try {
    // Check if comment exists
    const comment = await prisma.ow_comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      throw new Error("评论不存在");
    }

    // Check if already liked
    const existingLike = await prisma.$queryRaw`
      SELECT * FROM comment_likes
      WHERE user_id = ${userId} AND comment_id = ${commentId}
      LIMIT 1
    `;

    if (existingLike && existingLike.length > 0) {
      return existingLike[0];
    }

    // Create like record
    const like = await prisma.$executeRaw`
      INSERT INTO comment_likes (user_id, comment_id, created_at)
      VALUES (${userId}, ${commentId}, NOW())
    `;

    // Create notification if comment owner is not the same as liker
    if (comment.user_id !== userId) {
      // Get context information for the comment
      const contextType = comment.page_type || 'unknown';
      const contextId = comment.page_id || 0;

      // Create notification data
      const notificationData = await notificationUtils.createCommentNotificationData({
        notificationType: NotificationTypes.COMMENT_LIKE,
        userId: comment.user_id,
        actorId: userId,
        commentId: commentId,
        commentText: comment.text,
        contextType,
        contextId,
        additionalData: {}
      });

      // Create notification
      await notificationController.createNotification(notificationData);
      logger.debug(`Created comment like notification for user ${comment.user_id}`);
    }

    return { userId, commentId };
  } catch (error) {
    logger.error("Error in likeComment:", error);
    throw error;
  }
}

/**
 * Unlike a comment
 *
 * @param {number} userId - User ID unliking the comment
 * @param {number} commentId - Comment ID being unliked
 * @returns {Promise<Object>} Unlike information
 */
export async function unlikeComment(userId, commentId) {
  try {
    // Check if like exists
    const existingLike = await prisma.$queryRaw`
      SELECT * FROM comment_likes
      WHERE user_id = ${userId} AND comment_id = ${commentId}
      LIMIT 1
    `;

    if (!existingLike || existingLike.length === 0) {
      return { count: 0 };
    }

    // Remove like
    const result = await prisma.$executeRaw`
      DELETE FROM comment_likes
      WHERE user_id = ${userId} AND comment_id = ${commentId}
    `;

    return { count: result };
  } catch (error) {
    logger.error("Error in unlikeComment:", error);
    throw error;
  }
}

export default {
  likeProject,
  unlikeProject,
  likeComment,
  unlikeComment
};