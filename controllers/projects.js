import logger from "../utils/logger.js";
import { prisma } from "../utils/global.js";

import { createHash } from "crypto";
import { getUsersByList } from "./users.js";

async function getProjectsByList(list, userid = null) {
  const select = projectSelectionFields();
  const projectIds = list.map(Number);
  const projects = await prisma.ow_projects.findMany({
    where: { id: { in: projectIds } },
    select,
  });
  if (userid) {
    return projects.filter(
      (project) => !(project.state === "private" && project.authorid !== userid)
    );
  }
  return projects;
}

async function getProjectById(projectId, userid = null) {
  const select = projectSelectionFields();
  const project = await prisma.ow_projects.findFirst({
    where: { id: Number(projectId) },
    select,
  });
  if (!project) {
    return null;
  }
  if (userid && project.state === "private" && project.authorid !== userid) {
    return null;
  }
  return project;
}

async function getProjectsAndUsersByProjectsList(list, userid = null) {
  const projects = await getProjectsByList(list, userid);
  const userslist = [...new Set(projects.map((project) => project.authorid))];
  const users = await getUsersByList(userslist);
  return { projects, users };
}

function extractProjectData(body) {
  const fields = [
    "type",
    "licence",
    "state",
    "title",
    "description",
    "history",
  ];
  return fields.reduce(
    (acc, field) => (body[field] ? { ...acc, [field]: body[field] } : acc),
    {}
  );
}

const extractProjectTags = (tags) =>
  // 如果某项为空，则删除
  Array.isArray(tags)
    ? tags.map(String).filter((tag) => tag)
    : tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);

async function handleTagsChange(projectId, tags) {
  const existingTags = await prisma.ow_projects_tags.findMany({
    where: { projectid: projectId },
    select: { id: true, name: true },
  });
  tags = extractProjectTags(tags);

  const tagNames = new Set(tags);
  await Promise.all(
    existingTags.map(async (tag) => {
      if (!tagNames.has(tag.name)) {
        await prisma.ow_projects_tags.delete({ where: { id: tag.id } });
      } else {
        tagNames.delete(tag.name);
      }
    })
  );

  await Promise.all(
    [...tagNames].map(async (name) => {
      await prisma.ow_projects_tags.create({
        data: { projectid: projectId, name },
      });
    })
  );
}

/**
 * Set project file
 * @param {string | Object} source - Project source
 * @returns {Promise<string>} - SHA256 of the source
 */
function setProjectFile(source) {
  const sourcedata = isJson(source) ? JSON.stringify(source) : source;
  const sha256 = createHash("sha256").update(sourcedata).digest("hex");
  prisma.ow_projects_file
    .create({ data: { sha256, source: sourcedata }})
    .catch(logger.error);
  return sha256;
}

/**
 * Get project file
 * @param {string} sha256 - SHA256 of the source
 * @returns {Promise<{ source: string }>} - Project source
 */
async function getProjectFile(sha256) {
  return prisma.ow_projects_file.findFirst({
    where: { sha256 },
    select: { source: true },
  });
}

/**
 * Handle error response
 * @param {Response} res - Response object
 * @param {Error} err - Error object
 * @param {string} msg - Error message
 * @returns {void}
 */
function handleError(res, err, msg) {
  logger.error(err);
  res.status(500).send({ status: "0", msg, error: err });
}

/**
 * Select project information fields
 * @returns {Object} - Selected fields
 */
function projectSelectionFields() {
  return {
    id: true,
    type: true,
    licence: true,
    authorid: true,
    state: true,
    view_count: true,
    time: true,
    title: true,
    description: true,
    tags: true,
    source: true,
  };
}

/**
 * Select author information fields
 * @returns {Object} - Selected fields
 */
function authorSelectionFields() {
  return {
    id: true,
    username: true,
    display_name: true,
    state: true,
    regTime: true,
    motto: true,
    images: true,
  };
}

// 工具函数：判断是否为有效 JSON
function isJson(str) {
  try {
    JSON.stringify(str);
    return true;
  } catch (error) {
    logger.debug(error);
    return false;
  }
}

export {
  getProjectsByList,
  getUsersByList,
  getProjectsAndUsersByProjectsList,
  extractProjectData,
  isJson,
  setProjectFile,
  getProjectFile,
  projectSelectionFields,
  authorSelectionFields,
  extractProjectTags,
  handleTagsChange,
  getProjectById,
};
