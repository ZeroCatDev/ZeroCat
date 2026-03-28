import logger from "../services/logger.js";
import {prisma} from "../services/prisma.js";
import gorseService from "../services/gorse.js";

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
 * 用户选择字段
 * @returns {Object}
 */
export function userSelectionFields() {
    return {
        id: true,
        username: true,
        display_name: true,
        status: true,
        regTime: true,
        bio: true,
        avatar: true,
        location: true,
        region: true,
        url: true,
        custom_status: true,
    };
}

/**
 * 获取推荐用户
 * @param {number} userId - 当前用户ID
 * @param {Object} options - 选项
 * @param {number} options.limit - 返回数量，默认20
 * @param {number} options.offset - 偏移量，默认0
 * @returns {Promise<Object>} 推荐用户列表及分页信息
 */
export async function getRecommendedUsersForUser({ userId, limit = 20, offset = 0 }) {
    const nUserId = Number(userId);
    if (!Number.isInteger(nUserId) || nUserId <= 0) {
        throw new Error("无效的用户 ID");
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    // 从 Gorse 获取推荐用户 ID
    const recommendedUserIds = await gorseService.getRecommendedUserIds(nUserId, {
        limit: safeLimit,
        offset: safeOffset,
    });

    if (!recommendedUserIds || recommendedUserIds.length === 0) {
        return {
            users: [],
            total_candidates: 0,
            offset: safeOffset,
            limit: safeLimit,
            has_more: false,
            message: "Gorse 暂无推荐结果",
        };
    }

    // 获取推荐用户的详细信息，排除当前用户
    const users = await prisma.ow_users.findMany({
        where: {
            id: { in: recommendedUserIds },
            status: "active",
            NOT: { id: nUserId }, // 不包括当前用户
        },
        select: userSelectionFields(),
    });

    // 按 Gorse 推荐顺序排序
    const userMap = new Map(users.map((user) => [Number(user.id), user]));
    const ordered = recommendedUserIds
        .map((id) => userMap.get(Number(id)))
        .filter(Boolean);

    return {
        users: ordered,
        total_candidates: ordered.length,
        offset: safeOffset,
        limit: safeLimit,
        has_more: ordered.length === safeLimit,
    };
}

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
