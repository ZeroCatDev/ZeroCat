/**
 * ActivityPub 管理员设置工具
 * 提供一键初始化和配置管理功能
 */

import logger from '../logger.js';
import zcconfig from '../config/zcconfig.js';
import { CONFIG_KEYS, getInstanceDomain, getInstanceBaseUrl, getApEndpointBaseUrl } from './config.js';
import { getInstanceKeyPair } from './keys.js';

/**
 * 初始化 ActivityPub 联邦功能
 * @param {object} opts
 * @param {string} opts.domain - 实例域名
 * @param {string} [opts.name] - 实例名称
 * @param {string} [opts.description] - 实例描述
 * @param {boolean} [opts.enabled=true] - 是否启用
 * @param {boolean} [opts.autoAcceptFollows=true] - 是否自动接受关注
 */
export async function initializeActivityPub({
    domain,
    name = 'ZeroCat',
    description = 'A creative coding community with ActivityPub federation',
    enabled = true,
    autoAcceptFollows = true,
} = {}) {
    try {
        if (domain) {
            await zcconfig.set(CONFIG_KEYS.INSTANCE_DOMAIN, domain);
        }

        await zcconfig.set(CONFIG_KEYS.INSTANCE_NAME, name);
        await zcconfig.set(CONFIG_KEYS.INSTANCE_DESCRIPTION, description);
        await zcconfig.set(CONFIG_KEYS.FEDERATION_ENABLED, String(enabled));
        await zcconfig.set(CONFIG_KEYS.AUTO_ACCEPT_FOLLOWS, String(autoAcceptFollows));

        // 生成实例级密钥对
        await getInstanceKeyPair();

        const actualDomain = domain || await getInstanceDomain();
        logger.info(`[ap-setup] ActivityPub 已为域名 ${actualDomain} 初始化`);

        return {
            success: true,
            domain: actualDomain,
            federationEnabled: enabled,
            autoAcceptFollows,
        };
    } catch (err) {
        logger.error('[ap-setup] ActivityPub 初始化失败:', err);
        throw err;
    }
}

/**
 * 获取当前 ActivityPub 配置状态
 */
export async function getActivityPubStatus() {
    const domain = await getInstanceDomain();
    const baseUrl = await getInstanceBaseUrl();
    const apBaseUrl = await getApEndpointBaseUrl();
    const name = await zcconfig.get(CONFIG_KEYS.INSTANCE_NAME, 'ZeroCat');
    const description = await zcconfig.get(CONFIG_KEYS.INSTANCE_DESCRIPTION, '');
    const enabled = await zcconfig.get(CONFIG_KEYS.FEDERATION_ENABLED, false);
    const autoAccept = await zcconfig.get(CONFIG_KEYS.AUTO_ACCEPT_FOLLOWS, true);

    return {
        domain,
        baseUrl,
        apBaseUrl,
        name: name || 'ZeroCat',
        description: description || '',
        federationEnabled: enabled === 'true' || enabled === true,
        autoAcceptFollows: autoAccept !== 'false' && autoAccept !== false,
        endpoints: {
            webfinger: `https://${domain}/.well-known/webfinger`,
            nodeinfo: `https://${domain}/.well-known/nodeinfo`,
            sharedInbox: `${apBaseUrl}/ap/inbox`,
        },
    };
}

/**
 * 启用/禁用 ActivityPub 联邦
 */
export async function setFederationEnabled(enabled) {
    await zcconfig.set(CONFIG_KEYS.FEDERATION_ENABLED, String(enabled));
    logger.info(`[ap-setup] 联邦 ${enabled ? '已启用' : '已禁用'}`);
}

/**
 * 设置是否自动接受关注请求
 */
export async function setAutoAcceptFollows(autoAccept) {
    await zcconfig.set(CONFIG_KEYS.AUTO_ACCEPT_FOLLOWS, String(autoAccept));
    logger.info(`[ap-setup] 自动接受关注: ${autoAccept}`);
}
