import { sendMail, getMailProvider, getFromAddress } from './emailSender.js';
import { createTransport } from 'nodemailer';
import zcconfig from '../config/zcconfig.js';
import logger from '../logger.js';

let transporter;

const initializeTransporter = async () => {
    try {
        const provider = await getMailProvider();
        if (provider === 'amail') {
            logger.info('[email] 使用 Amail 作为邮件发送方式，跳过 SMTP 初始化');
            return true;
        }

        const enabled = await zcconfig.get('mail.enabled');
        if (!enabled) {
            logger.info('[email] 邮件服务已禁用');
            return false;
        }

        const host = await zcconfig.get('mail.host');
        const port = await zcconfig.get('mail.port');
        const secure = await zcconfig.get('mail.secure');
        const user = await zcconfig.get('mail.auth.user');
        const pass = await zcconfig.get('mail.auth.pass');

        if (!host || !port || !user || !pass) {
            logger.error('[email] 缺少必要的 SMTP 配置');
            return false;
        }

        const transportOptions = {
            host,
            port,
            secure,
            auth: { user, pass },
            tls: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: false,
            },
        };
        logger.debug('[email] 初始化 SMTP 传输器:', transportOptions);
        transporter = createTransport(transportOptions);

        await transporter.verify();
        logger.info('[email] SMTP 邮件服务初始化成功');
        return true;
    } catch (error) {
        logger.error('[email] 邮件服务初始化失败:', error);
        return false;
    }
};

const sendEmailDirect = async (to, subject, html) => {
    try {
        const provider = await getMailProvider();

        if (provider === 'amail') {
            return await sendMail({ to, subject, html });
        }

        // SMTP 模式
        if (!transporter) {
            const initialized = await initializeTransporter();
            if (!initialized) {
                throw new Error("Email service is not available or not properly configured");
            }
        }

        const from = await getFromAddress();
        if (!from) {
            throw new Error("No from address configured");
        }

        await transporter.sendMail({
            from,
            to,
            subject,
            html,
        });

        return true;
    } catch (error) {
        logger.error("[email] 发送邮件失败:", error);
        throw error;
    }
};

const sendEmail = async (to, subject, html) => {
    try {
        const { default: queueManager } = await import('../queue/queueManager.js');
        if (queueManager.isInitialized()) {
            return await queueManager.enqueueEmail(to, subject, html);
        }
    } catch (error) {
        logger.warn("[email] 通过队列发送失败，回退到直接发送:", error.message);
    }

    return sendEmailDirect(to, subject, html);
};

// Initialize email service when the module is loaded
initializeTransporter().catch(error => {
    logger.error("[email] 模块加载时初始化邮件服务失败:", error);
});

export { sendEmail, sendEmailDirect };
