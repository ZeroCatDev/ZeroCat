import logger from "../logger.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { createHash } from "crypto";
import { getUsersByList } from "./users.js";

/**
 * Get projects by list of IDs
 * @param {Array<number>} list - List of project IDs
 * @param {number} userid - User ID
 * @returns {Promise<Array<Project>>}
 */
async function getProjectsByList(list, userid) {
  const select = projectSelectionFields();
  const projectIds = list.map(Number);
  const projects = await prisma.ow_projects.findMany({
    where: { id: { in: projectIds } },
    select,
  });
  return projects.filter(
    (project) => !(project.state === "private" && project.authorid !== userid)
  );
}

/**
 * Get projects and users by list of IDs
 * @param {Array<number>} list - List of project IDs
 * @param {number} userid - User ID
 * @returns {Promise<{ projects: Array<Project>, users: Array<User>}>}
 */
async function getProjectsAndUsersByProjectsList(list, userid) {
  const projects = await getProjectsByList(list, userid);
  const userslist = [...new Set(projects.map((project) => project.authorid))];
  const users = await getUsersByList(userslist);
  return { projects, users };
}

/**
 * Extract project data from body
 * @param {Object} body - Request body
 * @returns {Object} - Extracted project data
 */
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

/**
 * Extract project tags from string or array
 * @param {string | Array<string>} tags - Project tags
 * @returns {Array<string>} - Extracted project tags
 */
const extractProjectTags = (tags) =>
  // 如果某项为空，则删除
  Array.isArray(tags)
    ? tags.map(String).filter((tag) => tag)
    : tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
/**
 * Handle tags change and save
 * @param {number} projectId - Project ID
 * @param {string | Array<string>} tags - Project tags
 * @returns {Promise<void>}
 */
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
    .create({ data: { sha256, source: sourcedata } })
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
};
