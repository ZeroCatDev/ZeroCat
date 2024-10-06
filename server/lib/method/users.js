//prisma client
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
  module.exports = { getUsersByList };