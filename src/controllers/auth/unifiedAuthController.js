import logger from '../../services/logger.js';
import {
    sendVerificationCode,
    authenticate
} from '../../services/auth/unifiedAuth.js';
import { generateSudoToken } from '../../services/auth/sudoAuth.js';
import { createUserLoginTokens } from '../../services/auth/tokenUtils.js';
import { needLogin } from '../../middleware/auth.js';
import { requireSudo } from '../../middleware/sudo.js';

/**
 * 发送验证码统一接口
 */
export async function sendCode(req, res) {
    try {
        const { email, purpose = 'login' } = req.body;
        let  userId  = res.locals.userid;

        // 对于需要登录状态的操作，从中间件获取userId
        if (['sudo', 'change_email', 'delete_account'].includes(purpose)) {
            if (!res.locals.userid) {
                return res.status(401).json({
                    status: 'error',
                    message: `${purpose}操作需要先登录`,
                    code: 'NEED_LOGIN'
                });
            }
            logger.info(`[unified-auth-controller] ${purpose}操作需要登录，使用userId: ${res.locals.userid}`);
            userId = res.locals.userid;
        }

        // 对于登录和重置密码，如果没有提供userId但提供了email，尝试查找用户
        if (['login', 'reset_password'].includes(purpose) && !userId && email) {
            const { prisma } = await import('../../services/global.js');
            const user = await prisma.ow_users.findFirst({
                where: { email },
                select: { id: true }
            });

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: '该邮箱未注册',
                    code: 'EMAIL_NOT_FOUND'
                });
            }
            logger.info(`[unified-auth-controller] 通过邮箱查找到用户: ${user.id}`);
            userId = user.id;
        }

        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: '缺少用户信息',
                code: 'MISSING_USER_INFO'
            });
        }

        const result = await sendVerificationCode(userId, email, purpose);

        if (result.success) {
            res.json({
                status: 'success',
                message: result.message,
                data: {
                    code_id: result.codeId
                }
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: result.message,
                code: 'SEND_CODE_FAILED'
            });
        }
    } catch (error) {
        logger.error('[unified-auth-controller] 发送验证码失败:', error);
        res.status(500).json({
            status: 'error',
            message: '发送验证码时发生错误',
            code: 'INTERNAL_ERROR'
        });
    }
}

/**
 * 统一认证接口
 */
export async function auth(req, res) {
    try {
        const {
            method,
            purpose,
            identifier,
            password,
            code_id: codeId,
            code
        } = req.body;

        let { userId } = req.body;

        // 对于需要登录状态的操作，从中间件获取userId
        if (['sudo', 'change_email', 'delete_account'].includes(purpose)) {
            if (!res.locals.userid) {
                return res.status(401).json({
                    status: 'error',
                    message: `${purpose}操作需要先登录`,
                    code: 'NEED_LOGIN'
                });
            }
            userId = res.locals.userid;
        }

        // 执行统一认证
        const authResult = await authenticate({
            method,
            purpose,
            userId,
            identifier,
            password,
            codeId,
            code
        });

        if (!authResult.success) {
            return res.status(400).json({
                status: 'error',
                message: authResult.message,
                code: 'AUTH_FAILED'
            });
        }

        // 根据认证目的执行相应操作
        let responseData = {};

        switch (purpose) {
            case 'login':
                // 生成登录令牌
                const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
                const ipAddress = req.ipInfo?.clientIP || req.ip;

                const tokenResult = await createUserLoginTokens(
                    authResult.user.id,
                    deviceInfo,
                    ipAddress
                );

                if (!tokenResult.success) {
                    return res.status(500).json({
                        status: 'error',
                        message: '生成登录令牌失败',
                        code: 'TOKEN_GENERATION_FAILED'
                    });
                }

                responseData = {
                    user: authResult.user,
                    access_token: tokenResult.accessToken,
                    refresh_token: tokenResult.refreshToken,
                    expires_in: tokenResult.expiresIn
                };
                break;

            case 'sudo':
                // 生成sudo令牌
                const sudoResult = await generateSudoToken(authResult.user.id);
                responseData = {
                    sudo_token: sudoResult.token,
                    expires_in: 0.5 * 60 // 15分钟
                };
                break;

            case 'reset_password':
            case 'change_email':
            case 'delete_account':
                // 这些操作需要额外的业务逻辑，这里只返回认证成功状态
                responseData = {
                    verified: true,
                    user_id: authResult.user.id
                };
                break;
        }

        res.json({
            status: 'success',
            message: `${purpose}认证成功`,
            data: responseData
        });

    } catch (error) {
        logger.error('[unified-auth-controller] 统一认证失败:', error);
        res.status(500).json({
            status: 'error',
            message: '认证时发生错误',
            code: 'INTERNAL_ERROR'
        });
    }
}

/**
 * 获取认证方法列表
 */
export async function getAuthMethods(req, res) {
    try {
        const { purpose = 'login' } = req.query;

        // 根据目的返回可用的认证方法
        const methods = {
            login: ['password', 'email'],
            sudo: ['password', 'email'],
            reset_password: ['email'],
            change_email: ['password', 'email'],
            delete_account: ['password', 'email']
        };

        res.json({
            status: 'success',
            data: {
                purpose,
                available_methods: methods[purpose] || ['password', 'email']
            }
        });
    } catch (error) {
        logger.error('[unified-auth-controller] 获取认证方法失败:', error);
        res.status(500).json({
            status: 'error',
            message: '获取认证方法时发生错误',
            code: 'INTERNAL_ERROR'
        });
    }
}