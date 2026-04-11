import logger from '../logger.js';

/**
 * 验证 Cloudflare Turnstile token
 */
async function verifyTurnstile(token, secret, ip) {
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        });
        const data = await res.json();
        return data.success === true;
    } catch (err) {
        logger.warn('[captcha] Turnstile verification failed:', err.message);
        return false;
    }
}

/**
 * 验证 Google reCAPTCHA v3 token
 */
async function verifyRecaptchaV3(token, secret, threshold = 0.5) {
    try {
        const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret, response: token }),
        });
        const data = await res.json();
        return data.success === true && (data.score || 0) >= threshold;
    } catch (err) {
        logger.warn('[captcha] reCAPTCHA verification failed:', err.message);
        return false;
    }
}

/**
 * 统一验证码校验入口
 * 根据 config.captchaType 显式选择验证方式
 * @param {object} config - 空间配置
 * @param {string|null} turnstileToken
 * @param {string|null} recaptchaToken
 * @param {string} ip
 * @returns {Promise<{pass: boolean, reason?: string}>}
 */
export async function verifyCaptcha(config, turnstileToken, recaptchaToken, ip) {
    const type = config.captchaType;

    if (type === 'turnstile') {
        if (!config.turnstileSecret) {
            return { pass: false, reason: 'Turnstile secret not configured' };
        }
        if (!turnstileToken) {
            return { pass: false, reason: 'Turnstile token required' };
        }
        const ok = await verifyTurnstile(turnstileToken, config.turnstileSecret, ip);
        return ok ? { pass: true } : { pass: false, reason: 'Turnstile verification failed' };
    }

    if (type === 'recaptchaV3') {
        if (!config.recaptchaV3Secret) {
            return { pass: false, reason: 'reCAPTCHA secret not configured' };
        }
        if (!recaptchaToken) {
            return { pass: false, reason: 'reCAPTCHA token required' };
        }
        const ok = await verifyRecaptchaV3(recaptchaToken, config.recaptchaV3Secret);
        return ok ? { pass: true } : { pass: false, reason: 'reCAPTCHA verification failed' };
    }

    // captchaType 为空或未知 → 不启用验证码，放行
    return { pass: true };
}

export default { verifyCaptcha };
