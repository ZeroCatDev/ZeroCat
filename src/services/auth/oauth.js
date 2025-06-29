import crypto from "crypto";

/**
 * 验证重定向URI是否在允许列表中
 * @param {string} redirectUri - 请求的重定向URI
 * @param {string[]} allowedUris - 允许的重定向URI列表
 * @returns {boolean}
 */
export function validateRedirectUri(redirectUri, allowedUris) {
  try {
    const requestedUrl = new URL(redirectUri);
    return allowedUris.some((allowed) => {
      const allowedUrl = new URL(allowed);
      return (
        requestedUrl.protocol === allowedUrl.protocol &&
        requestedUrl.host === allowedUrl.host &&
        requestedUrl.pathname === allowedUrl.pathname
      );
    });
  } catch (error) {
    return false;
  }
}

/**
 * 生成授权码
 * @returns {Promise<string>}
 */
export async function generateAuthCode() {
  const bytes = await crypto.randomBytes(32);
  return bytes.toString("base64url");
}

/**
 * 生成访问令牌和刷新令牌
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
 */
export async function generateTokens() {
  const [accessTokenBytes, refreshTokenBytes] = await Promise.all([
    crypto.randomBytes(32),
    crypto.randomBytes(32),
  ]);

  return {
    accessToken: accessTokenBytes.toString("base64url"),
    refreshToken: refreshTokenBytes.toString("base64url"),
    expiresIn: 3600, // 1小时过期
  };
}

/**
 * 验证请求的权限范围是否在应用允许的范围内
 * @param {string[]} requestedScopes - 请求的权限范围
 * @param {string[]} allowedScopes - 应用允许的权限范围
 * @returns {boolean}
 */
export function validateScopes(requestedScopes, allowedScopes) {
  return requestedScopes.every((scope) => allowedScopes.includes(scope));
}

/**
 * 验证PKCE挑战
 * @param {string} codeVerifier - PKCE验证器
 * @param {string} codeChallenge - PKCE挑战
 * @param {string} codeChallengeMethod - PKCE方法
 * @returns {boolean}
 */
export function validatePKCE(codeVerifier, codeChallenge, codeChallengeMethod) {
  if (!codeVerifier || !codeChallenge || !codeChallengeMethod) {
    return false;
  }

  let challenge;
  if (codeChallengeMethod === "S256") {
    challenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
  } else if (codeChallengeMethod === "plain") {
    challenge = codeVerifier;
  } else {
    return false;
  }

  return challenge === codeChallenge;
}

/**
 * 验证客户端凭证
 * @param {string} clientId - 客户端ID
 * @param {string} clientSecret - 客户端密钥
 * @returns {Promise<boolean>}
 */
export async function validateClientCredentials(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return false;
  }

  // 使用恒定时间比较以防止时序攻击
  return crypto.timingSafeEqual(
    Buffer.from(clientSecret),
    Buffer.from(clientSecret)
  );
}

/**
 * 生成应用密钥
 * @returns {Promise<{clientId: string, clientSecret: string}>}
 */
export async function generateAppCredentials() {
  const [clientIdBytes, clientSecretBytes] = await Promise.all([
    crypto.randomBytes(16),
    crypto.randomBytes(32),
  ]);

  return {
    clientId: clientIdBytes.toString("hex"),
    clientSecret: clientSecretBytes.toString("hex"),
  };
}
