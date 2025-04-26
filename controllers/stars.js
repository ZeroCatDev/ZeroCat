import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { prisma } from "../utils/global.js";
import notificationController from "./notifications.js";
import { NotificationTypes } from "./notifications.js";
import notificationUtils from "../utils/notificationUtils.js";

const prismaClient = new PrismaClient();

/**
 * Star a project for a user
 * @param {number} userId - The user ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The created star record
 */
export async function starProject(userId, projectId) {
  try {
    // 检查项目是否存在
    const project = await prismaClient.ow_projects.findUnique({
      where: { id: parseInt(projectId) }
    });

    if (!project) {
      throw new Error("项目不存在");
    }

    // 检查是否已经收藏
    const existingStar = await prismaClient.$queryRaw`
      SELECT * FROM ow_projects_stars
      WHERE userid = ${parseInt(userId)} AND projectid = ${parseInt(projectId)}
      LIMIT 1
    `;

    if (existingStar && existingStar.length > 0) {
      return existingStar[0];
    }

    // 创建收藏
    const star = await prismaClient.$executeRaw`
      INSERT INTO ow_projects_stars (userid, projectid, createTime)
      VALUES (${parseInt(userId)}, ${parseInt(projectId)}, NOW())
    `;

    // 更新项目收藏数
    await prismaClient.$executeRaw`
      UPDATE ow_projects
      SET star_count = star_count + 1
      WHERE id = ${parseInt(projectId)}
    `;

    // 如果项目不是用户自己的，创建通知
    if (project.authorid !== userId) {
      // 获取用户信息作为通知行为者
      const actorInfo = await notificationUtils.getActorInfo(userId);

      // 创建通知数据
      if (actorInfo) {
        const notificationData = notificationUtils.formatNotificationData({
          notificationType: NotificationTypes.PROJECT_STAR,
          userId: project.authorid,
          actorId: userId,
          targetType: 'project',
          targetId: projectId,
          data: {
            project_id: projectId,
            project_title: project.title,
            star_count: (project.star_count || 0) + 1,
            acting_user_name: actorInfo.display_name,
            acting_user_avatar_template: actorInfo.acting_user_avatar_template
          }
        });

        // 创建通知
        await notificationController.createNotification(notificationData);
        logger.debug(`Created star notification for user ${project.authorid}`);
      }
    }

    return { userid: parseInt(userId), projectid: parseInt(projectId) };
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
    // 检查用户是否已收藏该项目
    const existingStar = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: parseInt(userId),
        projectid: parseInt(projectId)
      }
    });

    if (!existingStar) {
      // 如果用户未收藏该项目，直接返回
      return { count: 0 };
    }

    // 删除收藏记录
    const star = await prismaClient.ow_projects_stars.deleteMany({
      where: {
        userid: parseInt(userId),
        projectid: parseInt(projectId)
      }
    });

    // 尝试更新项目的收藏数，但不要因为项目不存在而失败
    try {
      await prismaClient.$executeRaw`
        UPDATE ow_projects
        SET star_count = GREATEST(star_count - 1, 0)
        WHERE id = ${parseInt(projectId)}
      `;
    } catch (updateError) {
      // 如果更新失败，记录错误但不中断流程
      logger.warn(`Failed to update star count for project ${projectId}: ${updateError.message}`);
    }

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

    const star = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: parseInt(userId),
        projectid: parseInt(projectId)
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
    const count = await prismaClient.ow_projects_stars.count({
      where: {
        projectid: parseInt(projectId)
      }
    });

    return count;
  } catch (error) {
    logger.error("Error in getProjectStars:", error);
    throw error;
  }
}

/**
 * 处理用户收藏
 */
export async function addStar(userId, projectId) {
  try {
    // 检查项目是否存在
    const project = await prismaClient.ow_projects.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("项目不存在");
    }

    // 检查是否已经收藏
    const existingStar = await prismaClient.ow_projects_stars.findFirst({
      where: {
        userid: userId,
        projectid: projectId,
      },
    });

    if (existingStar) {
      throw new Error("项目已收藏");
    }

    // 增加星标
    const star = await prismaClient.ow_projects_stars.create({
      data: {
        userid: userId,
        projectid: projectId,
      },
    });

    // 更新项目星标计数
    await prismaClient.ow_projects.update({
      where: { id: projectId },
      data: {
        star_count: {
          increment: 1,
        },
      },
    });

    // 如果项目不是用户自己的，创建通知
    if (project.authorid !== userId) {
      // 获取用户信息作为通知行为者
      const actorInfo = await notificationUtils.getActorInfo(userId);

      // 创建通知数据
      if (actorInfo) {
        const notificationData = notificationUtils.formatNotificationData({
          notificationType: NotificationTypes.PROJECT_STAR,
          userId: project.authorid,
          actorId: userId,
          targetType: 'project',
          targetId: projectId,
          data: {
            project_id: projectId,
            project_title: project.title,
            star_count: (project.star_count || 0) + 1,
            acting_user_name: actorInfo.display_name,
            acting_user_avatar_template: actorInfo.acting_user_avatar_template
          }
        });

        // 创建通知
        await notificationController.createNotification(notificationData);
        logger.debug(`Created star notification for user ${project.authorid}`);
      }
    }

    return star;
  } catch (error) {
    logger.error("添加收藏失败:", error);
    throw error;
  }
}