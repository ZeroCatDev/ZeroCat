import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { prisma } from "../utils/global.js";
import notificationUtils from "./notifications.js";
import { createEvent, TargetTypes } from "./events.js";

const prismaClient = new PrismaClient();

/**
 * Star a project for a user
 * @param {number} userId - The user ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The created star record
 */
export async function starProject(userId, projectId) {
  try {
    const parsedUserId = parseInt(userId);
    const parsedProjectId = parseInt(projectId);

    // 检查项目是否存在
    const project = await prismaClient.ow_projects.findUnique({
      where: { id: parsedProjectId }
    });

    if (!project) {
      throw new Error("项目不存在");
    }

    // 检查是否已经收藏
    const existingStar = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: parsedUserId,
        projectid: parsedProjectId,
      }
    });

    if (existingStar) {
      return existingStar;
    }

    // 创建收藏
    const star = await prismaClient.ow_projects_stars.create({
      data: {
        userid: parsedUserId,
        projectid: parsedProjectId,
        createTime: new Date()
      }
    });

    // 更新项目收藏数
    await prismaClient.ow_projects.update({
      where: { id: parsedProjectId },
      data: {
        star_count: {
          increment: 1
        }
      }
    });

    // 创建收藏事件
    await createEvent(
      "project_star",
      {
        event_type: "project_star",
        actor_id: parsedUserId,
        target_type: TargetTypes.PROJECT,
        target_id: parsedProjectId,
        project_name: project.name,
        project_title: project.title || "Scratch新项目",
        project_type: project.type || "text",
        project_state: project.state || "private",
        star_count: (project.star_count || 0) + 1,
        metadata: {
          action: "star"
        }
      }
    );

    // 如果项目不是用户自己的，创建通知
    if (project.authorid !== parsedUserId) {
      await createStarNotification(project, parsedUserId);
    }

    return star;
  } catch (error) {
    logger.error("Error in starProject:", error);
    throw error;
  }
}

/**
 * Unstar a project for a user
 * @param {number} userId - The user ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The deleted star record
 */
export async function unstarProject(userId, projectId) {
  try {
    const parsedUserId = parseInt(userId);
    const parsedProjectId = parseInt(projectId);

    // 检查项目是否存在
    const project = await prismaClient.ow_projects.findUnique({
      where: { id: parsedProjectId }
    });

    if (!project) {
      throw new Error("项目不存在");
    }

    // 检查用户是否已收藏该项目
    const existingStar = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: parsedUserId,
        projectid: parsedProjectId,
      }
    });

    if (!existingStar) {
      return { count: 0 };
    }

    // 删除收藏记录
    const star = await prismaClient.ow_projects_stars.deleteMany({
      where: {
        userid: parsedUserId,
        projectid: parsedProjectId,
      }
    });

    // 更新项目收藏数
    await prismaClient.ow_projects.update({
      where: { id: parsedProjectId },
      data: {
        star_count: {
          decrement: 1
        }
      }
    });

    return star;
  } catch (error) {
    logger.error("Error in unstarProject:", error);
    throw error;
  }
}

/**
 * Check if a user has starred a project
 * @param {number} userId - The user ID
 * @param {number} projectId - The project ID
 * @returns {Promise<boolean>} - True if the user has starred the project
 */
export async function getProjectStarStatus(userId, projectId) {
  try {
    if (!userId) {
      return false;
    }

    const parsedUserId = parseInt(userId);
    const parsedProjectId = parseInt(projectId);

    const star = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: parsedUserId,
        projectid: parsedProjectId,
      }
    });

    return !!star;
  } catch (error) {
    logger.error("Error in getProjectStarStatus:", error);
    throw error;
  }
}

/**
 * Get the number of stars for a project
 * @param {number} projectId - The project ID
 * @returns {Promise<number>} - The number of stars
 */
export async function getProjectStars(projectId) {
  try {
    const parsedProjectId = parseInt(projectId);

    const count = await prismaClient.ow_projects_stars.count({
      where: {
        projectid: parsedProjectId,
      }
    });

    return count;
  } catch (error) {
    logger.error("Error in getProjectStars:", error);
    throw error;
  }
}

/**
 * Create a notification for project star
 * @private
 * @param {object} project - The project object
 * @param {number} userId - The user ID who starred the project
 */
async function createStarNotification(project, userId) {
  try {
    const actorInfo = await notificationUtils.getActorInfo(userId);

    if (actorInfo) {
      const notificationData = notificationUtils.createProjectNotificationData({
        notificationType: notificationUtils.NotificationTypes.PROJECT_STAR,
        userId: project.authorid,
        actorId: userId,
        projectId: project.id,
        projectTitle: project.title,
        additionalData: {
          star_count: (project.star_count || 0) + 1,
          acting_user_name: actorInfo.display_name,
          acting_user_avatar_template: actorInfo.acting_user_avatar_template
        }
      });

      await notificationUtils.createNotification(notificationData);
      logger.debug(`Created star notification for user ${project.authorid}`);
    }
  } catch (error) {
    logger.error("Error creating star notification:", error);
    // Don't throw the error as notification failure shouldn't affect the main flow
  }
}