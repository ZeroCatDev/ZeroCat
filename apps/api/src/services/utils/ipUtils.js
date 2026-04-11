/**
 * IP地址工具函数
 * 用于从请求中获取真实IP地址，支持常见的代理服务器配置
 */

/**
 * 获取真实IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} 真实IP地址
 */
export const getRealIP = (req) => {
    // 按优先级检查各种IP头
    const ipHeaders = [
        'x-real-ip',           // Nginx代理
        'x-client-ip',         // Apache代理
        'cf-connecting-ip',    // Cloudflare
        'fastly-client-ip',    // Fastly
        'true-client-ip',      // Akamai和Cloudflare
        'x-forwarded-for',     // 标准代理头
        'x-appengine-user-ip', // Google App Engine
        'x-cluster-client-ip', // Rackspace负载均衡器
        'x-forwarded',         // 标准代理头
        'forwarded-for',       // 标准代理头
        'forwarded'            // 标准代理头
    ];

    // 检查所有可能的IP头
    for (const header of ipHeaders) {
        const ip = req.headers[header];
        if (ip) {
            // 如果是x-forwarded-for，取第一个IP（最原始的客户端IP）
            if (header === 'x-forwarded-for') {
                const ips = ip.split(',');
                return ips[0].trim();
            }
            return ip;
        }
    }

    // 如果没有找到任何IP头，返回直接连接的IP
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
};

/**
 * 检查IP地址是否为私有IP
 * @param {string} ip - IP地址
 * @returns {boolean} 是否为私有IP
 */
export const isPrivateIP = (ip) => {
    // 私有IP地址范围
    const privateRanges = [
        /^10\./,                    // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./,             // 192.168.0.0/16
        /^127\./,                   // 127.0.0.0/8
        /^169\.254\./,             // 169.254.0.0/16 (链路本地)
        /^fc00::/,                 // 唯一本地地址 (ULA)
        /^fe80::/                  // 链路本地地址
    ];

    return privateRanges.some(range => range.test(ip));
};

/**
 * 获取客户端IP地址（优先使用公网IP）
 * @param {Object} req - Express请求对象
 * @returns {string} 客户端IP地址
 */
export const getClientIP = (req) => {
    const realIP = getRealIP(req);

    // 如果是私有IP，尝试获取其他可能的公网IP
    if (isPrivateIP(realIP)) {
        // 检查其他可能的公网IP头
        const publicIPHeaders = [
            'x-forwarded-for',
            'cf-connecting-ip',
            'true-client-ip'
        ];

        for (const header of publicIPHeaders) {
            const ip = req.headers[header];
            if (ip) {
                const ips = ip.split(',');
                for (const potentialIP of ips) {
                    const trimmedIP = potentialIP.trim();
                    if (!isPrivateIP(trimmedIP)) {
                        return trimmedIP;
                    }
                }
            }
        }
    }

    return realIP;
};

export default {
    getRealIP,
    isPrivateIP,
    getClientIP
};