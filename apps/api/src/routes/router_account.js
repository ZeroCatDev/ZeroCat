import {Router} from "express";
import {needLogin} from "../middleware/auth.js";
import { requireSudo } from "../middleware/sudo.js";
import { requireResource, requireScope } from "../middleware/scope.js";
import {tokenAuthMiddleware} from "../middleware.js";
import geetestMiddleware from "../middleware/geetest.js";
import {
    emailController,
    loginController,
    oauthController,
    registerController,
    tokenController,
    twoFactorController,
    passkeyController
} from "../controllers/auth/index.js";
import {initializeOAuthProviders} from "../controllers/oauth.js";
import {invalidateTemporaryToken, validateTemporaryToken} from "../services/auth/verification.js";
import {prisma} from "../services/prisma.js";
import logger from "../services/logger.js";
import tokenUtils from "../services/auth/tokenUtils.js";
import zcconfig from "../services/config/zcconfig.js";
import { buildAtprotoAuthClientMetadata } from '../services/social/atprotoAuthOAuth.js';


// 初始化 OAuth 配置
initializeOAuthProviders();

const router = Router();

function requireInteractiveSession(req, res, next) {
    if (res.locals.tokenType !== "session") {
        return res.status(403).json({
            status: "error",
            message: "此操作需要使用网页登录会话",
            code: "ZC_ERROR_SESSION_REQUIRED",
        });
    }
    return next();
}

// 登录相关路由
router.post("/login", geetestMiddleware, loginController.loginWithPassword);
router.post("/send-login-code", geetestMiddleware, loginController.sendLoginCode);
router.post("/login-with-code", loginController.loginWithCode);
router.post("/magiclink/generate", geetestMiddleware, loginController.sendMagicLinkForLogin);
router.get("/magiclink/validate", loginController.validateMagicLinkAndLogin);
router.post("/logout", tokenAuthMiddleware, loginController.logout);
router.post("/logout-all-devices", tokenAuthMiddleware, requireScope("token:manage"), requireSudo, loginController.logoutAllDevices);
router.get("/logout", (req, res) => {
    res.locals.userid = null;
    res.redirect("/");
});

// 注册和密码管理相关路由
router.get("/register/check", registerController.checkAvailability);
router.post("/register/begin", geetestMiddleware, registerController.beginRegister);
router.get("/register/validate-token", registerController.checkRegisterToken);
router.post("/register/complete", registerController.completeRegister);
router.post("/send-code", geetestMiddleware, registerController.retrievePassword);
router.post("/reset-password", registerController.resetPassword);
router.post("/set-password", needLogin, requireScope("user:update"), registerController.setPassword);

// 邮箱管理相关路由
router.post("/send-verification-code", needLogin, requireScope("user:update"), emailController.sendVerificationCode);
router.get("/emails", needLogin, requireScope("user:read"), emailController.getEmails);
router.post("/add-email", needLogin, requireScope("user:update"), requireSudo, emailController.addEmail);
router.post("/verify-email", needLogin, requireScope("user:update"), emailController.verifyEmail);
router.post("/remove-email", needLogin, requireScope("user:update"), requireSudo, emailController.removeEmail);
router.post("/set-primary-email", needLogin, requireScope("user:update"), requireSudo, emailController.setPrimaryEmail);
// 二次验证（2FA）相关路由
router.get("/2fa/status", needLogin, requireScope("user:read"), twoFactorController.status);
router.post("/2fa/setup", needLogin, requireScope("user:update"), requireSudo, twoFactorController.setup);
router.post("/2fa/activate", needLogin, requireScope("user:update"), requireSudo, twoFactorController.activate);
router.post("/2fa/disable", needLogin, requireScope("user:update"), requireSudo, twoFactorController.disable);
router.post("/2fa/login/totp", twoFactorController.finalizeLoginWithTotp);

// Passkey相关路由
router.post("/passkey/begin-registration", needLogin, requireScope("user:update"), requireSudo, passkeyController.beginRegistration);
router.post("/passkey/finish-registration", needLogin, requireScope("user:update"), requireSudo, passkeyController.finishRegistration);
router.post("/passkey/begin-login", passkeyController.beginLogin);
router.post("/passkey/finish-login", passkeyController.finishLogin);
router.post("/passkey/sudo-begin", needLogin, requireInteractiveSession, passkeyController.sudoWithPasskey);
router.post("/passkey/sudo-finish", needLogin, requireInteractiveSession, passkeyController.finalizeSudoWithPasskey);
router.get("/passkey/list", needLogin, requireScope("user:read"), passkeyController.listCredentials);
router.post("/passkey/delete", needLogin, requireScope("user:update"), requireSudo, passkeyController.deleteCredential);

