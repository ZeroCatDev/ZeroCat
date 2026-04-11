import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';
import axios from 'axios';

// Cached proxy config (parsed from URL)
let cachedProxyConfig = null;
let cachedProxyUrl = null;

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
 * 将代理URL解析为axios proxy配置（按proxyUrl缓存，URL变化时重建）
 */
function getProxyConfig(proxyUrl) {
    if (cachedProxyConfig && cachedProxyUrl === proxyUrl) {
        return cachedProxyConfig;
    }

    const parsed = new URL(proxyUrl);
    cachedProxyConfig = {
        protocol: parsed.protocol.replace(':', ''),
        host: parsed.hostname,
        port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        ...(parsed.username && {
            auth: {
                username: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password || '')
            }
        })
    };
    cachedProxyUrl = proxyUrl;
    logger.debug('[ProxyManager] 创建新的代理配置:', proxyUrl);
    return cachedProxyConfig;
}

/**
 * 获取OAuth代理是否启用
 */
export async function isOAuthProxyEnabled() {
    return await zcconfig.get('oauth.proxy.enabled', false);
}

/**
 * 将axios响应包装为fetch-like响应，使调用方无需修改
 */
function wrapAxiosResponse(axiosResponse) {
    const { status, data, headers } = axiosResponse;
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return {
        ok: status >= 200 && status < 300,
        status,
        headers,
        json: async () => typeof data === 'string' ? JSON.parse(data) : data,
        text: async () => body
    };
}

function shouldRetryDirect(error) {
    const code = String(error?.code || '').toUpperCase();
    return [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',
        'ENOTFOUND',
        'EPROTO',
    ].includes(code);
}

/**
 * 发送支持代理的fetch请求
 * 内部自动检查 isOAuthProxyEnabled()，调用方无需手动检查
 * 返回 fetch-like 响应对象（含 ok, status, json(), text()）
 */
export async function fetchWithProxy(url, options = {}) {
    // 剥离自定义属性
    const { useProxy, body, headers, method, ...rest } = options;

    const axiosConfig = {
        url,
        method: method || 'GET',
        headers: headers || {},
        data: body,
        // 不自动抛出错误，让调用方通过 response.ok 判断
        validateStatus: () => true,
        // 保持原始响应数据，不自动转换
        transformResponse: [(data) => data],
        ...rest,
    };

    const oauthProxyEnabled = await isOAuthProxyEnabled();
    const shouldUseProxy =
        typeof useProxy === 'boolean'
            ? useProxy
            : oauthProxyEnabled;

    let proxyAttached = false;
    if (shouldUseProxy) {
        try {
            const proxyUrl = await getProxyUrl();
            if (proxyUrl) {
                axiosConfig.proxy = getProxyConfig(proxyUrl);
                proxyAttached = true;
            }
        } catch (error) {
            logger.error('[ProxyManager] 配置代理失败:', error);
        }
    }

    try {
        const response = await axios(axiosConfig);
        return wrapAxiosResponse(response);
    } catch (error) {
        if (proxyAttached && shouldRetryDirect(error)) {
            logger.warn(`[ProxyManager] 代理请求失败，回退直连重试: ${error.code || error.message}`);
            const directConfig = { ...axiosConfig };
            delete directConfig.proxy;
            const retryResponse = await axios(directConfig);
            return wrapAxiosResponse(retryResponse);
        }
        throw error;
    }
}

export default {
    getProxyUrl,
    fetchWithProxy,
    isOAuthProxyEnabled
};
