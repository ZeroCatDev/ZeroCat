import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import {Router} from "express";
import {prisma} from "../services/prisma.js";
import {needAdmin, needLogin} from "../middleware/auth.js";
import { requireSudo } from "../middleware/sudo.js";
import {createEvent} from "../controllers/events.js";
import jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import {PasswordHash} from "phpass";
import { changeUsername } from "../controllers/users.js";

 // PHPass hasher for legacy password validation
 const passwordHash = new PasswordHash();

// Helper function to check if password is hashed with PHPass
function isPhpassHash(hash) {
    // PHPass hashes typically start with $P$, $H$, or $2a$ for WordPress, Drupal, etc.
    return hash.startsWith("$P$") || hash.startsWith("$H$");
}

const router = Router();

// 根据用户ID获取用户信息
router.get("/id/:id", async function (req, res, next) {
    try {
        var user = await prisma.ow_users.findMany({
            where: {
                id: parseInt(req.params.id),
            },
            select: {
                id: true,
                display_name: true,
                bio: true,
                motto: true,

                avatar: true,
                regTime: true,
                sex: true,
                username: true,
                type: true,
                status: true,
                location: true,
                region: true,
                birthday: true,
                featured_projects: true,
                custom_status: true,
                url: true,
            },
        });

        if (!user[0]) {
            logger.debug("用户不存在");
            return res.status(404).json({
                status: "error",
                code: "404",
                message: "找不到页面",
            });
        }

        // 格式化用户信息
        const formattedUser = {
            ...user[0],
            isActive: user[0].status === "active",
            isAdmin: user[0].type === "administrator",
        };

        res.send({
            status: "success",
            data: formattedUser,
        });
    } catch (err) {
        next(err);
    }
});

// 根据用户名获取用户信息
router.get("/username/:username", async function (req, res, next) {
    try {
        var user = await prisma.ow_users.findMany({
            where: {
                username: req.params.username,
            },
            select: {
                id: true,
                display_name: true,
                bio: true,
                motto: true,

                avatar: true,
                regTime: true,
                sex: true,
                username: true,
                type: true,
                status: true,
                location: true,
                region: true,
                birthday: true,
                featured_projects: true,
                custom_status: true,
                url: true,
            },
        });

        if (!user[0]) {
            logger.debug("用户不存在");
            return res.status(404).json({
                status: "error",
                code: "404",
                message: "找不到页面",
            });
        }

        // 格式化用户信息
        const formattedUser = {
            ...user[0],
            isActive: user[0].status === "active",
            isAdmin: user[0].type === "administrator",
        };

        res.send({
            status: "success",
            data: formattedUser,
        });
    } catch (err) {
        next(err);
    }
});

// 批量查询用户信息
router.post("/batch/:type", async function (req, res, next) {
    try {
        if (req.params.type !== "id" && req.params.type !== "name") {
            return res
                .status(400)
                .send({status: "error", message: "无效的查询类型"});
        }

        const {users} = req.body;
        if (!Array.isArray(users)) {
            return res
                .status(400)
                .send({status: "error", message: "无效的用户ID数组"});
        }

        const queryField = req.params.type === "id" ? "id" : "username";
        const usersinfo = await prisma.ow_users.findMany({
            where: {
                [queryField]: {
                    in: users.map((id) => (req.params.type === "id" ? parseInt(id) : id)),
                },
            },
            select: {
                id: true,
                display_name: true,
                bio: true,
                motto: true,

                avatar: true,
                regTime: true,
                sex: true,
                username: true,
                type: true,
                status: true,
                location: true,
                region: true,
                birthday: true,
                featured_projects: true,
                custom_status: true,
                url: true,
            },
        });

        // 格式化用户信息
        const formattedUsers = usersinfo.map((user) => ({
            ...user,
            isActive: user.status === "active",
            isAdmin: user.type === "administrator",
        }));

        res.send({
            status: "success",
            data: formattedUsers,
        });
    } catch (err) {
        next(err);
    }
});