// OAuth相关路由
router.get("/oauth/providers", oauthController.getOAuthProviders);
router.get('/oauth/bluesky/client-metadata.json', async (req, res) => {
    try {
        const metadata = await buildAtprotoAuthClientMetadata();

        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).json(metadata);
    } catch (error) {
        logger.error('[oauth] Build Bluesky client metadata failed:', error);
        res.status(500).json({ status: 'error', message: '生成Bluesky client metadata失败' });
    }
});
router.get("/oauth/bind/:provider", needLogin, requireScope("user:update"), oauthController.bindOAuth);
router.get("/oauth/:provider", oauthController.authWithOAuth);
router.get("/oauth/:provider/callback", oauthController.handleOAuthCallbackRequest);
// 使用临时令牌验证并获取用户信息
router.get("/oauth/validate-token/:token", async (req, res) => {
    const {token} = req.params;

    if (!token) {
        logger.warn('请求中未提供令牌');
        return res.status(400).json({
            status: "error",
            message: "未提供令牌"
        });
    }

    logger.debug(`处理令牌验证请求: ${token.substring(0, 8)}...`);

    try {
        // 验证临时令牌
        let tokenResult;
        try {
            tokenResult = await validateTemporaryToken(token, 'oauth_login');
            logger.debug(`令牌验证结果: ${JSON.stringify({
                success: tokenResult.success,
                message: tokenResult.message || ''
            })}`);
        } catch (validationError) {
            logger.error(`令牌验证函数抛出异常: ${validationError.message}`);
            return res.status(500).json({
                status: "error",
                message: "令牌验证处理异常"
            });
        }

        if (!tokenResult.success) {
            logger.warn(`令牌验证失败: ${tokenResult.message}`);
            return res.status(401).json({
                status: "error",
                message: tokenResult.message || "令牌验证失败"
            });
        }

        // 从令牌数据中获取用户信息
        if (!tokenResult.data || !tokenResult.data.userData) {
            logger.error(`令牌数据中缺少userData字段: ${JSON.stringify(Object.keys(tokenResult.data || {}))}`);
            return res.status(500).json({
                status: "error",
                message: "令牌数据格式错误"
            });
        }

        const userData = tokenResult.data.userData;
        logger.debug(`令牌验证成功，获取到用户数据: userId=${userData.userid}`);

        // 生成正式的登录令牌
        let user;
        try {
            user = await prisma.ow_users.findUnique({
                where: {id: userData.userid}
            });
            logger.debug(`数据库用户查询结果: ${!!user}`);
        } catch (dbError) {
            logger.error(`查询用户数据库错误: ${dbError.message}`);
            return res.status(500).json({
                status: "error",
                message: "查询用户信息失败"
            });
        }

        if (!user) {
            logger.error(`找不到令牌对应的用户: ${userData.userid}`);
            return res.status(404).json({
                status: "error",
                message: "用户不存在"
            });
        }

        // 使用新的令牌工具创建用户登录令牌
        let loginTokenResult;
        try {
            // 标准化用户信息
            const userInfo = await tokenUtils.getUserInfoForToken(user, userData.email);

            // 创建令牌
            loginTokenResult = await tokenUtils.createUserLoginTokens(
                user.id,
                userInfo,
                req.ip,
                req.headers['user-agent'],
                {
                    recordLoginEvent: true,
                    loginMethod: 'oauth'
                }
            );

            if (!loginTokenResult.success) {
                logger.error(`创建登录令牌失败: ${loginTokenResult.message}`);
                return res.status(500).json({
                    status: "error",
                    message: "创建登录令牌失败"
                });
            }

            logger.debug(`登录令牌创建成功: tokenId=${loginTokenResult.tokenId}`);
        } catch (tokenError) {
            logger.error(`创建会话令牌失败: ${tokenError.message}`, tokenError);
            logger.error(`错误堆栈: ${tokenError.stack}`);
            return res.status(500).json({
                status: "error",
                message: "创建会话令牌失败"
            });
        }

        // 令牌创建成功，立即使临时令牌失效
        try {
            await invalidateTemporaryToken(token);
            logger.info(`用户 ${user.id} 使用OAuth临时令牌登录成功，临时令牌已失效`);
        } catch (invalidateError) {
            logger.warn(`临时令牌失效处理出错(非致命): ${invalidateError.message}`);
            // 继续处理，不中断流程
        }

        // 生成登录响应
        const response = tokenUtils.generateLoginResponse(user, loginTokenResult, userData.email);
        return tokenUtils.respondWithBrowserAuthTokens(res, response);
    } catch (error) {
        logger.error(`处理令牌验证请求时出错: ${error.message}`, error);
        logger.error(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            status: "error",
            message: "令牌验证过程中发生错误"
        });
    }
});
router.post("/oauth/bound", needLogin, requireScope("user:read"), oauthController.getBoundOAuthAccounts);
router.post("/unlink-oauth", needLogin, requireScope("user:update"), requireSudo, oauthController.unlinkOAuth);

// 令牌管理相关路由
router.post("/refresh-token", tokenController.refreshToken);
router.get("/token-details/:tokenId", needLogin, requireResource("token", "read", "tokenId"), tokenController.getTokenDetails);
router.get("/active-tokens", needLogin, requireScope("token:read"), tokenController.getActiveTokens);
router.post("/revoke-token", needLogin, requireResource("token", "manage", "token_id"), tokenController.revokeToken);

export default router;
