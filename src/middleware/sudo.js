import logger from '../services/logger.js';
import { verifySudoToken } from '../services/auth/sudoAuth.js';

/**
 * sudo验证中间件
 * 验证请求是否包含有效的sudo令牌（或已通过passkey二次验证）
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const requireSudo = async (req, res, next) => {
    try {
        // 确保用户已登录
        if (!res.locals.userid) {
            return res.status(401).json({
                status: 'error',
                message: '需要登录后才能进行sudo操作',
                code: 'SUDO_NEED_LOGIN'
            });
        }

        // 获取sudo令牌 - 从多个来源尝试获取
        let sudoToken = null;

        // 1. 从Authorization header获取 (格式: Sudo <token>)
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'sudo') {
                sudoToken = parts[1];
            }
        }

        // 2. 从X-Sudo-Token header获取
        if (!sudoToken && req.headers['x-sudo-token']) {
            sudoToken = req.headers['x-sudo-token'];
        }

        // 3. 从query参数获取
        if (!sudoToken && req.query.sudo_token) {
            sudoToken = req.query.sudo_token;
        }

        // 4. 从请求体获取
        if (!sudoToken && req.body && req.body.sudo_token) {
            sudoToken = req.body.sudo_token;
        }

        if (!sudoToken) {
            return res.status(403).json({
                status: 'error',
                message: '此操作需要sudo权限，请先进入sudo模式',
                code: 'SUDO_TOKEN_REQUIRED'
            });
        }

        // 验证sudo令牌
        const verification = await verifySudoToken(sudoToken);

        if (!verification.valid) {
            return res.status(403).json({
                status: 'error',
                message: verification.message,
                code: 'SUDO_TOKEN_INVALID'
            });
        }

        // 验证令牌是否属于当前用户
        if (verification.userId !== res.locals.userid) {
            logger.warn(`[sudo] 用户 ${res.locals.userid} 尝试使用其他用户的sudo令牌`);
            return res.status(403).json({
                status: 'error',
                message: 'sudo令牌不属于当前用户',
                code: 'SUDO_TOKEN_MISMATCH'
            });
        }

        // 在响应对象中标记已通过sudo验证
        res.locals.sudoVerified = true;
        res.locals.sudoToken = sudoToken;

        next();
    } catch (error) {
        logger.error('[sudo] sudo验证中间件错误:', error);
        return res.status(500).json({
            status: 'error',
            message: '验证sudo权限时发生错误',
            code: 'SUDO_VERIFICATION_ERROR'
        });
    }
};

/**
 * 可选的sudo验证中间件
 * 如果提供了sudo令牌则验证，但不强制要求
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const optionalSudo = async (req, res, next) => {
    try {
        // 获取sudo令牌
        let sudoToken = null;

        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'sudo') {
                sudoToken = parts[1];
            }
        }

        if (!sudoToken && req.headers['x-sudo-token']) {
            sudoToken = req.headers['x-sudo-token'];
        }

        if (!sudoToken && req.query.sudo_token) {
            sudoToken = req.query.sudo_token;
        }

        if (!sudoToken && req.body && req.body.sudo_token) {
            sudoToken = req.body.sudo_token;
        }

        if (!sudoToken) {
            // 没有提供sudo令牌，继续处理但不标记sudo验证
            res.locals.sudoVerified = false;
            return next();
        }

        // 验证提供的sudo令牌
        const verification = await verifySudoToken(sudoToken);

        if (verification.valid && verification.userId === res.locals.userid) {
            res.locals.sudoVerified = true;
            res.locals.sudoToken = sudoToken;
        } else {
            res.locals.sudoVerified = false;
        }

        next();
    } catch (error) {
        logger.error('[sudo] 可选sudo验证中间件错误:', error);
        res.locals.sudoVerified = false;
        next();
    }
};