// 获取用户自身信息
router.get("/me", needLogin, async function (req, res, next) {
    try {
        const user = await prisma.ow_users.findFirst({
            where: {id: res.locals.userid},
            select: {
                id: true,
                display_name: true,
                avatar: true,
                regTime: true,
                sex: true,
                username: true,
                email: true,
                type: true,
                status: true,
                bio: true,
                motto: true,

                location: true,
                region: true,
                birthday: true,
                featured_projects: true,
                custom_status: true,
                url: true,
            },
        });

        if (!user) {
            logger.debug("用户不存在");
            return res.status(404).json({
                status: "error",
                code: "404",
                message: "找不到页面",
            });
        }

        // 格式化用户信息
        const formattedUser = {
            ...user,
            isActive: user.status === "active",
            isAdmin: user.type === "administrator",
        };

        res.send({
            status: "success",
            data: formattedUser,
        });
    } catch (err) {
        next(err);
    }
});

// 用户注册
router.post("/register", async function (req, res, next) {
    try {
        const {username, email, password, display_name} = req.body;

        // 简单验证
        if (!username || !email || !password) {
            return res.status(400).json({
                status: "error",
                code: "validation_error",
                message: "用户名、邮箱和密码为必填项",
            });
        }

        // 检查用户名是否已存在
        const existingUsername = await prisma.ow_users.findFirst({
            where: {username},
        });

        if (existingUsername) {
            return res.status(409).json({
                status: "error",
                code: "conflict",
                message: "用户名已存在",
            });
        }

        // 检查邮箱是否已存在
        const existingEmail = await prisma.ow_users.findFirst({
            where: {email},
        });

        if (existingEmail) {
            return res.status(409).json({
                status: "error",
                code: "conflict",
                message: "邮箱已被注册",
            });
        }

        // 哈希密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const user = await prisma.ow_users.create({
            data: {
                username,
                email,
                password: hashedPassword,
                display_name: display_name || username,
                type: UserTypes.REGULAR,
                status: "active",
                regTime: new Date(),
                settings: {
                    theme: "light",
                    language: "zh-CN",
                    notifications: {
                        email: true,
                        push: true,
                    },
                },
            },
        });

        // 记录注册事件
        await createEvent("user_register", user.id, "user", user.id, {
            event_type: "user_register",
            actor_id: user.id,
            target_type: "user",
            target_id: user.id,
            username: user.username,
        });

        // 返回注册结果
        res.status(201).json({
            status: "success",
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                type: user.type,
                regTime: user.regTime,
            },
        });
    } catch (error) {
        logger.error("用户注册出错:", error);
        next(error);
    }
});

// 用户登录
router.post("/login", async function (req, res, next) {
    try {
        const {username, password} = req.body;

        // 简单验证
        if (!username || !password) {
            return res.status(400).json({
                status: "error",
                code: "validation_error",
                message: "用户名和密码为必填项",
            });
        }

        // 查找用户
        const user = await prisma.ow_users.findFirst({
            where: {
                OR: [{username}, {email: username}],
            },
        });

        // 用户不存在
        if (!user) {
            return res.status(401).json({
                status: "error",
                code: "authentication_failed",
                message: "用户名或密码错误",
            });
        }

        // 账户被禁用
        if (user.status !== "active") {
            return res.status(401).json({
                status: "error",
                code: "authentication_failed",
                message: "账户已被禁用",
            });
        }

        // 验证密码
        let passwordValid = false;

        // 检查密码哈希类型并验证
        if (isPhpassHash(user.password)) {
            // 使用PHPass验证
            passwordValid = passwordHash.checkPassword(password, user.password);

            // 如果验证成功，将密码升级为bcrypt哈希
            if (passwordValid) {
                const newHash = await bcrypt.hash(password, 10);
                await prisma.ow_users.update({
                    where: {id: user.id},
                    data: {password: newHash},
                });
            }
        } else {
            // 使用bcrypt验证
            passwordValid = await bcrypt.compare(password, user.password);
        }

        if (!passwordValid) {
            return res.status(401).json({
                status: "error",
                code: "authentication_failed",
                message: "用户名或密码错误",
            });
        }

        // 获取JWT密钥
        const jwtSecret = await zcconfig.get("security.jwttoken");

        // 生成令牌
        const token = jwt.sign(
            {
                userid: user.id,
                username: user.username,
            },
            jwtSecret,
            {expiresIn: "7d"}
        );

        // 更新最后登录时间
        await prisma.ow_users.update({
            where: {id: user.id},
            data: {last_login: new Date()},
        });

        // 返回登录结果
        res.json({
            status: "success",
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    type: user.type,
                },
            },
        });
    } catch (error) {
        logger.error("用户登录出错:", error);
        next(error);
    }
});

