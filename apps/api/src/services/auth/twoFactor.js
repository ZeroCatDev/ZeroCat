import { Secret, TOTP } from 'otpauth';
import { prisma } from '../prisma.js';
import redisClient from '../redis.js';
import logger from '../logger.js';

function buildTotpInstance(secretBase32, algorithm = 'SHA256', digits = 6, period = 30, label = 'ZeroCat') {
  return new TOTP({ secret: secretBase32, algorithm, digits, period, issuer: 'ZeroCat', label });
}

export async function getTwoFactorStatus(userId) {
  const contact = await prisma.ow_users_contacts.findFirst({
    where: { user_id: Number(userId), contact_type: 'totp' },
  });
  return {
    enabled: !!contact && !!contact.verified && contact.metadata?.enabled === true,
    verified: !!contact?.verified,
    created_at: contact?.created_at || null,
  };
}

export async function generateTotpSetup(userId) {
  const existing = await prisma.ow_users_contacts.findFirst({
    where: { user_id: Number(userId), contact_type: 'totp' },
  });
  if (existing && existing.verified) {
    return { success: false, message: '已存在启用的TOTP' };
  }

  const user = await prisma.ow_users.findUnique({ where: { id: Number(userId) }, select: { username: true, display_name: true } });
  const label = user?.username || 'ZeroCat';
  const secret = new Secret();
  const algorithm = 'SHA256';
  const digits = 6;
  const period = 30;
  const totp = buildTotpInstance(secret.base32, algorithm, digits, period, `ZeroCat:${label}`);

  const metadata = {
    secret_base32: secret.base32,
    algorithm,
    digits,
    period,
    otpauth_url: totp.toString(),
    enabled: false,
    created_at: Date.now(),
  };

  if (!existing) {
    await prisma.ow_users_contacts.create({
      data: {
        user_id: Number(userId),
        contact_type: 'totp',
        contact_value: `totp:${userId}`,
        contact_info: 'TOTP 2FA',
        is_primary: false,
        verified: false,
        metadata,
      },
    });
  } else {
    await prisma.ow_users_contacts.update({
      where: { contact_id: existing.contact_id },
      data: { verified: false, metadata },
    });
  }

  return {
    success: true,
    secret: secret.base32,
    otpauth_url: metadata.otpauth_url,
    algorithm,
    digits,
    period,
  };
}

export async function activateTotp(userId, token) {
  const contact = await prisma.ow_users_contacts.findFirst({
    where: { user_id: Number(userId), contact_type: 'totp' },
  });
  if (!contact) return { success: false, message: '未找到TOTP配置' };
  const { secret_base32, algorithm, digits, period } = contact.metadata || {};
  if (!secret_base32) return { success: false, message: 'TOTP配置缺少密钥' };
  const totp = buildTotpInstance(secret_base32, algorithm, digits, period);
  const valid = totp.validate({ token, window: 1 }) !== null;
  if (!valid) return { success: false, message: '验证码无效' };

  await prisma.ow_users_contacts.update({
    where: { contact_id: contact.contact_id },
    data: { verified: true, metadata: { ...contact.metadata, enabled: true, verified_at: Date.now() } },
  });
  return { success: true };
}

export async function disableTotp(userId) {
  const contact = await prisma.ow_users_contacts.findFirst({ where: { user_id: Number(userId), contact_type: 'totp' } });
  if (!contact) return { success: true };
  await prisma.ow_users_contacts.delete({ where: { contact_id: contact.contact_id } });
  return { success: true };
}

export async function verifyTotp(userId, token) {
  const contact = await prisma.ow_users_contacts.findFirst({
    where: { user_id: Number(userId), contact_type: 'totp', verified: true },
  });
  if (!contact) return { success: false, message: '未启用TOTP' };
  const { secret_base32, algorithm, digits, period } = contact.metadata || {};
  if (!secret_base32) return { success: false, message: 'TOTP配置缺少密钥' };
  const totp = buildTotpInstance(secret_base32, algorithm, digits, period);
  const valid = totp.validate({ token, window: 1 }) !== null;
  return { success: !!valid, message: valid ? 'ok' : '验证码无效' };
}

// 2FA 登录挑战
const CHALLENGE_TTL = 10 * 60; // seconds

export async function createLogin2FAChallenge(userId, userInfo, ipAddress, userAgent) {
  const challengeId = cryptoRandomId();
  const key = `login_2fa_challenge:${challengeId}`;
  const data = { userId, userInfo, ipAddress, userAgent, createdAt: Date.now() };
  await redisClient.set(key, data, CHALLENGE_TTL);
  return { challengeId, expiresIn: CHALLENGE_TTL };
}

export async function getLogin2FAChallenge(challengeId) {
  const key = `login_2fa_challenge:${challengeId}`;
  const data = await redisClient.get(key);
  return data || null;
}

export async function consumeLogin2FAChallenge(challengeId) {
  const key = `login_2fa_challenge:${challengeId}`;
  const data = await redisClient.get(key);
  if (data) await redisClient.delete(key);
  return data || null;
}

function cryptoRandomId(length = 32) {
  // lightweight random id
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default {
  getTwoFactorStatus,
  generateTotpSetup,
  activateTotp,
  disableTotp,
  verifyTotp,
  createLogin2FAChallenge,
  getLogin2FAChallenge,
  consumeLogin2FAChallenge,
};


