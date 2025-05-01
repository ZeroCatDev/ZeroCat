import { PrismaClient } from "@prisma/client";
import logger from "../services/logger.js";

const prisma = new PrismaClient();

/**
 * Get a project list by ID
 * @param {number} listId - The list ID
 * @param {number} userId - The current user ID
 * @returns {Promise<object>} - The list with projects
 */
export async function getProjectList(listId, userId) {
  try {
    // Get the list
    const list = await prisma.ow_projects_lists.findUnique({
      where: { id: parseInt(listId) }
    });

    if (!list) {
      return null;
    }

    // Check if the user can access this list
    if (list.state === "private" && list.authorid !== parseInt(userId)) {
      return null;
    }

    // Get the projects in the list
    const listItems = await prisma.ow_projects_list_items.findMany({
      where: { listid: parseInt(listId) }
    });

    const projectIds = listItems.map(item => item.projectid);

    // Get the project details
    const projects = await prisma.ow_projects.findMany({
      where: {
        id: { in: projectIds }
      },
      select: {
        id: true,
        title: true,
        description: true,
        authorid: true,
        state: true,
        view_count: true,
        like_count: true,
        star_count: true,
        time: true
      }
    });

    return {
      ...list,
      projects
    };
  } catch (error) {
    logger.error("Error in getProjectList:", error);
    throw error;
  }
}

/**
 * Get a user's lists and check if a project is in any of them
 * @param {number} userId - The user ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The user's lists with project status
 */
export async function getUserListInfoAndCheak(userId, projectId) {
  try {
    if (!userId) {
      return [];
    }

    // 使用原始 SQL 查询获取用户的列表
    const lists = await prisma.$queryRaw`
      SELECT * FROM ow_projects_lists 
      WHERE authorid = ${parseInt(userId)}
    `;

    // 使用原始 SQL 查询获取项目的列表项
    const listItems = await prisma.$queryRaw`
      SELECT * FROM ow_projects_list_items 
      WHERE projectid = ${parseInt(projectId)}
    `;

    const projectListIds = listItems.map(item => item.listid);

    // 标记包含项目的列表
    const listsWithStatus = lists.map(list => ({
      ...list,
      hasProject: projectListIds.includes(list.id)
    }));

    return listsWithStatus;
  } catch (error) {
    logger.error("Error in getUserListInfoAndCheak:", error);
    throw error;
  }
}

/**
 * Create a new list
 * @param {number} userId - The user ID
 * @param {string} title - The list title
 * @param {string} description - The list description
 * @returns {Promise<object>} - The created list
 */
export async function createList(userId, title, description) {
  try {
    const list = await prisma.ow_projects_lists.create({
      data: {
        authorid: parseInt(userId),
        title,
        description: description || "",
        state: "private",
        updateTime: new Date()
      }
    });

    return list;
  } catch (error) {
    logger.error("Error in createList:", error);
    throw error;
  }
}

/**
 * Delete a list
 * @param {number} userId - The user ID
 * @param {number} listId - The list ID
 * @returns {Promise<object>} - The deleted list
 */
export async function deleteList(userId, listId) {
  try {
    // Check if the list belongs to the user
    const list = await prisma.ow_projects_lists.findFirst({
      where: {
        id: parseInt(listId),
        authorid: parseInt(userId)
      }
    });

    if (!list) {
      throw new Error("List not found or you don't have permission");
    }

    // Delete all list items
    await prisma.ow_projects_list_items.deleteMany({
      where: { listid: parseInt(listId) }
    });

    // Delete the list
    const deletedList = await prisma.ow_projects_lists.delete({
      where: { id: parseInt(listId) }
    });

    return deletedList;
  } catch (error) {
    logger.error("Error in deleteList:", error);
    throw error;
  }
}

/**
 * Add a project to a list
 * @param {number} userId - The user ID
 * @param {number} listId - The list ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The created list item
 */
