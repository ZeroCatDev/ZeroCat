import { prisma } from "../utils/global.js";
import logger from '../utils/logger.js';
import configManager from "../utils/configManager.js";
import crypto from 'crypto';

// OAuth 提供商基础配置
export const OAUTH_PROVIDERS = {
  google: {
    id: 'google',
    name: 'Google',
    type: 'oauth_google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    enabled: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    type: 'oauth_microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'openid email profile User.Read',
    enabled: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null
  },
  github: {
    id: 'github',
    name: 'GitHub',
    type: 'oauth_github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    enabled: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null
  }
};

// 初始化 OAuth 配置
export async function initializeOAuthProviders() {
  try {
    // 从数据库读取所有 OAuth 相关配置
    for (const provider of Object.values(OAUTH_PROVIDERS)) {
      const enabled = await configManager.getConfig(`oauth.${provider.id}.enabled`);
      const clientId = await configManager.getConfig(`oauth.${provider.id}.client_id`);
      const clientSecret = await configManager.getConfig(`oauth.${provider.id}.client_secret`);
      const baseUrl = await configManager.getConfig('urls.backend');

      provider.enabled = enabled === 'true';
      provider.clientId = clientId;
      provider.clientSecret = clientSecret;
      provider.redirectUri = `${baseUrl}/account/oauth/${provider.id}/callback`;

      logger.info(`OAuth provider ${provider.name} initialized, enabled: ${provider.enabled}`);
    }
  } catch (error) {
    logger.error('Failed to initialize OAuth providers:', error);
  }
}

// 生成 OAuth 授权 URL
export function generateAuthUrl(provider, state) {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) throw new Error('不支持的 OAuth 提供商');
  if (!config.enabled) throw new Error('此 OAuth 提供商未启用');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: state
  });

  return `${config.authUrl}?${params.toString()}`;
}

// 获取 OAuth 访问令牌
async function getAccessToken(provider, code) {
  const config = OAUTH_PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  return await response.json();
}

// 获取用户信息的函数映射
const getUserInfoFunctions = {
  google: async (accessToken) => {
    const response = await fetch(OAUTH_PROVIDERS.google.userInfoUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return {
      id: data.sub,
      email: data.email,
      name: data.name
    };
  },

  microsoft: async (accessToken) => {
    const response = await fetch(OAUTH_PROVIDERS.microsoft.userInfoUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      name: data.displayName
    };
  },

  github: async (accessToken) => {
    const [userResponse, emailsResponse] = await Promise.all([
      fetch(OAUTH_PROVIDERS.github.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
    ]);

    const userData = await userResponse.json();
    const emailsData = await emailsResponse.json();
    const primaryEmail = emailsData.find(email => email.primary)?.email || emailsData[0]?.email;

    return {
      id: userData.id.toString(),
      email: primaryEmail,
      name: userData.name || userData.login
    };
  }
};

// 生成唯一用户名
async function generateUniqueUsername(baseName) {
  // 清理用户名，只保留字母数字和下划线
  const cleanName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  let username = cleanName;
  let counter = 1;
  
  // 检查用户名是否已存在，如果存在则添加数字
  while (true) {
    const existingUser = await prisma.ow_users.findUnique({
      where: { username }
    });
    
    if (!existingUser) break;
    username = `${cleanName}_${counter++}`;
  }
  
  return username;
}

// 处理 OAuth 回调
export async function handleOAuthCallback(provider, code) {
  try {
    const tokenData = await getAccessToken(provider, code);
    const accessToken = tokenData.access_token;
    
    // 获取用户信息
    const userInfo = await getUserInfoFunctions[provider](accessToken);
    
    // 查找 OAuth 联系方式
    let contact = await prisma.ow_users_contacts.findFirst({
      where: {
        contact_value: userInfo.id,
        contact_type: OAUTH_PROVIDERS[provider].type
      }
    });

    if (!contact) {
      // 查找是否存在相同邮箱的用户
      const emailContact = await prisma.ow_users_contacts.findFirst({
        where: {
          contact_value: userInfo.email,
          contact_type: 'email'
        }
      });

      let userId;
      if (emailContact) {
        // 如果找到相同邮箱的用户，关联到该用户
        userId = emailContact.user_id;
        logger.info(`关联 OAuth 账号到现有用户: ${userId}`);
      } else {
        // 生成唯一用户名
        const username = await generateUniqueUsername(userInfo.name || 'user');
        
        // 创建新用户
        const newUser = await prisma.ow_users.create({
          data: {
            username: username,
            password: null,  // OAuth 用户不需要密码
            display_name: userInfo.name || username,
            type: 'user',  // 设置为正式用户
            state: 0,      // 正常状态
            regTime: new Date()
          }
        });
        userId = newUser.id;
        logger.info(`创建新用户: ${userId}, username: ${username}`);

        // 创建邮箱联系方式
        await prisma.ow_users_contacts.create({
          data: {
            user_id: userId,
            contact_value: userInfo.email,
            contact_hash: '',  // OAuth 用户不需要验证邮箱
            contact_type: 'email',
            is_primary: true,
            verified: true
          }
        });
      }

      // 创建 OAuth 联系方式
      contact = await prisma.ow_users_contacts.create({
        data: {
          user_id: userId,
          contact_value: userInfo.id,
          contact_hash: accessToken,
          contact_type: OAUTH_PROVIDERS[provider].type,
          verified: true
        }
      });
    } else {
      // 更新访问令牌
      await prisma.ow_users_contacts.update({
        where: { contact_id: contact.contact_id },
        data: { contact_hash: accessToken }
      });
    }

    // 获取用户信息
    const user = await prisma.ow_users.findUnique({
      where: { id: contact.user_id }
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 获取用户主邮箱
    const primaryEmail = await prisma.ow_users_contacts.findFirst({
      where: {
        user_id: user.id,
        contact_type: 'email',
        is_primary: true
      }
    });

    return { 
      user,
      contact: primaryEmail || contact  // 优先返回主邮箱联系方式
    };
  } catch (error) {
    logger.error('OAuth callback error:', error);
    throw error;
  }
}
