/**
 * ActivityPub 配置模块
 * 管理 ActivityPub 联邦协议所需的各种配置常量和辅助函数
 * 全局配置使用 zcconfig（ow_config 表），数据存储使用 ow_target_configs 和 ow_cache_kv
 */

import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

// ActivityPub JSON-LD 上下文
export const AP_CONTEXT = [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
];

// Content-Type 常量
export const AP_CONTENT_TYPE = 'application/activity+json';
export const AP_ACCEPT_TYPES = [
    'application/activity+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    'application/ld+json',
];

// ow_target_configs 中的 target_type 常量（用于数据存储，非全局配置）
export const TARGET_TYPES = {
    AP_USER: 'ap_user',           // 用户级 AP 配置
    AP_REMOTE_ACTOR: 'ap_actor',  // 远程 Actor 缓存
    AP_ACTIVITY: 'ap_activity',   // 活动记录
    AP_FOLLOW: 'ap_follow',       // 关注请求记录
};

// ow_cache_kv 中的 key 前缀
export const CACHE_KV_KEYS = {
    AP_PRIVATE_KEY: 'ap:private_key',
    AP_PUBLIC_KEY: 'ap:public_key',
    AP_ENABLED: 'ap:enabled',
    AP_FOLLOWERS_CACHE: 'ap:followers',
    AP_FOLLOWING_CACHE: 'ap:following',
};

// zcconfig key 常量（存储在 ow_config 表中）
export const CONFIG_KEYS = {
    INSTANCE_DOMAIN: 'ap.instance.domain',
    INSTANCE_NAME: 'ap.instance.name',
    INSTANCE_DESCRIPTION: 'ap.instance.description',
    INSTANCE_PRIVATE_KEY: 'ap.instance.private_key',
    INSTANCE_PUBLIC_KEY: 'ap.instance.public_key',
    FEDERATION_ENABLED: 'ap.federation.enabled',
    AUTO_ACCEPT_FOLLOWS: 'ap.auto_accept_follows',
};

/**
 * 获取实例域名（身份标识域名，即前端域名）
 * 其他实例通过此域名识别本实例用户，如 @user@此域名
 * 前端只需转发 /.well-known/webfinger 和 /.well-known/nodeinfo 到后端
 * AP 端点（/ap/*）直接使用后端域名，无需前端转发
 */
export async function getInstanceDomain() {
    // 优先从 zcconfig 读取 AP 域名配置
    const domain = await zcconfig.get(CONFIG_KEYS.INSTANCE_DOMAIN);
    if (domain) return domain;

    // 回退到前端域名（这是用户可见的域名，也是联邦中的标识域名）
    const frontendUrl = await zcconfig.get('urls.frontend');
    if (frontendUrl) {
        try {
            return new URL(frontendUrl).host;
        } catch (e) {
            logger.warn('[activitypub] Failed to parse urls.frontend as URL:', frontendUrl);
        }
    }

    // 最终回退到 urls.api
    const apiUrl = await zcconfig.get('urls.api');
    if (apiUrl) {
        try {
            return new URL(apiUrl).host;
        } catch (e) {
            logger.warn('[activitypub] Failed to parse urls.api as URL:', apiUrl);
        }
    }

    return 'localhost';
}

/**
 * 获取实例基础 URL (https://前端域名)
 * 用于身份标识相关的 URL（WebFinger subject, profile page 等）
 */
export async function getInstanceBaseUrl() {
    const domain = await getInstanceDomain();
    return `https://${domain}`;
}

/**
 * 获取 AP 端点基础 URL（后端 URL）
 * AP 协议端点（actor、inbox、outbox、notes 等）使用后端域名，
 * 这样前端不需要转发 /ap/* 路径
 */
export async function getApEndpointBaseUrl() {
    // 优先使用 urls.api（后端地址）
    const apiUrl = await zcconfig.get('urls.api');
    if (apiUrl) {
        return apiUrl.replace(/\/+$/, '');
    }
    // 回退到实例基础 URL
    return await getInstanceBaseUrl();
}

/**
 * 获取静态资源 URL
 */
export async function getStaticUrl() {
    const raw = await zcconfig.get('s3.staticurl');
    if (raw) {
        try {
            const url = new URL(raw);
            return url.origin + url.pathname.replace(/\/+$/, '');
        } catch { return raw.replace(/\/+$/, ''); }
    }
    return await getInstanceBaseUrl();
}

/**
 * 检查 ActivityPub 联邦是否启用
 */
export async function isFederationEnabled() {
    const enabled = await zcconfig.get(CONFIG_KEYS.FEDERATION_ENABLED, false);
    return enabled === 'true' || enabled === true;
}

/**
 * 检查是否自动接受关注请求
 */
export async function isAutoAcceptFollows() {
    const val = await zcconfig.get(CONFIG_KEYS.AUTO_ACCEPT_FOLLOWS, true);
    return val !== 'false' && val !== false; // 默认自动接受
}

/**
 * 检查请求是否为 ActivityPub 请求（通过 Accept 头判断）
 */
export function isApRequest(req) {
    const accept = req.headers.accept || '';
    return AP_ACCEPT_TYPES.some(t => accept.includes(t));
}
