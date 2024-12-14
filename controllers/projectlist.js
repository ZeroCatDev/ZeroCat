import logger from "../utils/logger.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { getProjectsAndUsersByProjectsList } from "./projects.js";

// Standardize variable names and functions
const cleanAndDeduplicateList = (list) =>
  list.filter(Boolean).reduce((acc, item) => {
    if (!acc.includes(item)) {
      acc.push(item);
    }
    return acc;
  }, []);

const handleError = (error) => {
  logger.error(error);
  throw new Error(error.message || "An error occurred");
};

// Add project to projects list
const addProjectToUserProjectlist = async ({ listId, projectId, userId }) => {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(listId), authorid: Number(userId) },
    });

    if (!project) throw new Error("Project list does not exist");

    const list = cleanAndDeduplicateList([
      ...project.list.split(","),
      projectId,
    ]);

    return await prisma.ow_projects_lists.update({
      where: { id: Number(listId), authorid: Number(userId) },
      data: { list: list.join() },
    });
  } catch (error) {
    handleError(error);
  }
};

// Remove project from projects list
const removeProjectFromUserProjectlist = async ({ listId, projectId, userId }) => {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(listId), authorid: Number(userId) },
    });

    if (!project) throw new Error("Project list does not exist");

    const list = cleanAndDeduplicateList(
      project.list.split(",").filter((item) => item !== String(projectId))
    );

    return await prisma.ow_projects_lists.update({
      where: { id: Number(listId), authorid: Number(userId) },
      data: { list: list.join() },
    });
  } catch (error) {
    handleError(error);
  }
};

// Create new projects list
const createProjectlist = async (userId) => {
  try {
    return await prisma.ow_projects_lists.create({
      data: {
        authorid: userId,
        list: "",
        state: "private",
        title: "New project list",
        description: "New project list",
      },
    });
  } catch (error) {
    handleError(error);
  }
};

// Get specified project list details
const getProjectlist = async ({ listId, userId }) => {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(listId) },
    });

    if (
      !project ||
      (project.state === "private" && project.authorid !== userId)
    ) {
      return "Project list does not exist or is private, please check or login";
    }

    const list = cleanAndDeduplicateList(project.list.split(","));
    project.data = await getProjectsAndUsersByProjectsList(list);

    return project;
  } catch (error) {
    handleError(error);
  }
};

// Get user's all projects list
const getUserProjectlist = async ({ userId, state }) => {
  try {
    return await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(userId), state: { in: state } },
      select: {
        id: true,
        authorid: true,
        title: true,
        description: true,
        state: true,
        list: true,
        createTime: true,
        updateTime: true,
      },
    });
  } catch (error) {
    handleError(error);
  }
};

// Get user's public projects list
const getUserPublicProjectlist = async (userId) => {
  try {
    return await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(userId), state: "public" },
      select: {
        id: true,
        authorid: true,
        title: true,
        description: true,
        state: true,
        list: true,
        createTime: true,
        updateTime: true,
      },
    });
  } catch (error) {
    handleError(error);
  }
};

// Check if project is in user's list
const checkProjectlistWithUser = async ({ projectId, userId }) => {
  try {
    if (!projectId && !userId) return "Parameter error";

    const projects = await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(userId) },
    });
    logger.info(projects);
    return projects.map((item) => {
      const listArray = cleanAndDeduplicateList(item.list.split(","));
      item.include = listArray.includes(String(projectId));
      return item;
    });
  } catch (error) {
    handleError(error);
  }
};

// Update project list
const updateProjectlist = async ({ listId, title, description, state, list }) => {
  try {
    const keys = ["title", "description", "state", "list"];
    const resultInfo = keys.reduce((acc, key) => {
      if (list[key]) acc[key] = list[key];
      return acc;
    }, {});

    if (resultInfo.list) {
      resultInfo.list = cleanAndDeduplicateList(
        resultInfo.list.split(",")
      ).join();
    }

    return await prisma.ow_projects_lists.update({
      where: { id: Number(listId) },
      data: resultInfo,
    });
  } catch (error) {
    handleError(error);
  }
};

// Delete project list
const deleteProjectlist = async ({ listId, userId }) => {
  try {
    await prisma.ow_projects_lists.delete({
      where: { id: Number(listId), authorid: Number(userId) },
    });
    return "Deleted project list";
  } catch (error) {
    handleError(error);
  }
};

export {
  addProjectToUserProjectlist,
  removeProjectFromUserProjectlist,
  getProjectlist,
  deleteProjectlist,
  updateProjectlist,
  createProjectlist,
  getUserProjectlist,
  getUserPublicProjectlist,
  checkProjectlistWithUser,
};

