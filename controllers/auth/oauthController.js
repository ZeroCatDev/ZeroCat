import logger from "../../services/logger.js";
import { prisma ,generateJwt} from "../../services/global.js";
import crypto from "crypto";
import memoryCache from "../../services/memoryCache.js";
import {
  OAUTH_PROVIDERS,
  generateAuthUrl,
  handleOAuthCallback,
  initializeOAuthProviders,

} from "../oauth.js";
import zcconfig from "../../services/config/zcconfig.js";
import { verifyContact } from "../email.js";
import { createTemporaryToken } from "../../services/auth/verification.js";
import redisClient from "../../services/redis.js";

/**
 * 获取支持的OAuth提供商列表
 */
export const getOAuthProviders = async (req, res) => {
  const providers = Object.values(OAUTH_PROVIDERS)
    .filter((provider) => provider.enabled) // 只返回已启用的提供商
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      enabled: provider.enabled
    }));

  res.status(200).json({
    status: "success",
    data: providers,
  });
};

/**
 * 处理OAuth绑定请求
 */
export const bindOAuth = async (req, res) => {
  try {
    const { provider } = req.params;
    if (!OAUTH_PROVIDERS[provider]) {
      return res.status(400).json({
        status: "error",
        message: "不支持的 OAuth 提供商",
      });
    }

    const state =
      crypto.randomBytes(16).toString("hex") + `:bind:${res.locals.userid}`;
    const authUrl = await generateAuthUrl(provider, state);

    // 存储 state 与用户 ID 的映射，用于回调时识别绑定操作
    memoryCache.set(
      `oauth_state:${state}`,
      { type: "bind", userId: res.locals.userid },
      600
    ); // 10分钟有效期

    res.redirect(authUrl);
  } catch (error) {
    logger.error("OAuth 绑定请求错误:", error);
    res.status(500).json({
      status: "error",
      message: "绑定请求失败",
    });
  }
};

/**
 * 处理OAuth登录请求
 */
export const authWithOAuth = async (req, res) => {
  try {
    const { provider } = req.params;
    if (!OAUTH_PROVIDERS[provider]) {
      logger.error("不支持的 OAuth 提供商:", provider);
      return res.status(400).json({
        status: "error",
        message: "不支持的 OAuth 提供商",
      });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const authUrl = await generateAuthUrl(provider, state);

    // 存储 state 用于验证回调
    memoryCache.set(`oauth_state:${state}`, true, 600); // 10分钟有效期

    res.redirect(authUrl);
  } catch (error) {
    logger.error("OAuth authorization error:", error);
    res.status(500).json({
      status: "error",
      message: "授权请求失败",
    });
  }
};

/**
 * 处理OAuth回调
 */
export const handleOAuthCallbackRequest = async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        status: "error",
        message: "无效的请求",
      });
    }

    const cachedState = memoryCache.get(`oauth_state:${state}`);
    if (!cachedState) {
      return res.redirect(
        `${await zcconfig.get(
          "urls.frontend"
        )}/app/account/oauth/bind/error?message=无效的state`
      );
    }

    // 根据 state 的类型处理不同的逻辑
    if (cachedState.type === "bind") {
      const userIdToBind = cachedState.userId;
      // 清除 state
      memoryCache.delete(`oauth_state:${state}`);

      const bindingResult = await handleOAuthCallback(
        provider,
        code,
        userIdToBind
      );

      // 处理绑定结果
      if (bindingResult.success) {
        return res.redirect(
          `${await zcconfig.get(
            "urls.frontend"
          )}/app/account/oauth/bind/success`
        );
      } else {
        return res.redirect(
          `${await zcconfig.get(
            "urls.frontend"
          )}/app/account/oauth/bind/error?message=${bindingResult.message}`
        );
      }
    } else {
      // 默认为登录操作
      memoryCache.delete(`oauth_state:${state}`);
      const { user, contact } = await handleOAuthCallback(provider, code);

      if (user && contact) {
        // 查询用户主邮箱
        const userEmail = await prisma.ow_users_contacts.findFirst({
          where: {
            user_id: user.id,
            contact_type: 'email',
            is_primary: true
          }
        });

        const email = userEmail ? userEmail.contact_value : null;

        // 准备要存储在Redis中的用户数据
        const userData = {
          userid: parseInt(user.id),
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
          email: email
        };

        // 创建临时令牌，用途为oauth_login，直接传递userData作为附加数据
        const tempToken = await createTemporaryToken(user.id, 'oauth_login', { userData });

        if (!tempToken.success) {
          logger.error(`OAuth登录创建临时令牌失败: ${tempToken.message}`);
          return res.redirect(
            `${await zcconfig.get(
              "urls.frontend"
            )}/app/account/oauth/login/error?message=生成临时令牌失败`
          );
        }

        logger.info(`创建OAuth临时令牌成功: userId=${user.id}, token=${tempToken.token.substring(0, 8)}...`);

        // 重定向到前端，并传递临时令牌
        return res.redirect(
          `${await zcconfig.get(
            "urls.frontend"
          )}/app/account/oauth/callback?temp_token=${tempToken.token}`
        );
      } else {
        return res.redirect(
          `${await zcconfig.get(
            "urls.frontend"
          )}/app/account/oauth/login/error?message=${contact && contact.message ? contact.message : '登录失败'}`
        );
      }
    }
  } catch (error) {
    logger.error("OAuth 回调错误:", error);
    logger.error(`OAuth 回调错误堆栈: ${error.stack}`);
    res.status(500).json({
      status: "error",
      message: "OAuth 处理失败"
    });
  }
};

