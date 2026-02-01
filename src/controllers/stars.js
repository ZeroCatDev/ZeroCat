import { prisma } from '../services/prisma.js';

import logger from "../services/logger.js";
import {createEvent} from "./events.js";


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
        const project = await prisma.ow_projects.findUnique({
            where: {id: parsedProjectId}
        });

        if (!project) {
            throw new Error("项目不存在");
        }

        // 检查是否已经收藏
        const existingStar = await prisma.ow_projects_stars.findFirst({
            where: {
                userid: parsedUserId,
                projectid: parsedProjectId,
            }
        });

        if (existingStar) {
            return existingStar;
        }

        // 创建收藏
        const star = await prisma.ow_projects_stars.create({
            data: {
                userid: parsedUserId,
                projectid: parsedProjectId,
                createTime: new Date()
            }
        });

        // 更新项目收藏数
        await prisma.ow_projects.update({
            where: {id: parsedProjectId},
            data: {
                star_count: {
                    increment: 1
                }
            }
        });

        // 创建收藏事件
        await createEvent({
            eventType: "project_star",
            actorId: parsedUserId,

            targetType: "project",
            targetId: parsedProjectId,
            eventData: {
                NotificationTo: [project.authorid]
            }
        });


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
        const project = await prisma.ow_projects.findUnique({
            where: {id: parsedProjectId}
        });

        if (!project) {
            throw new Error("项目不存在");
        }

        // 检查用户是否已收藏该项目
        const existingStar = await prisma.ow_projects_stars.findFirst({
            where: {
                userid: parsedUserId,
                projectid: parsedProjectId,
            }
        });

        if (!existingStar) {
            return {count: 0};
        }

        // 删除收藏记录
        const star = await prisma.ow_projects_stars.deleteMany({
            where: {
                userid: parsedUserId,
                projectid: parsedProjectId,
            }
        });

        // 更新项目收藏数
        await prisma.ow_projects.update({
            where: {id: parsedProjectId},
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

        const star = await prisma.ow_projects_stars.findFirst({
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

        const count = await prisma.ow_projects_stars.count({
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
