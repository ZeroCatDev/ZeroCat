import logger from '../../services/logger.js';
import {
    sendVerificationCode,
    authenticate
} from '../../services/auth/unifiedAuth.js';

/**
 * 发送登录验证码（统一接口）
 * 注意：建议使用统一认证接口 POST /auth/send-code
 */
export const sendLoginCode = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: '邮箱是必需的',
                code: 'EMAIL_REQUIRED'
            });
        }

        const result = await sendVerificationCode(null, email, 'login');

        if (result.success) {
            res.json({
                status: 'success',
                message: result.message,
                data: {
                    code_id: result.codeId,
                    email: email,
                    expires_in: 300 // 5分钟
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
        logger.error('[unified-login] 发送登录验证码失败:', error);
        res.status(500).json({
            status: 'error',
            message: '发送验证码时发生错误',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * 统一登录接口
 * 注意：建议使用统一认证接口 POST /auth/authenticate
 */
export const unifiedLogin = async (req, res) => {
    try {
        const {
            method,
            identifier,
            password,
            code_id: codeId,
            code
        } = req.body;

        // 执行统一认证
        const authResult = await authenticate({
            method,
            purpose: 'login',
            identifier,
            password,
            codeId,
            code
        });

        if (authResult.success) {
            res.json({
                status: 'success',
                message: '登录成功',
                data: {
                    user: authResult.user,
                    access_token: authResult.data?.access_token,
                    refresh_token: authResult.data?.refresh_token,
                    expires_in: authResult.data?.expires_in
                }
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: authResult.message,
                code: 'LOGIN_FAILED'
            });
        }
    } catch (error) {
        logger.error('[unified-login] 统一登录失败:', error);
        res.status(500).json({
            status: 'error',
            message: '登录时发生错误',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * 密码登录（兼容接口）
 */
export const loginWithPassword = async (req, res) => {
    try {
        const { un: identifier, pw: password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                status: 'error',
                message: '用户名和密码都是必需的'
            });
        }

        // 使用统一认证
        const authResult = await authenticate({
            method: 'password',
            purpose: 'login',
            identifier,
            password
        });

        if (authResult.success) {
            // 统一认证层不直接签发令牌
            res.json({
                status: 'success',
                message: '认证成功',
                data: { user: authResult.user }
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: authResult.message
            });
        }
    } catch (error) {
        logger.error('[unified-login] 密码登录失败:', error);
        res.status(500).json({
            status: 'error',
            message: '登录失败'
        });
    }
};

/**
 * 验证码登录（兼容接口）
 */
export const loginWithCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                status: 'error',
                message: '邮箱和验证码都是必需的'
            });
        }

        // 注意：这里需要先通过邮箱获取code_id
        // 在实际应用中，前端应该保存发送验证码时返回的code_id
        // 这里为了兼容性，我们使用email作为标识符查找验证码

        res.status(501).json({
            status: 'error',
            message: '此接口需要升级，请使用 /auth/authenticate 接口',
            code: 'DEPRECATED'
        });
    } catch (error) {
        logger.error('[unified-login] 验证码登录失败:', error);
        res.status(500).json({
            status: 'error',
            message: '登录失败'
        });
    }
};