// 修改密码
router.post("/change-password", needLogin, requireSudo, async function (req, res, next) {
    try {
        const userId = res.locals.userid;
        const { newPassword } = req.body;

        // 简单验证
        if (!newPassword) {
            return res.status(400).json({
                status: "error",
                code: "validation_error",
                message: "新密码为必填项",
            });
        }

        // 哈希新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await prisma.ow_users.update({
            where: {id: userId},
            data: {password: hashedPassword},
        });

        res.json({
            status: "success",
            message: "密码修改成功",
        });
    } catch (error) {
        logger.error("修改密码出错:", error);
        next(error);
    }
});

// 修改用户名
router.post("/change-username", needLogin, requireSudo, changeUsername);

 // 更新用户信息
 router.patch("/profile/update", needLogin, async function (req, res, next) {
    try {
        const userId = res.locals.userid;
        const {display_name, bio, avatar, settings} = req.body;

        // 获取原有用户信息
        const oldUser = await prisma.ow_users.findUnique({
            where: {id: userId},
        });

        if (!oldUser) {
            return res.status(404).json({
                status: "error",
                code: "not_found",
                message: "用户不存在",
            });
        }

        // 准备更新数据
        const updateData = {};

        if (display_name !== undefined) updateData.display_name = display_name;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (settings !== undefined) updateData.settings = settings;

        // 更新用户信息
        const updatedUser = await prisma.ow_users.update({
            where: {id: userId},
            data: updateData,
            select: {
                id: true,
                username: true,
                display_name: true,
                bio: true,
                motto: true,

                avatar: true,
                regTime: true,
                type: true,
                status: true,
                location: true,
                region: true,
                birthday: true,
                featured_projects: true,
                custom_status: true,
                url: true,
            },
        });

        // 记录用户资料更新事件
        if (display_name !== undefined && display_name !== oldUser.display_name) {
            await createEvent("user_profile_update", userId, "user", userId, {
                event_type: "user_profile_update",
                actor_id: userId,
                target_type: "user",
                target_id: userId,
                update_type: "display_name",
                old_value: oldUser.display_name,
                new_value: display_name,
            });
        }

        if (bio !== undefined && bio !== oldUser.bio) {
            await createEvent("user_profile_update", userId, "user", userId, {
                event_type: "user_profile_update",
                actor_id: userId,
                target_type: "user",
                target_id: userId,
                update_type: "bio",
                old_value: oldUser.bio,
                new_value: bio,
            });
        }

        // 格式化用户信息
        const formattedUser = {
            ...updatedUser,
            isActive: updatedUser.status === "active",
            isAdmin: updatedUser.type === "administrator",
        };

        res.json({
            status: "success",
            data: formattedUser,
        });
    } catch (error) {
        logger.error("更新用户信息出错:", error);
        next(error);
    }
});

// 删除用户账户
router.delete("/:userId", needLogin, async function (req, res, next) {
    try {
        const targetUserId = parseInt(req.params.userId);
        const requesterId = res.locals.userid;

        // 验证权限 - 只能删除自己的账户或管理员操作
        const requesterIsAdmin = await needAdmin(req, res, () => true).catch(
            () => false
        );

        if (targetUserId !== requesterId && !requesterIsAdmin) {
            return res.status(403).json({
                status: "error",
                code: "forbidden",
                message: "无权操作",
            });
        }

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: {id: targetUserId},
        });

        if (!user) {
            return res.status(404).json({
                status: "error",
                code: "not_found",
                message: "用户不存在",
            });
        }

        // 软删除用户 - 更新状态而不是真正删除
        await prisma.ow_users.update({
            where: {id: targetUserId},
            data: {
                status: UserStatus.DELETED,
                email: `deleted_${targetUserId}_${user.email}`, // 防止邮箱被重用
                password: await bcrypt.hash(Math.random().toString(36), 10), // 随机密码
            },
        });

        // 记录删除事件
        await createEvent(
            "user_account_deleted",
            requesterId,
            "user",
            targetUserId,
            {
                event_type: "user_account_deleted",
                actor_id: requesterId,
                target_type: "user",
                target_id: targetUserId,
                username: user.username,
            }
        );

        res.json({
            status: "success",
            message: "账户已删除",
        });
    } catch (error) {
        logger.error("删除用户账户出错:", error);
        next(error);
    }
});

export default router;
