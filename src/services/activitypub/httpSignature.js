/**
 * HTTP Signature 签名与验证
 * 实现 ActivityPub 规范所需的 HTTP Signatures (draft-cavage-http-signatures-12)
 */

import crypto from 'crypto';
import logger from '../logger.js';

/**
 * 生成 HTTP Signature 签名头
 * @param {object} opts
 * @param {string} opts.keyId - 密钥 ID (通常为 Actor#main-key URL)
 * @param {string} opts.privateKey - PEM 格式私钥
 * @param {string} opts.method - HTTP 方法
 * @param {string} opts.path - 请求路径
 * @param {object} opts.headers - 要签名的请求头
 * @returns {{ signature: string, signatureHeader: string, signedHeaders: object }}
 */
export function signRequest({ keyId, privateKey, method, path, headers }) {
    const now = new Date();

    const signHeaders = {
        '(request-target)': `${method.toLowerCase()} ${path}`,
        host: headers.host || headers.Host,
        date: headers.date || headers.Date || now.toUTCString(),
        digest: headers.digest || headers.Digest || undefined,
    };

    // 只签名存在的头
    const headerNames = Object.keys(signHeaders).filter(k => signHeaders[k] !== undefined);
    const signingString = headerNames
        .map(name => `${name}: ${signHeaders[name]}`)
        .join('\n');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingString);
    signer.end();
    const signatureB64 = signer.sign(privateKey, 'base64');

    const signatureHeader = [
        `keyId="${keyId}"`,
        `algorithm="rsa-sha256"`,
        `headers="${headerNames.join(' ')}"`,
        `signature="${signatureB64}"`,
    ].join(',');

    return {
        signature: signatureB64,
        signatureHeader,
        signedHeaders: {
            date: signHeaders.date || now.toUTCString(),
            digest: signHeaders.digest,
        },
    };
}

/**
 * 解析 Signature 头
 * @param {string} header Signature 头的值
 * @returns {{ keyId: string, algorithm: string, headers: string[], signature: string } | null}
 */
export function parseSignatureHeader(header) {
    if (!header) return null;
    try {
        const params = {};
        // 支持格式: keyId="...",algorithm="...",headers="...",signature="..."
        const regex = /(\w+)="([^"]+)"/g;
        let match;
        while ((match = regex.exec(header)) !== null) {
            params[match[1]] = match[2];
        }

        if (!params.keyId || !params.signature) return null;

        return {
            keyId: params.keyId,
            algorithm: params.algorithm || 'rsa-sha256',
            headers: (params.headers || 'date').split(' '),
            signature: params.signature,
        };
    } catch (err) {
        logger.warn('[ap-httpSig] 无法解析签名头:', err.message);
        return null;
    }
}

/**
 * 验证 HTTP Signature
 * @param {object} opts
 * @param {string} opts.signature - Signature 头值
 * @param {string} opts.method - HTTP 方法
 * @param {string} opts.path - 请求路径
 * @param {object} opts.headers - 请求头
 * @param {string} opts.publicKey - PEM 格式公钥
 * @returns {boolean}
 */
export function verifySignature({ signature, method, path, headers, publicKey }) {
    try {
        const parsed = parseSignatureHeader(signature);
        if (!parsed) return false;

        const signHeaders = {};
        for (const name of parsed.headers) {
            if (name === '(request-target)') {
                signHeaders[name] = `${method.toLowerCase()} ${path}`;
            } else {
                // 头名称不区分大小写
                const headerValue = headers[name] || headers[name.toLowerCase()] ||
                    headers[name.charAt(0).toUpperCase() + name.slice(1)];
                if (headerValue === undefined) {
                    logger.debug(`[ap-httpSig] 缺\u5c11\u7b7e\u540d\u9a8c\u8bc1\u6240\u9700\u7684\u8bf7\u6c42\u4e22: ${name}`);
                    return false;
                }
                signHeaders[name] = headerValue;
            }
        }

        const signingString = parsed.headers
            .map(name => `${name}: ${signHeaders[name]}`)
            .join('\n');

        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signingString);
        verifier.end();

        return verifier.verify(publicKey, parsed.signature, 'base64');
    } catch (err) {
        logger.warn('[ap-httpSig] \u7b7e\u540d\u9a8c\u8bc1\u6267\u884c\u9519误:', err.message);
        return false;
    }
}

/**
 * 计算 SHA-256 Digest 头值
 * @param {string|Buffer} body
 * @returns {string}
 */
export function digestBody(body) {
    const data = Buffer.isBuffer(body) ? body
        : typeof body === 'string' ? body
        : JSON.stringify(body);
    const hash = crypto.createHash('sha256')
        .update(data)
        .digest('base64');
    return `SHA-256=${hash}`;
}

/**
 * 验证请求的 Digest 头
 * @param {string} digestHeader Digest 头值
 * @param {string|Buffer} body 请求体
 * @returns {boolean}
 */
export function verifyDigest(digestHeader, body) {
    if (!digestHeader) return true; // 如果没有 Digest 头，跳过
    const expected = digestBody(body);
    return digestHeader === expected;
}
