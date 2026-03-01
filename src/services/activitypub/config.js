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
    AP_DELIVERY: 'ap_delivery',   // 投递记录(去重)
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
 * 前端需转发 /.well-known/webfinger、/.well-known/nodeinfo 及 /ap/* 路径到后端
 */
export async function getInstanceDomain() {

    // 回退到前端域名（这是用户可见的域名，也是联邦中的标识域名）
    const frontendUrl = await zcconfig.get('urls.frontend');
    if (frontendUrl) {
        try {
            return new URL(frontendUrl).host;
        } catch (e) {
            logger.warn('[activitypub] 解析 urls.frontend URL 失败:', frontendUrl);
        }
    }

    logger.warn('[activitypub] 未配置 ap.instance.domain 或 urls.frontend，ActivityPub 域名将使用 localhost');
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
 * 获取 AP 端点基础 URL（前端 URL）
 * 前端将 /ap/* 路径反代到后端，因此 AP 协议端点统一使用前端域名，
 * 其他实例通过前端域名访问 /ap/* 端点（actor、inbox、outbox、notes 等）
 */
export async function getApEndpointBaseUrl() {
    // 使用前端域名，因为前端已将 /ap/* 反代到后端
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
