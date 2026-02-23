import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';

// Handle both ESM and CommonJS imports
const Http = typeof HttpProxyAgent === 'object' && HttpProxyAgent.default ? HttpProxyAgent.default : HttpProxyAgent;
const Https = typeof HttpsProxyAgent === 'object' && HttpsProxyAgent.default ? HttpsProxyAgent.default : HttpsProxyAgent;

/**
 * 获取代理URL
 */
export async function getProxyUrl() {
    try {
        const proxyUrl = await zcconfig.get('proxy.url');
        if (!proxyUrl) {
            return null;
        }

        // 验证代理URL格式
        try {
            new URL(proxyUrl);
            return proxyUrl;
        } catch (error) {
            logger.warn('[ProxyManager] 代理URL格式无效:', proxyUrl);
            return null;
        }
    } catch (error) {
        logger.error('[ProxyManager] 获取代理URL失败:', error);
        return null;
    }
}

/**
 * 为fetch请求创建proxy agent
 */
export async function createProxyAgent(url) {
    const proxyUrl = await getProxyUrl();
    if (!proxyUrl) {
        return null;
    }

    try {
        if (url.startsWith('http://')) {
            return new Http(proxyUrl);
        } else if (url.startsWith('https://')) {
            return new Https(proxyUrl);
        }
        return null;
    } catch (error) {
        logger.error('[ProxyManager] 创建代理agent失败:', error);
        return null;
    }
}

/**
 * 发送支持代理的fetch请求
 */
export async function fetchWithProxy(url, options = {}) {
    const useProxy = options.useProxy !== false;

    if (useProxy) {
        try {
            const agent = await createProxyAgent(url);
            if (agent) {
                return fetch(url, {
                    ...options,
                    agent: agent
                });
            }
        } catch (error) {
            logger.error('[ProxyManager] 使用代理请求失败:', error);
        }
    }

    // 不使用代理或代理失败时，直接发送请求
    return fetch(url, options);
}

/**
 * 获取OAuth代理是否启用
 */
export async function isOAuthProxyEnabled() {
    return await zcconfig.get('oauth.proxy.enabled', false);
}

export default {
    getProxyUrl,
    createProxyAgent,
    fetchWithProxy,
    isOAuthProxyEnabled
};
