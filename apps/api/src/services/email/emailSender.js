import { createTransport } from 'nodemailer';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

let amailClient = null;

/**
 * 获取邮件发送方式
 * @returns {Promise<'smtp'|'amail'>}
 */
async function getMailProvider() {
    return (await zcconfig.get('mail.provider')) || 'smtp';
}

/**
 * 获取全局发件人地址
 * @returns {Promise<string|null>}
 */
async function getFromAddress() {
    const fromName = await zcconfig.get('mail.from_name') || await zcconfig.get('site.name');
    const fromAddress = await zcconfig.get('mail.from_address');
    if (!fromAddress) return null;
    return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/**
 * 获取或初始化 Amail 客户端
 */
async function getAmailClient() {
    if (amailClient) return amailClient;

    const apiKey = await zcconfig.get('amail.api_key');
    const baseUrl = await zcconfig.get('amail.base_url') || 'http://localhost:4000';
    const providerId = await zcconfig.get('amail.provider_id') || 'auto';

    if (!apiKey) {
        throw new Error('Amail API key is not configured (amail.api_key)');
    }

    const { Amail } = await import('@wydev/amail');
    amailClient = new Amail(apiKey, { baseUrl, providerId });
    return amailClient;
}

/**
 * 通过 Amail 发送邮件
 */
async function sendViaAmail({ to, subject, html, from }) {
    const client = await getAmailClient();

    const payload = {
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
    };

    const { data, error } = await client.emails.send(payload);

    if (error) {
        throw new Error(`Amail error: ${error.name} - ${error.message}`);
    }

    logger.info(`[email-sender] Amail email sent, id: ${data?.id}`);
    return { provider: 'amail', id: data?.id };
}

/**
 * 通过 SMTP 发送邮件
 */
async function sendViaSmtp({ to, subject, html, from }) {
    const host = await zcconfig.get('mail.host');
    const port = await zcconfig.get('mail.port');
    const secure = await zcconfig.get('mail.secure');
    const user = await zcconfig.get('mail.auth.user');
    const pass = await zcconfig.get('mail.auth.pass');

    if (!host || !port || !user || !pass) {
        throw new Error('SMTP is not properly configured (missing mail.host/port/auth)');
    }

    const transporter = createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: false,
        },
    });

    await transporter.sendMail({ from, to, subject, html });
    logger.info(`[email-sender] SMTP email sent to ${to}`);
    return { provider: 'smtp' };
}

/**
 * 统一邮件发送入口
 * @param {object} options
 * @param {string|string[]} options.to - 收件人
 * @param {string} options.subject - 邮件主题
 * @param {string} options.html - 邮件 HTML 内容
 * @param {string} [options.from] - 发件人（可选，默认使用全局配置）
 * @returns {Promise<{provider: string, id?: string}>}
 */
async function sendMail({ to, subject, html, from }) {
    const provider = await getMailProvider();
    const sender = from || await getFromAddress();

    if (!sender) {
        throw new Error('No from address configured');
    }

    const mailOptions = { to, subject, html, from: sender };

    if (provider === 'amail') {
        return sendViaAmail(mailOptions);
    }

    return sendViaSmtp(mailOptions);
}

/**
 * 重置 Amail 客户端（配置变更时调用）
 */
function resetAmailClient() {
    amailClient = null;
}

export {
    sendMail,
    sendViaSmtp,
    sendViaAmail,
    getMailProvider,
    getFromAddress,
    getAmailClient,
    resetAmailClient,
};
