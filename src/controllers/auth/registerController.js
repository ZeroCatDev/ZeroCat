import logger from "../../services/logger.js";
import {emailTest, hash, userpwTest} from "../../services/global.js";
import { prisma } from "../../services/prisma.js";
import crypto from "crypto";
import {
    checkRateLimit,
    createTemporaryToken,
    invalidateTemporaryToken,
    validateTemporaryToken,
    VerificationType,
    verifyCode
} from "../../services/auth/verification.js";
import {generateMagicLinkForLogin, sendMagicLinkEmail} from "../../services/auth/magiclink.js";
import {sendVerificationCode, verifyEmailCode} from "../../services/auth/unifiedAuth.js";
import {createEvent} from "../events.js";

/**
 * 初始用户注册 - 只需要邮箱或用户名
 */
export const registerUser = async (req, res) => {
    try {
        const {email, username, password, skipPassword} = req.body;

        // 至少需要邮箱或用户名
        if (!email && !username) {
            return res.status(200).json({
                status: "error",
                message: "至少需要提供邮箱或用户名",
            });
        }

        // 如果提供了邮箱，检查格式
        if (email && !emailTest(email)) {
            return res.status(200).json({
                status: "error",
                message: "邮箱格式不正确",
            });
        }

        // 如果提供了密码，检查格式
        if (password && !userpwTest(password)) {
            return res.status(200).json({
                status: "error",
                message: "密码格式不正确，密码至少需要8位，包含数字和字母",
            });
        }

        // 生成用户名（如果未提供）
        let finalUsername = username;
        if (!username) {
            // 从邮箱生成用户名，取@前的部分
            const emailPrefix = email.split('@')[0];
            finalUsername = `user_${emailPrefix}_${Date.now().toString().substring(8)}`;

            // 确保用户名唯一
            const existingUsername = await prisma.ow_users.findUnique({
                where: {username: finalUsername},
            });

            if (existingUsername) {
                finalUsername = `user_${emailPrefix}_${Date.now()}`;
            }
        } else {
            // 检查用户名是否已存在
            const existingUser = await prisma.ow_users.findUnique({
                where: {username},
            });

            if (existingUser) {
                return res.status(200).json({
                    status: "error",
                    message: "用户名已被使用",
                });
            }
        }

        // 如果提供了邮箱，检查是否已存在
        if (email) {
            const existingContact = await prisma.ow_users_contacts.findFirst({
                where: {
                    contact_value: email,
                    contact_type: "email"
                },
            });

            if (existingContact) {
                return res.status(200).json({
                    status: "error",
                    message: "邮箱已被使用",
                });
            }
        }

        // 创建用户
        const newUser = await prisma.ow_users.create({
            data: {
                username: finalUsername,
                display_name: finalUsername,
                password: password && !skipPassword ? hash(password) : null,
                status: email ? "pending" : "active", // 如果有邮箱，状态为pending，否则为active
            },
        });

        try {
            // 如果提供了邮箱，添加联系方式
            if (email) {
                // 添加邮箱联系方式
                const contact = await prisma.ow_users_contacts.create({
                    data: {
                        user_id: newUser.id,
                        contact_value: email,
                        contact_type: "email",
                        is_primary: true,
                        verified: false
                    }
                });

                // 检查发送频率限制
                const rateCheck = await checkRateLimit(email, VerificationType.REGISTER);
                if (!rateCheck.success) {
                    return res.status(200).json({
                        status: "error",
                        message: rateCheck.message || "发送过于频繁，请稍后再试"
                    });
                }

                // 使用魔术链接发送验证邮件
                const options = {
                    templateType: 'register',
                    expiresIn: 7200, // 2小时有效
                    redirect: '/app/account/setup'
                };

                const magicLinkResult = await generateMagicLinkForLogin(newUser.id, email, options);

                if (magicLinkResult.success) {
                    await sendMagicLinkEmail(email, magicLinkResult.magicLink, options);
                } else {
                    logger.error('生成注册验证链接失败:', magicLinkResult.message);
                }
            }

            // 记录用户注册事件
            await createEvent("user_register", newUser.id, "user", newUser.id, {
                event_type: "user_register",
                actor_id: newUser.id,
                target_type: "user",
                target_id: newUser.id
            });

            // 如果用户尚未设置密码，返回设置密码的指引
            const needPassword = !password && !skipPassword;

            // 如果提供了邮箱，创建临时令牌用于重发验证邮件或更改邮箱
            let tempToken = null;
            if (email) {
                const tokenResult = await createTemporaryToken(newUser.id, 'account_setup');
                if (tokenResult.success) {
                    tempToken = tokenResult.token;
                }
            }

            return res.status(200).json({
                status: "success",
                message: email
                    ? "注册成功，请查收验证邮件完成注册"
                    : "注册成功",
                userId: newUser.id,
                username: newUser.username,
                needVerify: !!email,
                needPassword: needPassword,
                setupUrl: needPassword ? `/app/account/setup?user=${newUser.id}` : null,
                temporaryToken: tempToken
            });
        } catch (error) {
            // 如果添加联系方式失败，删除刚创建的用户
            await prisma.ow_users.delete({
                where: {id: newUser.id},
            });
            throw error;
        }
    } catch (error) {
        logger.error("注册用户时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "注册失败",
        });
    }
};