export async function addProjectToList(userId, listId, projectId) {
  try {
    // 检查列表是否属于用户
    const list = await prisma.$queryRaw`
      SELECT * FROM ow_projects_lists
      WHERE id = ${parseInt(listId)} AND authorid = ${parseInt(userId)}
      LIMIT 1
    `;

    if (!list || list.length === 0) {
      throw new Error("List not found or you don't have permission");
    }

    // 检查项目是否已在列表中
    const existingItem = await prisma.$queryRaw`
      SELECT * FROM ow_projects_list_items
      WHERE listid = ${parseInt(listId)} AND projectid = ${parseInt(projectId)}
      LIMIT 1
    `;

    if (existingItem && existingItem.length > 0) {
      return existingItem[0];
    }

    // 添加项目到列表
    await prisma.$executeRaw`
      INSERT INTO ow_projects_list_items (listid, projectid, createTime)
      VALUES (${parseInt(listId)}, ${parseInt(projectId)}, NOW())
    `;

    // 更新列表的更新时间
    await prisma.$executeRaw`
      UPDATE ow_projects_lists
      SET updateTime = NOW()
      WHERE id = ${parseInt(listId)}
    `;

    return { listid: parseInt(listId), projectid: parseInt(projectId) };
  } catch (error) {
    logger.error("Error in addProjectToList:", error);
    throw error;
  }
}

/**
 * Remove a project from a list
 * @param {number} userId - The user ID
 * @param {number} listId - The list ID
 * @param {number} projectId - The project ID
 * @returns {Promise<object>} - The deleted list item
 */
export async function removeProjectFromList(userId, listId, projectId) {
  try {
    // Check if the list belongs to the user
    const list = await prisma.ow_projects_lists.findFirst({
      where: {
        id: parseInt(listId),
        authorid: parseInt(userId)
      }
    });

    if (!list) {
      throw new Error("List not found or you don't have permission");
    }

    // Remove the project from the list
    const deletedItem = await prisma.ow_projects_list_items.deleteMany({
      where: {
        listid: parseInt(listId),
        projectid: parseInt(projectId)
      }
    });

    // Update the list's update time
    await prisma.ow_projects_lists.update({
      where: { id: parseInt(listId) },
      data: { updateTime: new Date() }
    });

    return deletedItem;
  } catch (error) {
    logger.error("Error in removeProjectFromList:", error);
    throw error;
  }
}

/**
 * Get a user's lists
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} - The user's lists
 */
export async function getUserListInfo(userId) {
  try {
    if (!userId) {
      return [];
    }

    const lists = await prisma.ow_projects_lists.findMany({
      where: { authorid: parseInt(userId) }
    });

    return lists;
  } catch (error) {
    logger.error("Error in getUserListInfo:", error);
    throw error;
  }
}

/**
 * Get a user's public lists
 * @param {number} userId - The user ID
 * @param {number} currentUserId - The current user ID
 * @returns {Promise<Array>} - The user's public lists
 */
export async function getUserListInfoPublic(userId, currentUserId) {
  try {
    const where = { authorid: parseInt(userId) };

    // If not the owner, only show public lists
    if (parseInt(userId) !== parseInt(currentUserId)) {
      where.state = "public";
    }

    const lists = await prisma.ow_projects_lists.findMany({ where });

    return lists;
  } catch (error) {
    logger.error("Error in getUserListInfoPublic:", error);
    throw error;
  }
}

/**
 * Update a list
 * @param {number} userId - The user ID
 * @param {number} listId - The list ID
 * @param {object} data - The update data
 * @returns {Promise<object>} - The updated list
 */
export async function updateList(userId, listId, data) {
  try {
    // Check if the list belongs to the user
    const list = await prisma.ow_projects_lists.findFirst({
      where: {
        id: parseInt(listId),
        authorid: parseInt(userId)
      }
    });

    if (!list) {
      throw new Error("List not found or you don't have permission");
    }

    // Update the list
    const updatedList = await prisma.ow_projects_lists.update({
      where: { id: parseInt(listId) },
      data: {
        title: data.title || list.title,
        description: data.description || list.description,
        state: data.state || list.state,
        updateTime: new Date()
      }
    });

    return updatedList;
  } catch (error) {
    logger.error("Error in updateList:", error);
    throw error;
  }
} 