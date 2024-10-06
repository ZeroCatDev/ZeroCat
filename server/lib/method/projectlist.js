const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getProjectsAndUsersByProjectsList } = require("./projects.js");

// 统一处理 list 的过滤和去重
function cleanAndDeduplicateList(list) {
  return list.filter(Boolean).reduce((accumulator, item) => {
    if (!accumulator.includes(item)) {
      accumulator.push(item);
    }
    return accumulator;
  }, []);
}

// 统一的错误处理函数
function handleError(error) {
  console.error(error);
  throw new Error(error.message || "发生了错误");
}

// 添加作品到作品列表
async function userProjectlistAdd(info) {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(info.listid), authorid: Number(info.userid) },
    });

    if (!project) throw new Error("项目列表不存在");

    let list = cleanAndDeduplicateList([...project.list.split(","), info.projectid]);

    return await prisma.ow_projects_lists.update({
      where: { id: Number(info.listid), authorid: Number(info.userid) },
      data: { list: list.join() },
    });
  } catch (error) {
    handleError(error);
  }
}

// 从作品列表中删除作品
async function userProjectlistDelete(info) {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(info.listid), authorid: Number(info.userid) },
    });

    if (!project) throw new Error("项目列表不存在");

    let list = cleanAndDeduplicateList(
      project.list.split(",").filter((item) => item !== String(info.projectid))
    );

    return await prisma.ow_projects_lists.update({
      where: { id: Number(info.listid), authorid: Number(info.userid) },
      data: { list: list.join() },
    });
  } catch (error) {
    handleError(error);
  }
}

// 创建新项目列表
async function createProjectlist(userid) {
  try {
    return await prisma.ow_projects_lists.create({
      data: {
        authorid: userid,
        list: "",
        state: "private",
        title: "新建项目列表",
        description: "新建项目列表",
      },
    });
  } catch (error) {
    handleError(error);
  }
}

// 获取指定项目列表详情
async function getProjectlist(listid, userid) {
  try {
    const project = await prisma.ow_projects_lists.findFirst({
      where: { id: Number(listid) },
    });

    if (!project || (project.state === "private" && project.authorid !== userid)) {
      return "列表不存在或为私有，请检查或登录账户";
    }

    const list = cleanAndDeduplicateList(project.list.split(","));
    project.data = await getProjectsAndUsersByProjectsList(list);

    return project;
  } catch (error) {
    handleError(error);
  }
}

// 获取用户的所有项目列表
async function getUserProjectlist(userid,state) {
  try {
    return await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(userid) ,state:{in:state}},
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
}

// 获取用户的公开项目列表
async function getUserPublicProjectlist(userid) {
  try {
    return await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(userid), state: "public" },
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
}

// 检查项目是否在用户列表中
async function checkProjectlistWithUser(info) {
  try {
    if (!info.listid && !info.userid) return "参数错误";

    const projects = await prisma.ow_projects_lists.findMany({
      where: { authorid: Number(info.userid) },
    });

    return projects.map((item) => {
      const listArray = cleanAndDeduplicateList(item.list.split(","));
      item.include = listArray.includes(String(info.projectid));
      return item;
    });
  } catch (error) {
    handleError(error);
  }
}


// 更新项目列表
async function updateProjectlist(listid, info) {
  try {
    const keys = ["title", "description", "state", "list"];
    const resultinfo = keys.reduce((acc, key) => {
      if (info[key]) acc[key] = info[key];
      return acc;
    }, {});

    if (resultinfo.list) {
      resultinfo.list = cleanAndDeduplicateList(resultinfo.list.split(",")).join();
    }

    return await prisma.ow_projects_lists.update({
      where: { id: Number(listid) },
      data: resultinfo,
    });
  } catch (error) {
    handleError(error);
  }
}

// 删除项目列表
async function deleteProjectlist(listid, userid) {
  try {
    await prisma.ow_projects_lists.delete({
      where: { id: Number(listid), authorid: Number(userid) },
    });
    return "已删除列表";
  } catch (error) {
    handleError(error);
  }
}

module.exports = {
  userProjectlistAdd,
  userProjectlistDelete,
  getProjectlist,
  deleteProjectlist,
  updateProjectlist,
  createProjectlist,
  getUserProjectlist,
  getUserPublicProjectlist,
  checkProjectlistWithUser,
};
