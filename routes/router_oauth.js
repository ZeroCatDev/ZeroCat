import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import { Router } from "express";
import { prisma } from "../services/global.js";
import { needLogin, strictTokenCheck, needAdmin } from "../middleware/auth.js";
import { oauthRateLimit } from "../middleware/rateLimit.js";
import crypto from "crypto";
import {
  validateRedirectUri,
  generateAuthCode,
  generateTokens,
  validateScopes,
} from "../services/auth/oauth.js";
import {
  generateOAuthTokens,
  refreshOAuthTokens,
  verifyOAuthClientCredentials,
} from "../services/auth/tokenManager.js";
import fs from "fs";
import { S3update } from "../services/global.js";
import multer from "multer";

const router = Router();
const upload = multer({ dest: "./usercontent" });

// OAuth错误处理函数
const OAuthErrors = {
  // 通用错误
  INVALID_REQUEST: {
    error: "invalid_request",
    description: "Invalid request parameters"
  },
  SERVER_ERROR: {
    error: "server_error",
    description: "Internal server error"
  },

  // 客户端错误
  INVALID_CLIENT: {
    error: "invalid_client",
    description: "应用不存在"
  },
  UNAUTHORIZED_CLIENT: {
    error: "unauthorized_client",
    description: "应用未授权"
  },

  // 授权错误
  INVALID_GRANT: {
    error: "invalid_grant",
    description: "授权码无效"
  },
  UNSUPPORTED_GRANT_TYPE: {
    error: "unsupported_grant_type",
    description: "不支持的授权类型"
  },
  UNSUPPORTED_RESPONSE_TYPE: {
    error: "unsupported_response_type",
    description: "不支持的授权响应类型"
  },

  // 作用域错误
  INVALID_SCOPE: {
    error: "invalid_scope",
    description: "请求的权限范围无效"
  },

  // 令牌错误
  INVALID_TOKEN: {
    error: "invalid_token",
    description: "访问令牌无效"
  }
};

/**
 * 构建错误重定向URL
 * @param {string} error - 错误代码
 * @param {string} description - 错误描述
 * @param {string} [state] - OAuth state参数
 * @returns {Promise<string>} 重定向URL
 */
async function buildErrorRedirectUrl(error, description, state = null) {
  const frontendUrl = await zcconfig.get("urls.frontend");
  const errorUrl = new URL("/app/oauth/error", frontendUrl);
  errorUrl.searchParams.set("error", error);
  errorUrl.searchParams.set("error_description", description);
  if (state) {
    errorUrl.searchParams.set("state", state);
  }
  return errorUrl.toString();
}

/**
 * 处理授权端点错误 - 直接重定向
 * @param {Object} res - Express response对象
 * @param {Object} errorInfo - 错误信息对象
 * @param {string} [state] - OAuth state参数
 */
async function handleAuthorizationError(res, errorInfo, state = null) {
  const redirectUrl = await buildErrorRedirectUrl(
    errorInfo.error,
    errorInfo.description,
    state
  );
  return res.redirect(redirectUrl);
}

/**
 * 处理API端点错误 - 返回重定向URL
 * @param {Object} res - Express response对象
 * @param {Object} errorInfo - 错误信息对象
 * @param {string} [state] - OAuth state参数
 */
async function handleApiError(res, errorInfo, state = null) {
  const redirectUrl = await buildErrorRedirectUrl(
    errorInfo.error,
    errorInfo.description,
    state
  );
  return res.json({ redirect_url: redirectUrl });
}

/**
 * 处理用户信息端点错误 - 设置WWW-Authenticate头并返回重定向URL
 * @param {Object} res - Express response对象
 * @param {Object} errorInfo - 错误信息对象
 */
async function handleUserInfoError(res, errorInfo) {
  res.set(
    "WWW-Authenticate",
    `Bearer error="${errorInfo.error}", error_description="${errorInfo.description}"`
  );
  const redirectUrl = await buildErrorRedirectUrl(
    errorInfo.error,
    errorInfo.description
  );
  return res.json({ redirect_url: redirectUrl });
}

