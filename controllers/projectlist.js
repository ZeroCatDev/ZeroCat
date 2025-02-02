import logger from "../utils/logger.js";
import { prisma } from "../utils/global.js";

import { getProjectsAndUsersByProjectsList } from "./projects.js";

async function starProject(userid, projectid) {
  await prisma.ow_projects_stars.create({
    data: {
      projectid: Number(projectid),
      userid: Number(userid),
      type: "star",
      value: 1,
    },
  });
  await prisma.ow_projects.update({
    where: { id: Number(projectid) },
    data: {
      star_count: {
        increment: 1,
      },
    },
  });
}
async function unstarProject(userid, projectid) {
  await prisma.ow_projects_stars.deleteMany({
    where: {
      projectid: Number(projectid),
      userid: Number(userid),
      type: "star",
      value: 1,
    },
  });
  await prisma.ow_projects.update({
    where: { id: Number(projectid) },
    data: {
      star_count: {
        decrement: 1,
      },
    },
  });
}
function getProjectStars(projectid) {
  return prisma.ow_projects_stars.count({
    where: {
      projectid: Number(projectid),
      type: "star",
      value: 1,
    },
  });
}
function getProjectStarStatus(userid, projectid) {
  return prisma.ow_projects_stars.count({
    where: {
      projectid: Number(projectid),
      userid: Number(userid),
      type: "star",
      value: 1,
    },
  });
}
async function getProjectList(listid, userid) {
  var list = await prisma.ow_projects_lists.findFirst({
    where: { id: Number(listid) },
  });
  if (!list) {
    return null;
  }
  if (list.state === "private" && list.authorid != userid) {
    return null;
  }
  var projects = await prisma.ow_projects_stars.findMany({
    where: { listid: Number(list.id), type: "list" },
    select: { projectid: true },
  });
  list.projects = projects.map((item) => item.projectid);
  return list;
}

async function getUserListInfo(userid) {
  var lists = await prisma.ow_projects_lists.findMany({
    where: {
      authorid: Number(userid),
    },
  });
  return lists;
}
async function getUserListInfoPublic(userid) {
  var lists = await prisma.ow_projects_lists.findMany({
    where: {
      authorid: Number(userid),
    },
  });
  return lists;
}
async function getUserListInfoAndCheak(userid, projectid) {
  logger.debug(userid);
  logger.debug(projectid);
  var lists = await getUserListInfo(userid);
  logger.debug(lists);
  var listids = lists.map((item) => item.id);
  var projects = await prisma.ow_projects_stars.findMany({
    where: {
      userid: Number(userid),
      type: "list",
      projectid: Number(projectid),
      listid: { in: listids },
    },
  });
  //遍历projects，将对应的list.id等于projects.list的list项添加include=true
  lists.forEach((list) => {
    list.include = projects.some((item) => item.listid == list.id);
  });
  return lists;
}
//创建一个新的列表
async function createList(userid, title, description) {
  return prisma.ow_projects_lists.create({
    data: {
      authorid: Number(userid),
      title: title,
      description: description,
    },
  });
}
//删除一个列表
async function deleteList(userid, listid) {
  return prisma.ow_projects_lists.delete({
    where: {
      id: Number(listid),
      authorid: Number(userid),
    },
  });
}
//添加一个项目到列表
async function addProjectToList(userid, listid, projectid) {
  return prisma.ow_projects_stars.create({
    data: {
      userid: Number(userid),
      listid: Number(listid),
      projectid: Number(projectid),
      type: "list",
    },
  });
}
//从列表中删除一个项目
async function removeProjectFromList(userid, listid, projectid) {
  return prisma.ow_projects_stars.deleteMany({
    where: {
      userid: Number(userid),
      listid: Number(listid),
      projectid: Number(projectid),
      type: "list",
    },
  });
}
async function updateList(userid, listid, data) {
  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.state !== undefined) {
    if (data.state === "public" || data.state === "private") {
      updateData.state = data.state;
    } else {
      throw new Error("state only allow public or private");
    }
  }

  const list = await prisma.ow_projects_lists.update({
    where: {
      id: Number(listid),
      authorid: Number(userid),
    },
    data: updateData,
  });
  logger.debug(list);
  return list;
}

export {
  starProject,
  unstarProject,
  getProjectStars,
  getProjectStarStatus,
  getProjectList,
  getUserListInfoAndCheak,
  createList,
  deleteList,
  addProjectToList,
  removeProjectFromList,
  getUserListInfo,
  getUserListInfoPublic,
  updateList,
};
