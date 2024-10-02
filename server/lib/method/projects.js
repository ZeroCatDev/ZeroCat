//prisma client
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

  //console.log(projects);
  projects = projects.filter((project) => {
    return !(project.state == "private" && project.authorid != userid);
  });
  //console.log(projects);

  return projects;
}
async function getUsersByList(list) {
  var select = {
    id: true,
    username: true,
    display_name: true,
    state: true,
    regTime: true,
    motto: true,
    images: true,
  };

  // 获取每个用户信息
  var users = await prisma.ow_users.findMany({
    where: {
      id: { in: list.map((item) => parseInt(item)) },
    },
    select: select,
  });

  //console.log(users);

  return users;
}
async function getProjectsAndUsersByProjectsList(list, userid) {
  var projects = await getProjectsByList(list, userid);
  var userslist = [...new Set(projects.map((project) => project.authorid))];
  var users = await getUsersByList(userslist);
  return { projects: projects, users: users };
}
//(async () => {console.log(await getProjectsAndUsersByProjectsList([3, 126, 130, 131, 129], 2));})();

//console.log(await getProjectsAndUsersByProjectsList([3, 126, 130, 131, 129], 2))
module.exports = {
  getProjectsByList,
  getUsersByList,
  getProjectsAndUsersByProjectsList,
};