// 创建新的OAuth应用
router.post("/applications", needLogin, async (req, res) => {
  try {
    const {
      name,
      description,
      homepage_url,
      redirect_uris,
      type = "oauth",
      webhook_url,
      logo_url,
      terms_url,
      privacy_url,
    } = req.body;

    // 基本验证
    if (!name || !redirect_uris || !Array.isArray(redirect_uris)) {
      return res.status(400).json({ error: "缺少必填字段" });
    }

    // 生成client_id和client_secret
    const client_id = crypto.randomBytes(16).toString("hex");
    const client_secret = crypto.randomBytes(32).toString("hex");

    // 设置默认权限范围
    const defaultScopes = ["user:basic", "user:email"];

    const application = await prisma.ow_oauth_applications.create({
      data: {
        owner_id: res.locals.userid,
        name,
        description,
        homepage_url,
        client_id,
        client_secret,
        redirect_uris,
        type,
        scopes: defaultScopes,
        webhook_url,
        logo_url,
        terms_url,
        privacy_url,
      },
    });

    res.json({
      ...application,
      client_secret, // 只在创建时返回
    });
  } catch (error) {
    logger.error("Create OAuth application error:", error);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 获取应用列表
router.get("/applications", needLogin, async (req, res) => {
  try {
    const applications = await prisma.ow_oauth_applications.findMany({
      where: {
        owner_id: res.locals.userid,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        description: true,
        client_id: true,
        type: true,
        status: true,
        created_at: true,
        is_public: true,
        is_verified: true,
      },
    });
    res.json(applications);
  } catch (error) {
    logger.error("Get OAuth applications error:", error);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 获取应用详情
router.get("/applications/:client_id", async (req, res) => {
  try {
    const { client_id } = req.params;

    const application = await prisma.ow_oauth_applications.findFirst({
      where: { client_id, status: "active" },
      select: {
        id: true,
        name: true,
        description: true,
        homepage_url: true,
        logo_url: true,
        terms_url: true,
        privacy_url: true,
        is_verified: true,
        type: true,
        scopes: true,
        client_id: true,
        client_secret: true,
        redirect_uris: true,
        webhook_url: true,
        owner_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  } catch (error) {
    logger.error("Get OAuth application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 上传应用徽标
router.post(
  "/applications/:client_id/logo",
  needLogin,
  (req, res, next) => {
    upload.single("zcfile")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return handleApiError(res, {
          error: OAuthErrors.INVALID_REQUEST.error,
          description: "文件上传失败：" + (
            err.code === "LIMIT_FILE_SIZE" ? "文件太大" :
            err.code === "LIMIT_FILE_COUNT" ? "文件数量超限" :
            err.code === "LIMIT_FIELD_KEY" ? "字段名无效" :
            err.code === "LIMIT_FIELD_VALUE" ? "字段值无效" :
            err.code === "LIMIT_FIELD_COUNT" ? "字段数量超限" :
            err.code === "LIMIT_UNEXPECTED_FILE" ? "未预期的文件字段" :
            "上传参数错误"
          )
        });
      } else if (err) {
        logger.error("File upload error:", err);
        return handleApiError(res, OAuthErrors.SERVER_ERROR);
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return handleApiError(res, {
          error: OAuthErrors.INVALID_REQUEST.error,
          description: "请选择要上传的文件"
        });
      }

      const { client_id } = req.params;

      // 查找应用并验证所有权
      const application = await prisma.ow_oauth_applications.findFirst({
        where: {
          client_id,
          owner_id: res.locals.userid,
          status: { not: "deleted" },
        },
      });

      if (!application) {
        return handleApiError(res, OAuthErrors.INVALID_CLIENT);
      }

      // 处理文件上传
      const file = req.file;
      const hash = crypto.createHash("md5");
      const chunks = fs.createReadStream(file.path);

      chunks.on("data", (chunk) => {
        if (chunk) hash.update(chunk);
      });

      chunks.on("end", async () => {
        const hashValue = hash.digest("hex");
        const fileBuffer = await fs.promises.readFile(file.path);

        try {
          // 上传到S3
          await S3update(`material/asset/${hashValue}`, fileBuffer);

          // 更新应用信息
          await prisma.ow_oauth_applications.update({
            where: { id: application.id },
            data: {
              logo_url: hashValue,
              updated_at: new Date(),
            },
          });

          // 清理临时文件
          fs.unlink(file.path, (err) => {
            if (err) logger.error("Error deleting temp file:", err);
          });

          res.json({
            code: 'success',
            message: "徽标上传成功",
            logo_url: `${await zcconfig.get("s3.staticurl")}/material/asset/${hashValue}`,
          });
        } catch (error) {
          // 清理临时文件
          fs.unlink(file.path, (err) => {
            if (err) logger.error("Error deleting temp file:", err);
          });

          logger.error("S3 upload or database update error:", error);
          return handleApiError(res, OAuthErrors.SERVER_ERROR);
        }
      });

      chunks.on("error", (err) => {
        // 清理临时文件
        fs.unlink(file.path, (err) => {
          if (err) logger.error("Error deleting temp file:", err);
        });

        logger.error("Error processing file upload:", err);
        return handleApiError(res, {
          error: OAuthErrors.INVALID_REQUEST.error,
          description: "文件处理失败"
        });
      });
    } catch (error) {
      logger.error("Upload OAuth application logo error:", error);
      return handleApiError(res, OAuthErrors.SERVER_ERROR);
    }
  }
);

// 更新应用信息
router.put("/applications/:client_id", needLogin, async (req, res) => {
  try {
    const { client_id } = req.params;
    const {
      name,
      description,
      homepage_url,
      redirect_uris,
      type,
      scopes,
      webhook_url,
      logo_url,
      terms_url,
      privacy_url,
    } = req.body;

    // 查找应用并验证所有权
    const application = await prisma.ow_oauth_applications.findFirst({
      where: {
        client_id,
        owner_id: res.locals.userid,
        status: { not: "deleted" },
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 基本验证
    if (name && (!redirect_uris || !Array.isArray(redirect_uris))) {
      return res.status(400).json({ error: "无效的重定向URI" });
    }

    // 更新应用信息
    const updatedApplication = await prisma.ow_oauth_applications.update({
      where: { id: application.id },
      data: {
        name: name || undefined,
        description: description || undefined,
        homepage_url: homepage_url || undefined,
        redirect_uris: redirect_uris || undefined,
        type: type || undefined,
        scopes: scopes || undefined,
        webhook_url: webhook_url || undefined,
        logo_url: logo_url || undefined,
        terms_url: terms_url || undefined,
        privacy_url: privacy_url || undefined,
        updated_at: new Date(),
      },
    });

    res.json(updatedApplication);
  } catch (error) {
    logger.error("Update OAuth application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 删除应用（软删除）
router.delete("/applications/:client_id", needLogin, async (req, res) => {
  try {
    const { client_id } = req.params;

    // 查找应用并验证所有权
    const application = await prisma.ow_oauth_applications.findFirst({
      where: {
        client_id,
        owner_id: res.locals.userid,
        status: { not: "deleted" },
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 软删除应用
    await prisma.ow_oauth_applications.update({
      where: { id: application.id },
      data: {
        status: "deleted",
        updated_at: new Date(),
      },
    });

    // 撤销所有相关的访问令牌
    await prisma.ow_oauth_access_tokens.updateMany({
      where: { application_id: application.id },
      data: {
        is_revoked: true,
        updated_at: new Date(),
      },
    });

    // 更新所有相关的授权记录
    await prisma.ow_oauth_authorizations.updateMany({
      where: { application_id: application.id },
      data: {
        status: "revoked",
        updated_at: new Date(),
      },
    });

    res.json({ code: 'success', message: "应用删除成功" });
  } catch (error) {
    logger.error("Delete OAuth application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 获取用户已验证的邮箱列表
router.get("/user/emails", needLogin, async (req, res) => {
  try {
    const verifiedEmails = await prisma.ow_users_contacts.findMany({
      where: {
        user_id: res.locals.userid,
        contact_type: "email",
        verified: true,
      },
      select: {
        contact_value: true,
        is_primary: true,
        verified: true,
      },
    });

    res.json(verifiedEmails);
  } catch (error) {
    logger.error("Get user emails error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// OAuth2.0授权端点 - 验证请求并重定向到前端
router.get("/authorize", async (req, res) => {
  try {
    const {
      response_type = "code",
      client_id,
      redirect_uri,
      scope,
      state,
    } = req.query;

    // 验证基本参数
    if (!client_id || !redirect_uri) {
      return handleAuthorizationError(
        res,
        {
          error: OAuthErrors.INVALID_REQUEST.error,
          description: "Missing required parameters: client_id and redirect_uri"
        },
        state
      );
    }

    // 查找应用
    const application = await prisma.ow_oauth_applications.findFirst({
      where: { client_id, status: "active" },
    });

    if (!application) {
      return handleAuthorizationError(res, OAuthErrors.INVALID_CLIENT, state);
    }

    // 验证重定向URI
    if (!validateRedirectUri(redirect_uri, application.redirect_uris)) {
      return handleAuthorizationError(
        res,
        {
          error: OAuthErrors.INVALID_REQUEST.error,
          description: "Invalid redirect URI"
        },
        state
      );
    }

    // 验证response_type
    if (response_type !== "code") {
      return handleAuthorizationError(res, OAuthErrors.UNSUPPORTED_RESPONSE_TYPE, state);
    }

    // 验证权限范围
    const requestedScopes = scope ? scope.split(" ") : [];
    if (!validateScopes(requestedScopes, application.scopes)) {
      return handleAuthorizationError(res, OAuthErrors.INVALID_SCOPE, state);
    }

    // 构建前端URL
    const frontendUrl = new URL(
      "/app/oauth/authorize",
      await zcconfig.get("urls.frontend")
    );
    frontendUrl.searchParams.set("client_id", client_id);
    frontendUrl.searchParams.set("redirect_uri", redirect_uri);
    frontendUrl.searchParams.set("scope", scope || "");
    if (state) frontendUrl.searchParams.set("state", state);

    // 重定向到前端
    res.redirect(frontendUrl.toString());
  } catch (error) {
    logger.error("OAuth authorize error:", error);
    return handleAuthorizationError(res, OAuthErrors.SERVER_ERROR, state);
  }
});

// 处理用户授权 - API接口
router.post("/authorize/confirm", needLogin, async (req, res) => {
  try {
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      authorized_email,
    } = req.body;

    // 验证邮箱是否属于用户且已验证
    const emailContact = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: res.locals.userid,
        contact_type: "email",
        contact_value: authorized_email,
        verified: true,
      },
    });

    if (!emailContact) {
      return handleApiError(res, {
        error: OAuthErrors.INVALID_REQUEST.error,
        description: "Invalid or unverified email address"
      });
    }

    // 查找应用
    const application = await prisma.ow_oauth_applications.findFirst({
      where: { client_id, status: "active" },
    });

    if (!application) {
      return handleApiError(res, OAuthErrors.INVALID_CLIENT);
    }

    // 验证重定向URI
    if (!validateRedirectUri(redirect_uri, application.redirect_uris)) {
      return handleApiError(res, {
        error: OAuthErrors.INVALID_REQUEST.error,
        description: "Invalid redirect URI"
      });
    }

    // 生成授权码
    const authCode = await generateAuthCode();

    // 创建或更新授权记录
    const authorization = await prisma.ow_oauth_authorizations.upsert({
      where: {
        application_id_user_id: {
          application_id: application.id,
          user_id: res.locals.userid,
        },
      },
      update: {
        authorized_email,
        scopes: scope,
        code: authCode,
        code_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10分钟有效期
        status: "active",
        last_used_at: new Date(),
      },
      create: {
        application_id: application.id,
        user_id: res.locals.userid,
        authorized_email,
        scopes: scope,
        code: authCode,
        code_expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // 构建重定向URL
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", authCode);
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    // 返回重定向URL
    res.json({
      redirect_url: redirectUrl.toString(),
    });
  } catch (error) {
    logger.error("OAuth authorize confirmation error:", error);
    return handleApiError(res, OAuthErrors.SERVER_ERROR);
  }
});

// OAuth2.0令牌端点
router.post("/token", oauthRateLimit, async (req, res) => {
  try {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      client_secret,
      refresh_token,
    } = req.body;

    // 验证授权类型
    if (!["authorization_code", "refresh_token"].includes(grant_type)) {
      return handleApiError(res, OAuthErrors.UNSUPPORTED_GRANT_TYPE);
    }

    // 验证应用凭证
    const application = await verifyOAuthClientCredentials(
      client_id,
      client_secret
    );
    if (!application) {
      return handleApiError(res, OAuthErrors.INVALID_CLIENT);
    }

    if (grant_type === "authorization_code") {
      // 验证授权码
      const authorization = await prisma.ow_oauth_authorizations.findFirst({
        where: {
          code,
          application_id: application.id,
          code_expires_at: { gt: new Date() },
          status: "active",
        },
      });

      if (!authorization) {
        return handleApiError(res, OAuthErrors.INVALID_GRANT);
      }

      // 生成访问令牌和刷新令牌
      const { accessToken, refreshToken, expiresIn } =
        await generateOAuthTokens(
          authorization.user_id,
          application.id,
          authorization.id,
          authorization.scopes
        );

      // 清除授权码
      await prisma.ow_oauth_authorizations.update({
        where: { id: authorization.id },
        data: {
          code: null,
          last_used_at: new Date(),
        },
      });

      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        refresh_token: refreshToken,
        scope: authorization.scopes
      });
    } else if (grant_type === "refresh_token") {
      // 刷新令牌
      try {
        const result = await refreshOAuthTokens(refresh_token, application.id);

        if (!result || !result.accessToken) {
          return handleApiError(res, {
            error: OAuthErrors.INVALID_GRANT.error,
            description: "Refresh token is invalid or expired"
          });
        }

        res.json({
          access_token: result.accessToken,
          token_type: "Bearer",
          expires_in: result.expiresIn,
          refresh_token: result.refreshToken,
          scope: result.scope
        });
      } catch (error) {
        logger.error("Token refresh error:", error);
        return handleApiError(res, {
          error: OAuthErrors.INVALID_GRANT.error,
          description: error.message || "Refresh token is invalid or expired"
        });
      }
    }
  } catch (error) {
    logger.error("OAuth token error:", error);
    return handleApiError(res, OAuthErrors.SERVER_ERROR);
  }
});

// 用户信息端点
router.get("/userinfo", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return handleUserInfoError(res, OAuthErrors.INVALID_TOKEN);
    }

    const accessToken = authHeader.substring(7);

    // 查找访问令牌
    const token = await prisma.ow_oauth_access_tokens.findFirst({
      where: {
        access_token: accessToken,
        expires_at: { gt: new Date() },
        is_revoked: false,
      },
      include: {
        authorization: true,
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar: true,
          },
        },
      },
    });

    if (!token) {
      return handleUserInfoError(res, {
        error: OAuthErrors.INVALID_TOKEN.error,
        description: "Token is invalid or expired"
      });
    }

    // 更新令牌使用信息
    await prisma.ow_oauth_access_tokens.update({
      where: { id: token.id },
      data: {
        last_used_at: new Date(),
        last_used_ip: req.ip,
      },
    });

    // 构建头像URL
    const avatarUrl = token.user.avatar
      ? `${await zcconfig.get("s3.staticurl")}/user/${token.user.avatar}`
      : null;

    // 返回用户信息
    res.json({
      openid: (await zcconfig.get("site.name")).toLowerCase() + "_" + token.user.id.toString(),
      username: token.user.username,
      nickname: token.user.display_name,
      avatar: avatarUrl,
      email: token.authorization.authorized_email,
      email_verified: true
    });
  } catch (error) {
    logger.error("OAuth userinfo error:", error);
    return handleUserInfoError(res, OAuthErrors.SERVER_ERROR);
  }
});

export default router;
