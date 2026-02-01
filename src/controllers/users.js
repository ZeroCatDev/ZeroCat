import logger from "../services/logger.js";
import {prisma} from "../services/prisma.js";

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


/**
 * 修改用户名
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export const changeUsername = async (req, res) => {
    try {
        const userId = res.locals.userid;
        const { newUsername } = req.body;

        if (!newUsername || typeof newUsername !== "string" || newUsername.trim().length === 0) {
            return res.status(400).json({
                status: "error",
                message: "新用户名不能为空",
                code: "INVALID_USERNAME"
            });
        }

        const trimmedUsername = newUsername.trim();

        // 检查用户名是否已被使用
        const existingUser = await prisma.ow_users.findFirst({
            where: { username: trimmedUsername }
        });

        if (existingUser) {
            return res.status(409).json({
                status: "error",
                message: "用户名已被使用",
                code: "USERNAME_TAKEN"
            });
        }

        // 更新用户名
        await prisma.ow_users.update({
            where: { id: userId },
            data: { username: trimmedUsername }
        });

        logger.info(`用户 ${userId} 修改用户名为: ${trimmedUsername}`);

        res.json({
            status: "success",
            message: "用户名修改成功"
        });
    } catch (error) {
        logger.error("修改用户名时出错:", error);
        res.status(500).json({
            status: "error",
            message: "修改用户名失败",
            code: "CHANGE_USERNAME_FAILED"
        });
    }
};
