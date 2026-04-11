import twoFactor from '../../services/auth/twoFactor.js';
import tokenUtils from '../../services/auth/tokenUtils.js';
import logger from '../../services/logger.js';

export async function status(req, res) {
  const status = await twoFactor.getTwoFactorStatus(res.locals.userid);
  res.json({ status: 'success', data: status });
}

export async function setup(req, res) {
  const result = await twoFactor.generateTotpSetup(res.locals.userid);
  if (!result.success) return res.status(400).json({ status: 'error', message: result.message });
  res.json({ status: 'success', data: result });
}

export async function activate(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ status: 'error', message: '缺少验证码' });
  const result = await twoFactor.activateTotp(res.locals.userid, token);
  if (!result.success) return res.status(400).json({ status: 'error', message: result.message });
  res.json({ status: 'success', message: '二次验证已启用' });
}

export async function disable(req, res) {
  const result = await twoFactor.disableTotp(res.locals.userid);
  if (!result.success) return res.status(400).json({ status: 'error', message: result.message });
  res.json({ status: 'success', message: '二次验证已关闭' });
}

// 完成登录：TOTP 提交
export async function finalizeLoginWithTotp(req, res) {
  const { challenge_id: challengeId, token } = req.body;
  if (!challengeId || !token) return res.status(400).json({ status: 'error', message: '缺少challenge或验证码' });
  const challenge = await twoFactor.getLogin2FAChallenge(challengeId);
  if (!challenge) return res.status(400).json({ status: 'error', message: '登录挑战无效' });
  const verify = await twoFactor.verifyTotp(challenge.userId, token);
  if (!verify.success) return res.status(400).json({ status: 'error', message: verify.message });
  const data = await twoFactor.consumeLogin2FAChallenge(challengeId);
  if (!data) return res.status(400).json({ status: 'error', message: '登录挑战已失效' });
  const tokenResult = await tokenUtils.createUserLoginTokens(
    data.userId,
    data.userInfo,
    data.ipAddress,
    data.userAgent,
    { recordLoginEvent: true, loginMethod: 'password+totp' }
  );
  if (!tokenResult.success) {
    logger.error(`创建登录令牌失败: ${tokenResult.message}`);
    return res.status(500).json({ status: 'error', message: '创建登录令牌失败' });
  }
  const response = tokenUtils.generateLoginResponse({ id: data.userId }, tokenResult, data.userInfo.email || null);
  tokenUtils.setRefreshTokenCookie(res, tokenResult.refreshToken, tokenResult.refreshExpiresAt);
  res.json(response);
}


