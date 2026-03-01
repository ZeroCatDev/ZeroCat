/**
 * 联邦实例白名单与安全配置
 * 使用 zcconfig (ow_config) 管理联邦实例的允许/拒绝列表
 */

import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import { CONFIG_KEYS } from './config.js';

// 新增 zcconfig keys
export const FEDERATION_CONFIG_KEYS = {
    ...CONFIG_KEYS,
    // 白名单模式: 'allowlist' 只允许白名单实例, 'blocklist' 只阻止黑名单实例, 'open' 不限制
    INSTANCE_POLICY: 'ap.federation.instance_policy',
    // 逗号分隔的允许的域名列表
    INSTANCE_ALLOWLIST: 'ap.federation.instance_allowlist',
    // 逗号分隔的阻止的域名列表
    INSTANCE_BLOCKLIST: 'ap.federation.instance_blocklist',
    // 是否自动拉取远程用户帖子
    AUTO_FETCH_POSTS: 'ap.federation.auto_fetch_posts',
    // 最大拉取帖子数量
    MAX_FETCH_POSTS: 'ap.federation.max_fetch_posts',
    // 帖子拉取间隔（分钟）
    FETCH_INTERVAL_MINUTES: 'ap.federation.fetch_interval_minutes',
    // 是否允许搜索远程用户
    ALLOW_REMOTE_SEARCH: 'ap.federation.allow_remote_search',
};

/**
 * 获取实例策略模式
 * @returns {'open'|'allowlist'|'blocklist'}
 */
export async function getInstancePolicy() {
    const policy = await zcconfig.get(FEDERATION_CONFIG_KEYS.INSTANCE_POLICY, 'open');
    if (['open', 'allowlist', 'blocklist'].includes(policy)) return policy;
    return 'open';
}

/**
 * 获取允许的实例域名列表
 * @returns {string[]}
 */
