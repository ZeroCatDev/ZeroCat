import {Router} from "express";
import {needLogin} from "../middleware/auth.js";
import { requireSudo } from "../middleware/sudo.js";
import {tokenAuthMiddleware} from "../middleware.js";
import geetestMiddleware from "../middleware/geetest.js";
import {
    emailController,
    loginController,
    oauthController,
    registerController,
    tokenController,
    totpController
} from "../controllers/auth/index.js";
import {initializeOAuthProviders} from "../controllers/oauth.js";
import totpUtils from "../services/auth/totp.js";
import {invalidateTemporaryToken, validateTemporaryToken} from "../services/auth/verification.js";
import {prisma} from "../services/global.js";
import logger from "../services/logger.js";
import tokenUtils from "../services/auth/tokenUtils.js";

const {validateTotpToken} = totpUtils;

// 初始化 OAuth 配置
initializeOAuthProviders();

const router = Router();

// 登录相关路由
router.post("/login", geetestMiddleware, loginController.loginWithPassword);
router.post("/send-login-code", geetestMiddleware, loginController.sendLoginCode);
router.post("/login-with-code", loginController.loginWithCode);
router.post("/magiclink/generate", geetestMiddleware, loginController.sendMagicLinkForLogin);
router.get("/magiclink/validate", loginController.validateMagicLinkAndLogin);
router.post("/logout", tokenAuthMiddleware, loginController.logout);
router.post("/logout-all-devices", tokenAuthMiddleware, loginController.logoutAllDevices);
router.get("/logout", (req, res) => {
    res.locals.userid = null;
    res.redirect("/");
});

// 注册和密码管理相关路由
router.post("/register", geetestMiddleware, registerController.registerUser);
router.post("/register/verify-email", registerController.verifyEmail);
router.post("/register/resend-verification-email", registerController.resendVerificationEmail);
router.post("/register/change-register-email", registerController.changeRegisterEmail);
router.post("/retrievePassword", geetestMiddleware, registerController.retrievePassword);
router.post("/reset-password", registerController.resetPassword);
router.post("/set-password", registerController.setPassword);

// 邮箱管理相关路由
router.post("/send-verification-code", needLogin, emailController.sendVerificationCode);
router.get("/emails", needLogin, emailController.getEmails);
router.post("/add-email", needLogin, requireSudo, emailController.addEmail);
router.post("/remove-email", needLogin, requireSudo, emailController.removeEmail);

// TOTP相关路由
router.get("/totp/list", needLogin, totpController.getTotpList);
router.post("/totp/rename", needLogin, totpController.renameTotpToken);
router.post("/totp/check", totpController.checkTotpToken);
router.post("/totp/delete", needLogin, totpController.deleteTotpToken);
router.post("/totp/generate", needLogin, totpController.generateTotpToken);
router.post("/totp/activate", needLogin, totpController.activateTotpToken);
router.post("/totp/protected-route", validateTotpToken, (req, res) => {
    return res.json({
        status: "success",
        message: "请求成功，验证器令牌验证通过",
    });
});

// OAuth相关路由
router.get("/oauth/providers", oauthController.getOAuthProviders);
router.get("/oauth/bind/:provider", needLogin, oauthController.bindOAuth);
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
        return res.json(response);
    } catch (error) {
        logger.error(`处理令牌验证请求时出错: ${error.message}`, error);
        logger.error(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            status: "error",
            message: "令牌验证过程中发生错误"
        });
    }
});
router.post("/oauth/bound", needLogin, oauthController.getBoundOAuthAccounts);
router.post("/unlink-oauth", requireSudo, oauthController.unlinkOAuth);

// 令牌管理相关路由
router.post("/refresh-token", tokenController.refreshToken);
router.get("/token-details/:tokenId", needLogin, tokenController.getTokenDetails);
router.get("/active-tokens", needLogin, tokenController.getActiveTokens);
router.post("/revoke-token", needLogin, tokenController.revokeToken);

export default router;