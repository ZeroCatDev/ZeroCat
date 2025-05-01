import { Router } from "express";
import { needLogin, strictTokenCheck, needAdmin } from "../middleware/auth.js";
import geetestMiddleware from "../middleware/geetest.js";
import {
  loginController,
  registerController,
  emailController,
  tokenController,
  totpController,
  oauthController
} from "../controllers/auth/index.js";
import { initializeOAuthProviders } from "../controllers/oauth.js";
import totpUtils from "../utils/totp.js";

const { validateTotpToken } = totpUtils;

// 初始化 OAuth 配置
initializeOAuthProviders();

const router = Router();

// 登录相关路由
router.post("/login", geetestMiddleware, loginController.loginWithPassword);
router.post("/send-login-code", geetestMiddleware, loginController.sendLoginCode);
router.post("/login-with-code", loginController.loginWithCode);
router.post("/magiclink/generate", geetestMiddleware, loginController.generateMagicLink);
router.get("/magiclink/validate", loginController.validateMagicLink);
router.post("/logout", strictTokenCheck, loginController.logout);
router.post("/logout-all-devices", strictTokenCheck, loginController.logoutAllDevices);
router.get("/logout", (req, res) => {
  res.locals.userid = null;
  res.redirect("/");
});

// 注册和密码管理相关路由
router.post("/register", geetestMiddleware, registerController.registerUser);
router.post("/retrievePassword", geetestMiddleware, registerController.retrievePassword);
router.post("/reset-password", geetestMiddleware, registerController.resetPassword);
router.post("/torepw", geetestMiddleware, registerController.resetPasswordWithToken);
router.post("/verify-email", registerController.verifyEmail);

// 邮箱管理相关路由
router.get("/emails", needLogin, emailController.getEmails);
router.post("/send-verification-code", needLogin, emailController.sendVerificationCode);
router.post("/add-email", needLogin, emailController.addEmail);
router.post("/remove-email", needLogin, emailController.removeEmail);

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
router.post("/oauth/bound", needLogin, oauthController.getBoundOAuthAccounts);
router.post("/confirm-unlink-oauth", oauthController.unlinkOAuth);

// 令牌管理相关路由
router.post("/refresh-token", tokenController.refreshToken);
router.get("/token-details/:tokenId", needLogin, tokenController.getTokenDetails);
router.get("/active-tokens", needLogin, tokenController.getActiveTokens);
router.post("/revoke-token", needLogin, tokenController.revokeToken);

export default router;