export async function getAllowedInstances() {
    const raw = await zcconfig.get(FEDERATION_CONFIG_KEYS.INSTANCE_ALLOWLIST, '');
    if (!raw) return [];
    return String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * 获取阻止的实例域名列表
 * @returns {string[]}
 */
export async function getBlockedInstances() {
    const raw = await zcconfig.get(FEDERATION_CONFIG_KEYS.INSTANCE_BLOCKLIST, '');
    if (!raw) return [];
    return String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * 检查一个实例域名是否被允许联邦
 * @param {string} domain - 要检查的域名
 * @returns {boolean}
 */
export async function isInstanceAllowed(domain) {
    if (!domain) return false;
    const normalizedDomain = domain.toLowerCase().trim();

    const policy = await getInstancePolicy();

    switch (policy) {
        case 'allowlist': {
            const allowed = await getAllowedInstances();
            if (allowed.length === 0) {
                // 空白名单 = 不允许任何远程实例
                logger.debug(`[ap-federation-config] 白名单模式但列表为空，拒绝: ${normalizedDomain}`);
                return false;
            }
            const isAllowed = allowed.includes(normalizedDomain);
            if (!isAllowed) {
                logger.debug(`[ap-federation-config] 域名 ${normalizedDomain} 不在白名单中`);
            }
            return isAllowed;
        }
        case 'blocklist': {
            const blocked = await getBlockedInstances();
            const isBlocked = blocked.includes(normalizedDomain);
            if (isBlocked) {
                logger.debug(`[ap-federation-config] 域名 ${normalizedDomain} 在黑名单中被阻止`);
            }
            return !isBlocked;
        }
        case 'open':
        default:
            return true;
    }
}

/**
 * 从 Actor URL 或其他 URL 中提取域名
 * @param {string} url
 * @returns {string|null}
 */
export function extractDomainFromUrl(url) {
    try {
        return new URL(url).host.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * 检查一个 Actor URL 对应的实例是否被允许
 * @param {string} actorUrl
 * @returns {boolean}
 */
export async function isActorAllowed(actorUrl) {
    const domain = extractDomainFromUrl(actorUrl);
    if (!domain) return false;
    return isInstanceAllowed(domain);
}

/**
 * 设置实例策略
 * @param {'open'|'allowlist'|'blocklist'} policy
 */
export async function setInstancePolicy(policy) {
    if (!['open', 'allowlist', 'blocklist'].includes(policy)) {
        throw new Error(`无效的实例策略: ${policy}`);
    }
    await zcconfig.set(FEDERATION_CONFIG_KEYS.INSTANCE_POLICY, policy);
    logger.info(`[ap-federation-config] 实例策略已设置为: ${policy}`);
}

/**
 * 设置允许的实例列表
 * @param {string[]} domains
 */
export async function setAllowedInstances(domains) {
    const normalized = domains.map(d => d.trim().toLowerCase()).filter(Boolean);
    await zcconfig.set(FEDERATION_CONFIG_KEYS.INSTANCE_ALLOWLIST, normalized.join(','));
    logger.info(`[ap-federation-config] 允许的实例已更新: ${normalized.join(', ')}`);
}

/**
 * 设置阻止的实例列表
 * @param {string[]} domains
 */
export async function setBlockedInstances(domains) {
    const normalized = domains.map(d => d.trim().toLowerCase()).filter(Boolean);
    await zcconfig.set(FEDERATION_CONFIG_KEYS.INSTANCE_BLOCKLIST, normalized.join(','));
    logger.info(`[ap-federation-config] 阻止的实例已更新: ${normalized.join(', ')}`);
}

/**
 * 添加一个实例到允许列表
 * @param {string} domain
 */
export async function addAllowedInstance(domain) {
    const current = await getAllowedInstances();
    const normalized = domain.trim().toLowerCase();
    if (!current.includes(normalized)) {
        current.push(normalized);
        await setAllowedInstances(current);
    }
}

/**
 * 从允许列表移除一个实例
 * @param {string} domain
 */
export async function removeAllowedInstance(domain) {
    const current = await getAllowedInstances();
    const normalized = domain.trim().toLowerCase();
    const updated = current.filter(d => d !== normalized);
    await setAllowedInstances(updated);
}

/**
 * 添加一个实例到阻止列表
 * @param {string} domain
 */
export async function addBlockedInstance(domain) {
    const current = await getBlockedInstances();
    const normalized = domain.trim().toLowerCase();
    if (!current.includes(normalized)) {
        current.push(normalized);
        await setBlockedInstances(current);
    }
}

/**
 * 从阻止列表移除一个实例
 * @param {string} domain
 */
export async function removeBlockedInstance(domain) {
    const current = await getBlockedInstances();
    const normalized = domain.trim().toLowerCase();
    const updated = current.filter(d => d !== normalized);
    await setBlockedInstances(updated);
}

/**
 * 获取是否允许远程搜索
 * @returns {boolean}
 */
export async function isRemoteSearchAllowed() {
    const val = await zcconfig.get(FEDERATION_CONFIG_KEYS.ALLOW_REMOTE_SEARCH, true);
    return val !== 'false' && val !== false;
}

/**
 * 获取是否自动拉取远程帖子
 * @returns {boolean}
 */
export async function isAutoFetchPostsEnabled() {
    const val = await zcconfig.get(FEDERATION_CONFIG_KEYS.AUTO_FETCH_POSTS, true);
    return val !== 'false' && val !== false;
}

/**
 * 获取最大拉取帖子数量
 * @returns {number}
 */
export async function getMaxFetchPosts() {
    const val = await zcconfig.get(FEDERATION_CONFIG_KEYS.MAX_FETCH_POSTS, 50);
    return parseInt(val, 10) || 50;
}

/**
 * 获取完整的联邦配置状态
 * @returns {object}
 */
export async function getFederationConfig() {
    return {
        policy: await getInstancePolicy(),
        allowlist: await getAllowedInstances(),
        blocklist: await getBlockedInstances(),
        autoFetchPosts: await isAutoFetchPostsEnabled(),
        maxFetchPosts: await getMaxFetchPosts(),
        allowRemoteSearch: await isRemoteSearchAllowed(),
    };
}
