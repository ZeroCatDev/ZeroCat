import { Router } from "express";
import { needlogin, strictTokenCheck, needadmin } from "../middleware/auth.js";
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
router.get("/emails", needlogin, emailController.getEmails);
router.post("/send-verification-code", needlogin, emailController.sendVerificationCode);
router.post("/add-email", needlogin, emailController.addEmail);
router.post("/remove-email", needlogin, emailController.removeEmail);

// TOTP相关路由
router.get("/totp/list", needlogin, totpController.getTotpList);
router.post("/totp/rename", needlogin, totpController.renameTotpToken);
router.post("/totp/check", totpController.checkTotpToken);
router.post("/totp/delete", needlogin, totpController.deleteTotpToken);
router.post("/totp/generate", needlogin, totpController.generateTotpToken);
router.post("/totp/activate", needlogin, totpController.activateTotpToken);
router.post("/totp/protected-route", validateTotpToken, (req, res) => {
  return res.json({
    status: "success",
    message: "请求成功，验证器令牌验证通过",
  });
});

// OAuth相关路由
router.get("/oauth/providers", oauthController.getOAuthProviders);
router.get("/oauth/bind/:provider", needlogin, oauthController.bindOAuth);
router.get("/oauth/:provider", oauthController.authWithOAuth);
router.get("/oauth/:provider/callback", oauthController.handleOAuthCallbackRequest);
router.post("/oauth/bound", needlogin, oauthController.getBoundOAuthAccounts);
router.post("/confirm-unlink-oauth", oauthController.unlinkOAuth);

// 令牌管理相关路由
router.post("/refresh-token", tokenController.refreshToken);
router.get("/token-details/:tokenId", needlogin, tokenController.getTokenDetails);
router.get("/active-tokens", needlogin, tokenController.getActiveTokens);
router.post("/revoke-token", needlogin, tokenController.revokeToken);

export default router;