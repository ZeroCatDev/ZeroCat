import crypto from 'crypto';
import {prisma} from '../global.js';
import redisClient from '../redis.js';
import logger from '../logger.js';
import { authenticate } from './unifiedAuth.js';

const SUDO_TOKEN_PREFIX = 'sudo_token:';
const SUDO_TOKEN_EXPIRY = 15 * 60; // 15分钟

/**
 * 生成sudo令牌
 * @param {number} userId 用户ID
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
export async function generateSudoToken(userId) {
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SUDO_TOKEN_EXPIRY * 1000);

        const sudoData = {
            userId,
            createdAt: Date.now(),
            expiresAt: expiresAt.getTime()
        };

        await redisClient.set(`${SUDO_TOKEN_PREFIX}${token}`, sudoData, SUDO_TOKEN_EXPIRY);

        logger.info(`[sudo] 为用户 ${userId} 生成sudo令牌，有效期15分钟`);
        return { token, expiresAt };
    } catch (error) {
        logger.error('[sudo] 生成sudo令牌失败:', error);
        throw new Error('生成sudo令牌失败');
    }
}

/**
 * 验证sudo令牌
 * @param {string} token sudo令牌
 * @returns {Promise<{valid: boolean, userId?: number, message: string}>}
 */
export async function verifySudoToken(token) {
    try {
        logger.debug(`[sudo] 正在验证sudo令牌: ${token.substring(0, 8)}...`);
        if (!token) {
            return { valid: false, message: '未提供sudo令牌' };
        }

        const sudoData = await redisClient.get(`${SUDO_TOKEN_PREFIX}${token}`);

        if (!sudoData) {
            return { valid: false, message: 'sudo令牌无效或已过期' };
        }

        if (sudoData.expiresAt < Date.now()) {
            await redisClient.delete(`${SUDO_TOKEN_PREFIX}${token}`);
            return { valid: false, message: 'sudo令牌已过期' };
        }

        return {
            valid: true,
            userId: sudoData.userId,
            message: 'sudo令牌有效'
        };
    } catch (error) {
        logger.error('[sudo] 验证sudo令牌失败:', error);
        return { valid: false, message: '验证sudo令牌时发生错误' };
    }
}

/**
 * 撤销sudo令牌
 * @param {string} token sudo令牌
 * @returns {Promise<boolean>}
 */
export async function revokeSudoToken(token) {
    try {
        await redisClient.delete(`${SUDO_TOKEN_PREFIX}${token}`);
        logger.info(`[sudo] sudo令牌已撤销: ${token.substring(0, 8)}...`);
        return true;
    } catch (error) {
        logger.error('[sudo] 撤销sudo令牌失败:', error);
        return false;
    }
}

/**
 * 使用统一认证系统进行sudo认证
 * @param {number} userId 用户ID
 * @param {Object} authData 认证数据
 * @param {string} authData.method 认证方式：'password' | 'email' | 'totp' | 'passkey'
 * @param {string} authData.password 密码（password方式）
 * @param {string} authData.codeId 验证码ID（email方式）
 * @param {string} authData.code 验证码（email方式）
 * @returns {Promise<{success: boolean, token?: string, message: string}>}
 */
export async function authenticateSudo(userId, authData) {
    try {
        // 使用统一认证系统（允许totp/passkey）
        const authResult = await authenticate({
            ...authData,
            purpose: 'sudo',
            userId
        });

        if (!authResult.success) {
            logger.warn(`[sudo] 用户 ${userId} sudo认证失败: ${authResult.message}`);
            return { success: false, message: authResult.message };
        }

        // 认证成功，生成sudo令牌
        const { token } = await generateSudoToken(userId);

        logger.info(`[sudo] 用户 ${userId} sudo认证成功，方式: ${authData.method}`);
        return {
            success: true,
            token,
            message: 'sudo认证成功'
        };
    } catch (error) {
        logger.error('[sudo] sudo认证失败:', error);
        return { success: false, message: 'sudo认证失败' };
    }
}