/**
 * 获取用户绑定的OAuth账号
 */
export const getBoundOAuthAccounts = async (req, res) => {
  try {
    const userId = req.body.userid; // 假设用户 ID 存储在请求的用户信息中

    // 查找用户的所有 OAuth 联系方式
    const oauthContacts = await prisma.ow_users_contacts.findMany({
      where: {
        user_id: userId,
        contact_type: {
          in: ["oauth_google", "oauth_microsoft", "oauth_github", "oauth_linuxdo","oauth_40code"], // 只查找 OAuth 联系方式
        },
      },
      select: {
        contact_id: true,
        contact_type: true,
        is_primary: true,
        verified: true,
        created_at: true,
        updated_at: true,
        metadata: true,
      },
    });

    return res.status(200).json({
      status: "success",
      data: oauthContacts,
    });
  } catch (error) {
    logger.error("获取绑定的 OAuth 账号时出错:", error);
    return res.status(500).json({
      status: "error",
      message: "获取绑定的 OAuth 账号失败",
    });
  }
};

/**
 * 解绑OAuth账号
 */
export const unlinkOAuth = async (req, res) => {
  try {
    const { email, code, provider } = req.body;

    if (!email || !code || !provider) {
      return res.status(200).json({
        status: "error",
        message: "邮箱、验证码和 OAuth 提供商是必需的",
      });
    }

    // 验证验证码
    const isValid = await verifyContact(email, code);
    if (!isValid) {
      return res.status(200).json({
        status: "error",
        message: "验证码无效",
      });
    }

    // 查找 OAuth 联系方式
    const contact = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: res.locals.userid,
        contact_type: provider,
      },
    });

    if (!contact) {
      return res.status(200).json({
        status: "error",
        message: "未找到此 OAuth 联系方式",
      });
    }

    // 删除 OAuth 联系方式
    await prisma.ow_users_contacts.delete({
      where: { contact_id: contact.contact_id },
    });

    return res.status(200).json({
      status: "success",
      message: "成功解绑 OAuth 账号",
    });
  } catch (error) {
    logger.error("解绑 OAuth 账号时出错:", error);
    return res.status(200).json({
      status: "error",
      message: error.message || "解绑失败",
    });
  }
};