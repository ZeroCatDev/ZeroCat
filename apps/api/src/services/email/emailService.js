import {createTransport} from "nodemailer";
import zcconfig from "../config/zcconfig.js";
import logger from "../logger.js";

let transporter;

/**
 * 根据 tls_mode 构建 nodemailer transport 选项。
 * - ssl      : secure=true，直接 SSL 连接（通常端口 465）
 * - starttls : secure=false + requireTLS=true，STARTTLS 升级（通常端口 587）
 * - none     : secure=false，无加密（通常端口 25）
 *
 * 若未配置 tls_mode，则回退到旧的 mail.secure 布尔值以保持向后兼容。
 */
export const buildTransportOptions = (host, port, tlsMode, secureFlag, user, pass) => {
    let secure = false;
    let requireTLS = false;

    if (tlsMode === "ssl") {
        secure = true;
    } else if (tlsMode === "starttls") {
        secure = false;
        requireTLS = true;
    } else if (tlsMode === "none") {
        secure = false;
    } else {
        // 向后兼容：使用旧的 mail.secure 布尔值
        secure = !!secureFlag;
    }

    const opts = {
        host,
        port,
        secure,
        auth: { user, pass },
    };

    if (requireTLS) {
        opts.requireTLS = true;
    }

    return opts;
};

const getMailConfig = async () => {
    const enabled = await zcconfig.get("mail.enabled");
    if (!enabled) {
        return null;
    }

    const host = await zcconfig.get("mail.host");
    const port = await zcconfig.get("mail.port");
    const tlsMode = await zcconfig.get("mail.tls_mode");
    const secureFlag = await zcconfig.get("mail.secure");
    const user = await zcconfig.get("mail.auth.user");
    const pass = await zcconfig.get("mail.auth.pass");
    const fromName = await zcconfig.get("mail.from_name");
    const fromAddress = await zcconfig.get("mail.from_address");

    if (!host || !port || !user || !pass) {
        logger.error("[email] 缺少必要的邮件配置");
        return null;
    }

    const config = buildTransportOptions(host, port, tlsMode, secureFlag, user, pass);

    return {
        config,
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        tls: {
            rejectUnauthorized: false
        }
    };
};
const initializeTransporter = async () => {
    try {
        const mailConfig = await getMailConfig();
        logger.debug("[email] 邮件配置:", mailConfig);
        if (!mailConfig) {
            logger.info("[email] 邮件服务已禁用或未正确配置");
            return false;
        }

        const transportOptions = {
            ...mailConfig.config,
            tls: mailConfig.tls,
        };
        logger.debug("[email] 初始化邮件传输器:", transportOptions);
        transporter = createTransport(transportOptions);

        // Test the connection
        await transporter.verify();
        logger.info("[email] 邮件服务初始化成功");
        return true;
    } catch (error) {
        logger.error("[email] 邮件服务初始化失败:", error);
        return false;
    }
};

const sendEmailDirect = async (to, subject, html) => {
    try {
        if (!transporter) {
            const initialized = await initializeTransporter();
            if (!initialized) {
                throw new Error("Email service is not available or not properly configured");
            }
        }

        const mailConfig = await getMailConfig();
        if (!mailConfig) {
            throw new Error("Email service is disabled or not properly configured");
        }

        await transporter.sendMail({
            from: mailConfig.from,
            to: to,
            subject: subject,
            html: html,
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

export {sendEmail, sendEmailDirect};
