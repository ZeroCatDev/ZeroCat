const logger = require("../logger.js");
//prisma client
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const crypto = require("crypto");

const { getUsersByList } = require("./users.js");
const { log } = require("console");

async function getProjectsByList(list, userid) {
  var select = {
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
  };

  // 获取每个项目的详细信息
  var projects = await prisma.ow_projects.findMany({
    where: {
      id: { in: list.map((item) => parseInt(item)) },
    },
    select: select,
  });

  //logger.debug(projects);
  projects = projects.filter((project) => {
    return !(project.state == "private" && project.authorid != userid);
  });
  //logger.debug(projects);

  return projects;
}
async function getProjectsAndUsersByProjectsList(list, userid) {
  var projects = await getProjectsByList(list, userid);
  var userslist = [...new Set(projects.map((project) => project.authorid))];
  var users = await getUsersByList(userslist);
  return { projects: projects, users: users };
}
//(async () => {logger.debug(await getProjectsAndUsersByProjectsList([3, 126, 130, 131, 129], 2));})();

//logger.debug(await getProjectsAndUsersByProjectsList([3, 126, 130, 131, 129], 2))

// 工具函数：提取项目数据
function extractProjectData(body) {
  const fields = [
    "type",
    "licence",
    "state",
    "title",
    "description",
    "history",
    "tags",
  ];
  return fields.reduce(
    (acc, field) => (body[field] ? { ...acc, [field]: body[field] } : acc),
    {}
  );
}

// 工具函数：判断是否为有效 JSON
function isJson(str) {
  try {
    JSON.stringify(str); // 如果能成功解析，说明是合法的 JSON
    return true;
  } catch (error) {
    logger.debug(error);
    return false; // 如果解析失败，说明不是 JSON
  }
}

// 工具函数：设置项目文件
function setProjectFile(source) {
  //logger.debug(source);
  var sourcedata='';
  if (isJson(source)) {
    sourcedata = JSON.stringify(source);
  }else {
    sourcedata = source;
  }
  logger.debug(typeof sourcedata);

  const sha256 = crypto.createHash("sha256").update(sourcedata).digest("hex");
  logger.debug("sha256:", sha256);

  //logger.debug(sourcedata);
  prisma.ow_projects_file
    .create({ data: { sha256: sha256, source: sourcedata } })
    .catch(logger.error);
  return sha256;
}

// 工具函数：获取项目文件
async function getProjectFile(sha256) {
  return prisma.ow_projects_file.findFirst({
    where: { sha256 },
    select: { source: true },
  });
}

// 工具函数：处理错误响应
function handleError(res, err, msg) {
  logger.error(err);
  res.status(500).send({ status: "0", msg, error: err });
}

// 工具函数：选择项目信息字段
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

// 工具函数：选择作者信息字段
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

module.exports = {
  getProjectsByList,
  getUsersByList,
  getProjectsAndUsersByProjectsList,
  extractProjectData,
  isJson,
  setProjectFile,
  getProjectFile,
  handleError,
  projectSelectionFields,
  authorSelectionFields,
};
