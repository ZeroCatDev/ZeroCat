import logger from "../logger.js";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Get users by list of IDs
 * @param {Array<number>} userIds - List of user IDs
 * @returns {Promise<Array<User>>}
 */
async function getUsersByList(userIds) {
  const select = {
    id: true,
    username: true,
    display_name: true,
    state: true,
    regTime: true,
    motto: true,
    images: true,
  };

  // Get each user's info
  const users = await prisma.ow_users.findMany({
    where: {
      id: { in: userIds.map((id) => parseInt(id, 10)) },
    },
    select,
  });

  return users;
}

export { getUsersByList };