/**
 * 验证邮箱
 */
export const verifyEmail = async (req, res) => {
    try {
        const {email, code} = req.body;

        if (!email || !code) {
            return res.status(200).json({
                status: "error",
                message: "邮箱和验证码都是必需的",
            });
        }

        // 查找邮箱联系方式
        const contact = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_value: email,
                contact_type: "email",
            },
        });

        if (!contact) {
            return res.status(200).json({
                status: "error",
                message: "未找到此邮箱",
            });
        }

        // 验证验证码
        const verifyResult = await verifyCode(email, code, VerificationType.VERIFY_EMAIL);

        if (!verifyResult.success) {
            return res.status(200).json({
                status: "error",
                message: verifyResult.message,
                attemptsLeft: verifyResult.attemptsLeft,
            });
        }

        // 更新邮箱为已验证
        await prisma.ow_users_contacts.update({
            where: {
                contact_id: contact.contact_id,
            },
            data: {
                verified: true,
            },
        });

        // 如果用户状态为pending，则更新为active
        const user = await prisma.ow_users.findUnique({
            where: {id: contact.user_id},
        });

        if (user && user.status === "pending") {
            await prisma.ow_users.update({
                where: {id: user.id},
                data: {
                    status: "active",
                },
            });
        }

        return res.status(200).json({
            status: "success",
            message: "邮箱验证成功",
        });
    } catch (error) {
        logger.error("验证邮箱时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "验证邮箱失败",
        });
    }
};

/**
 * 发送找回密码验证码
 */
export const retrievePassword = async (req, res) => {
    try {
        const {email} = req.body;
        const responseMessage = "如果此邮箱已注册，验证码将发送到您的邮箱";
        let codeId = crypto.randomUUID();

        if (!email || !emailTest(email)) {
            return res.status(200).json({
                status: "error",
                message: "请提供有效的邮箱地址",
            });
        }

        // 查找邮箱联系方式
        const contact = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_value: email,
                contact_type: "email",
                verified: true,
            },
        });

        if (!contact) {
            // 安全起见，不告诉用户邮箱是否存在
            return res.status(200).json({
                status: "success",
                message: responseMessage,
                data: {
                    code_id: codeId,
                    expires_in: 300
                }
            });
        }

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: {id: contact.user_id},
        });

        if (!user || user.status !== "active") {
            // 安全起见，不告诉用户邮箱是否存在
            return res.status(200).json({
                status: "success",
                message: responseMessage,
                data: {
                    code_id: codeId,
                    expires_in: 300
                }
            });
        }

        // 检查发送频率限制
        const rateCheck = await checkRateLimit(email, VerificationType.PASSWORD_RESET);
        if (!rateCheck.success) {
            return res.status(200).json({
                status: "error",
                message: rateCheck.message || "发送过于频繁，请稍后再试"
            });
        }

        const sendCodeResult = await sendVerificationCode(user.id, email, "reset_password");
        if (!sendCodeResult.success) {
            return res.status(200).json({
                status: "error",
                message: sendCodeResult.message || "发送验证码失败",
            });
        }
        codeId = sendCodeResult.codeId;

        return res.status(200).json({
            status: "success",
            message: "重置密码验证码已发送到您的邮箱",
            data: {
                code_id: codeId,
                expires_in: 300
            }
        });
    } catch (error) {
        logger.error("发送找回密码验证码时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "发送找回密码验证码失败",
        });
    }
};

/**
 * 重置密码
 */
