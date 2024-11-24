const logger = require("../logger.js");
//prisma client
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { getUsersByList } = require("./users.js");

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
module.exports = {
  getProjectsByList,
  getUsersByList,
  getProjectsAndUsersByProjectsList,
};
