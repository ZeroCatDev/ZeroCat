import jsonwebtoken from 'jsonwebtoken';
import logger from '../logger.js';

/**
 * 为空间用户生成 Waline JWT
 * Waline 使用 jwt.sign(String(userId), secret) 的方式
 * @param {number} userId - ZeroCat 用户ID
 * @param {string} jwtSecret - 空间的 JWT 密钥
 * @returns {string} Waline JWT token
 */
export function createWalineToken(userId, jwtSecret) {
    return jsonwebtoken.sign(String(userId), jwtSecret);
}

/**
 * 验证 Waline JWT 并返回用户ID
 * @param {string} token - Waline JWT token
 * @param {string} jwtSecret - 空间的 JWT 密钥
 * @returns {{ valid: boolean, userId: number|null }}
 */
export function verifyWalineToken(token, jwtSecret) {
    try {
        const payload = jsonwebtoken.verify(token, jwtSecret);
        // jwt.sign(String(userId), secret) 产生的 payload 就是字符串本身
        const userId = parseInt(payload, 10);
        if (isNaN(userId)) {
            return { valid: false, userId: null };
        }
        return { valid: true, userId };
    } catch (err) {
        logger.debug(`[walineAuth] JWT验证失败: ${err.message}`);
        return { valid: false, userId: null };
    }
}

export default { createWalineToken, verifyWalineToken };
