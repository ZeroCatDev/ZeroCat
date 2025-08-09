import { Router } from 'express';
import { parseToken, needLogin } from '../middleware/auth.js';
import {
    sendCode,
    auth,
    getAuthMethods
} from '../controllers/auth/unifiedAuthController.js';

const router = Router();

// 应用通用中间件
router.use(parseToken);

/**
 * GET /auth/methods
 * 获取可用的认证方法
 * 查询参数: purpose (login, sudo, reset_password, change_email, delete_account)
 */
router.get('/methods', getAuthMethods);

/**
 * POST /auth/send-code
 * 统一发送验证码接口
 * 支持所有认证场景：登录、sudo、重置密码、更改邮箱、删除账户等
 *
 * 请求体:
 * - email: 邮箱地址（可选，某些场景下会自动获取用户邮箱）
 * - purpose: 认证目的 (login, sudo, reset_password, change_email, delete_account)
 * - userId: 用户ID（某些场景下可选，会从登录状态获取）
 */
router.post('/send-code', (req, res, next) => {
    // 根据purpose决定是否需要登录
    const { purpose } = req.body;
    if (['sudo', 'change_email', 'delete_account'].includes(purpose)) {
        return needLogin(req, res, next);
    }
    next();
}, sendCode);

/**
 * POST /auth/authenticate
 * 统一认证接口
 * 支持多种认证方式和认证目的
 *
 * 请求体:
 * - method: 认证方式 (password, email, totp, passkey)
 * - purpose: 认证目的 (login, sudo, reset_password, change_email, delete_account)
 * - identifier: 用户标识符（用户名或邮箱，login时使用）
 * - userId: 用户ID（非login时使用，某些情况下会从登录状态获取）
 * - password: 密码（password方式）
 * - code_id: 验证码ID（email方式）
 * - code: 验证码（email方式）
 */
router.post('/authenticate', (req, res, next) => {
    // 根据purpose决定是否需要登录
    const { purpose } = req.body;
    if (['sudo', 'change_email', 'delete_account'].includes(purpose)) {
        return needLogin(req, res, next);
    }
    next();
}, auth);

export default router;