export const resetPassword = async (req, res) => {
    try {
        const {
            code_id: snakeCaseCodeId,
            codeId: camelCaseCodeId,
            code,
            new_password: snakeCaseNewPassword,
            newPassword: camelCaseNewPassword
        } = req.body;
        const codeId = snakeCaseCodeId || camelCaseCodeId;
        const newPassword = snakeCaseNewPassword || camelCaseNewPassword;

        if (!codeId || !code || !newPassword) {
            return res.status(200).json({
                status: "error",
                message: "验证码ID、验证码和新密码都是必需的",
            });
        }

        if (!userpwTest(newPassword)) {
            return res.status(200).json({
                status: "error",
                message: "密码格式不正确，密码至少需要8位，包含数字和字母",
            });
        }

        const verifyResult = await verifyEmailCode(codeId, code);
        if (!verifyResult.valid) {
            return res.status(200).json({
                status: "error",
                message: verifyResult.message || "验证码无效或已过期",
            });
        }

        if (verifyResult.data?.purpose !== "reset_password") {
            return res.status(200).json({
                status: "error",
                message: "验证码用途不正确",
            });
        }

        const userId = verifyResult.data?.userId;
        if (!userId) {
            return res.status(200).json({
                status: "error",
                message: "无效的验证码数据",
            });
        }

        const user = await prisma.ow_users.findUnique({
            where: {id: userId},
        });

        if (!user) {
            return res.status(200).json({
                status: "error",
                message: "用户不存在",
            });
        }

        // 更新密码
        await prisma.ow_users.update({
            where: {id: user.id},
            data: {
                password: hash(newPassword),
            },
        });

        // 撤销所有其他登录令牌（可选）
        await prisma.ow_auth_tokens.updateMany({
            where: {
                user_id: user.id,
                revoked: false,
            },
            data: {
                revoked: true,
                revoked_at: new Date(),
            },
        });

        return res.status(200).json({
            status: "success",
            message: "密码已重置，请使用新密码登录",
        });
    } catch (error) {
        logger.error("重置密码时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "重置密码失败",
        });
    }
};

/**
 * 设置用户密码
 */
export const setPassword = async (req, res) => {
    try {
        const {userId, password} = req.body;

        if (!userId || !password) {
            return res.status(200).json({
                status: "error",
                message: "用户ID和密码都是必需的",
            });
        }

        if (!userpwTest(password)) {
            return res.status(200).json({
                status: "error",
                message: "密码格式不正确，密码至少需要8位，包含数字和字母",
            });
        }

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: {id: userId},
        });

        if (!user) {
            return res.status(200).json({
                status: "error",
                message: "用户不存在",
            });
        }

        // 更新密码
        await prisma.ow_users.update({
            where: {id: user.id},
            data: {
                password: hash(password),
            },
        });

        return res.status(200).json({
            status: "success",
            message: "密码设置成功",
        });
    } catch (error) {
        logger.error("设置密码时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "设置密码失败",
        });
    }
};

/**
 * 重发验证邮件
 */
export const resendVerificationEmail = async (req, res) => {
    try {
        const {token} = req.body;

        if (!token) {
            return res.status(200).json({
                status: "error",
                message: "无效的请求"
            });
        }

        // 验证临时令牌
        const tokenResult = await validateTemporaryToken(token, 'account_setup');
        if (!tokenResult.success) {
            return res.status(200).json({
                status: "error",
                message: tokenResult.message || "无效的临时令牌"
            });
        }

        const userId = tokenResult.userId;

        // 获取用户信息和主邮箱
        const user = await prisma.ow_users.findUnique({
            where: {id: userId}
        });

        if (!user) {
            return res.status(200).json({
                status: "error",
                message: "用户不存在"
            });
        }

        // 获取用户的主邮箱
        const contact = await prisma.ow_users_contacts.findFirst({
            where: {
                user_id: userId,
                contact_type: "email",
                is_primary: true
            }
        });

        if (!contact) {
            return res.status(200).json({
                status: "error",
                message: "未找到用户邮箱"
            });
        }

        // 检查邮箱是否已验证
        if (contact.verified) {
            return res.status(200).json({
                status: "error",
                message: "该邮箱已经验证过"
            });
        }

        // 检查发送频率限制
        const rateCheck = await checkRateLimit(contact.contact_value, VerificationType.VERIFY_EMAIL);
        if (!rateCheck.success) {
            return res.status(200).json({
                status: "error",
                message: rateCheck.message || "发送过于频繁，请稍后再试"
            });
        }

        // 发送验证邮件
        const options = {
            templateType: 'register',
            expiresIn: 7200, // 2小时有效
            redirect: '/app/account/setup'
        };

        const magicLinkResult = await generateMagicLinkForLogin(userId, contact.contact_value, options);

        if (!magicLinkResult.success) {
            return res.status(200).json({
                status: "error",
                message: "生成验证链接失败"
            });
        }

        await sendMagicLinkEmail(contact.contact_value, magicLinkResult.magicLink, options);

        // 重新创建临时令牌并延长有效期
        const newTokenResult = await createTemporaryToken(userId, 'account_setup');

        // 废弃旧的临时令牌
        await invalidateTemporaryToken(token);

        return res.status(200).json({
            status: "success",
            message: "验证邮件已重新发送",
            expiresIn: magicLinkResult.expiresIn,
            temporaryToken: newTokenResult.success ? newTokenResult.token : null
        });
    } catch (error) {
        logger.error("重发验证邮件时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "重发验证邮件失败"
        });
    }
};

