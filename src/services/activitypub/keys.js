/**
 * ActivityPub RSA 密钥管理
 * 生成和管理用于 HTTP Signature 的 RSA 密钥对
 * 用户密钥存储在 ow_cache_kv，实例密钥存储在 zcconfig (ow_config)
 */

import crypto from 'crypto';
import logger from '../logger.js';
import zcconfig from '../config/zcconfig.js';
import { CACHE_KV_KEYS, CONFIG_KEYS } from './config.js';
import { getUserKv, setUserKv } from './store.js';

const KEY_SIZE = 2048;

/**
 * 生成 RSA 密钥对
 * @returns {{ publicKey: string, privateKey: string }}
 */
function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: KEY_SIZE,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}

/**
 * 获取用户的 RSA 密钥对，不存在则自动生成
 * @param {number} userId
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
export async function getUserKeyPair(userId) {
    // 尝试从 ow_cache_kv 读取
    const existingPub = await getUserKv(userId, CACHE_KV_KEYS.AP_PUBLIC_KEY);
    const existingPriv = await getUserKv(userId, CACHE_KV_KEYS.AP_PRIVATE_KEY);

    if (existingPub && existingPriv) {
        const publicKey = typeof existingPub === 'object' ? existingPub.value || existingPub.v : existingPub;
        const privateKey = typeof existingPriv === 'object' ? existingPriv.value || existingPriv.v : existingPriv;
        if (typeof publicKey === 'string' && typeof privateKey === 'string') {
            return { publicKey, privateKey };
        }
    }

    // 生成新密钥对
    logger.info(`[ap-keys] Generating new RSA key pair for user ${userId}`);
    const { publicKey, privateKey } = generateKeyPair();

    await setUserKv(userId, CACHE_KV_KEYS.AP_PUBLIC_KEY, { v: publicKey });
    await setUserKv(userId, CACHE_KV_KEYS.AP_PRIVATE_KEY, { v: privateKey });

    return { publicKey, privateKey };
}

/**
 * 获取用户的公钥
 */
export async function getUserPublicKey(userId) {
    const { publicKey } = await getUserKeyPair(userId);
    return publicKey;
}

/**
 * 获取用户的私钥
 */
export async function getUserPrivateKey(userId) {
    const { privateKey } = await getUserKeyPair(userId);
    return privateKey;
}

/**
 * 获取实例级密钥对（用于共享收件箱签名）
 */
export async function getInstanceKeyPair() {
    const existingPub = await zcconfig.get(CONFIG_KEYS.INSTANCE_PUBLIC_KEY);
    const existingPriv = await zcconfig.get(CONFIG_KEYS.INSTANCE_PRIVATE_KEY);

    if (existingPub && existingPriv) {
        return { publicKey: existingPub, privateKey: existingPriv };
    }

    logger.info('[ap-keys] Generating new instance RSA key pair');
    const { publicKey, privateKey } = generateKeyPair();

    await zcconfig.set(CONFIG_KEYS.INSTANCE_PUBLIC_KEY, publicKey);
    await zcconfig.set(CONFIG_KEYS.INSTANCE_PRIVATE_KEY, privateKey);

    return { publicKey, privateKey };
}
