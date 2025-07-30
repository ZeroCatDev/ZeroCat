import logger from "../services/logger.js";
import {prisma} from "../services/global.js";

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
        status: true,
        regTime: true,
        bio: true,
        motto: true,

        avatar: true,
    };

    // Get each user's info
    const users = await prisma.ow_users.findMany({
        where: {
            id: {in: userIds.map((id) => parseInt(id, 10))},
        },
        select,
    });

    return users;
}

// 获取用户信息通过用户名
export async function getUserByUsername(username) {
    try {
        const user = await prisma.ow_users.findFirst({
            where: {username},
            select: {
                id: true,
                username: true,
                display_name: true,
                status: true,
                regTime: true,
                bio: true,
                motto: true,
                avatar: true,
            }
        });
        return user;
    } catch (err) {
        logger.error("Error fetching user by username:", err);
        throw err;
    }
}

export {getUsersByList};