/**
 * 更改注册邮箱
 */
export const changeRegisterEmail = async (req, res) => {
    try {
        const {token, email} = req.body;

        if (!token || !email) {
            return res.status(200).json({
                status: "error",
                message: "无效的请求"
            });
        }

        if (!emailTest(email)) {
            return res.status(200).json({
                status: "error",
                message: "邮箱格式不正确"
            });
        }

        // 验证临时令牌
        const tokenResult = await validateTemporaryToken(token, 'account_setup');
        if (!tokenResult.success) {
            return res.status(200).json({
                status: "error",
                message: tokenResult.message || "无效的临时令牌"
            });
        }

        const userId = tokenResult.userId;

        // 获取用户信息
        const user = await prisma.ow_users.findUnique({
            where: {id: userId}
        });

        if (!user) {
            return res.status(200).json({
                status: "error",
                message: "用户不存在"
            });
        }

        // 检查邮箱是否已被其他用户使用
        const existingContact = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_value: email,
                contact_type: "email"
            }
        });

        if (existingContact && existingContact.user_id !== userId) {
            return res.status(200).json({
                status: "error",
                message: "该邮箱已被使用"
            });
        }

        // 检查用户是否已有该邮箱
        const userExistingEmail = await prisma.ow_users_contacts.findFirst({
            where: {
                user_id: userId,
                contact_value: email,
                contact_type: "email"
            }
        });

        // 获取用户当前的主邮箱
        const currentPrimaryEmail = await prisma.ow_users_contacts.findFirst({
            where: {
                user_id: userId,
                contact_type: "email",
                is_primary: true
            }
        });

        // 使用事务处理
        await prisma.$transaction(async (tx) => {
            // 如果用户已有主邮箱且不是当前要设置的邮箱，将其设为非主要
            if (currentPrimaryEmail && currentPrimaryEmail.contact_value !== email) {
                await tx.ow_users_contacts.update({
                    where: {contact_id: currentPrimaryEmail.contact_id},
                    data: {is_primary: false}
                });
            }

            // 如果用户已有该邮箱，则更新它；否则创建新的
            if (userExistingEmail) {
                await tx.ow_users_contacts.update({
                    where: {contact_id: userExistingEmail.contact_id},
                    data: {
                        is_primary: true,
                        verified: false
                    }
                });
            } else {
                await tx.ow_users_contacts.create({
                    data: {
                        user_id: userId,
                        contact_value: email,
                        contact_type: "email",
                        is_primary: true,
                        verified: false
                    }
                });
            }
        });

        // 检查发送频率限制
        const rateCheck = await checkRateLimit(email, VerificationType.CHANGE_EMAIL);
        if (!rateCheck.success) {
            return res.status(200).json({
                status: "error",
                message: rateCheck.message || "发送过于频繁，请稍后再试"
            });
        }

        // 发送验证邮件
        const options = {
            templateType: 'register',
            expiresIn: 7200, // 2小时有效
            redirect: '/app/account/setup'
        };

        const magicLinkResult = await generateMagicLinkForLogin(userId, email, options);

        if (magicLinkResult.success) {
            await sendMagicLinkEmail(email, magicLinkResult.magicLink, options);
        }

        // 重新创建临时令牌并延长有效期
        const newTokenResult = await createTemporaryToken(userId, 'account_setup');

        // 废弃旧的临时令牌
        await invalidateTemporaryToken(token);

        return res.status(200).json({
            status: "success",
            message: "邮箱已更改，请查收验证邮件",
            email: email,
            temporaryToken: newTokenResult.success ? newTokenResult.token : null
        });
    } catch (error) {
        logger.error("更改注册邮箱时出错:", error);
        return res.status(200).json({
            status: "error",
            message: "更改注册邮箱失败"
        });
    }
};
