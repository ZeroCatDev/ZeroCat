import {createTransport} from "nodemailer";
import zcconfig from "../config/zcconfig.js";
import logger from "../logger.js";

let transporter;

const getMailConfig = async () => {
    const enabled = await zcconfig.get("mail.enabled");
    if (!enabled) {
        return null;
    }

    const host = await zcconfig.get("mail.host");
    const port = await zcconfig.get("mail.port");
    const secure = await zcconfig.get("mail.secure");
    const user = await zcconfig.get("mail.auth.user");
    const pass = await zcconfig.get("mail.auth.pass");
    const fromName = await zcconfig.get("mail.from_name");
    const fromAddress = await zcconfig.get("mail.from_address");

    if (!host || !port || !user || !pass) {
        logger.error("[email] 缺少必要的邮件配置");
        return null;
    }

    const config = {
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        }
    };

    return {
        config,
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        tls: {
            maxVersion: 'TLSv1.2',
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

        logger.debug("[email] 初始化邮件传输器:", mailConfig.config);
        transporter = createTransport(mailConfig.config);

        // Test the connection
        await transporter.verify();
        logger.info("[email] 邮件服务初始化成功");
        return true;
    } catch (error) {
        logger.error("[email] 邮件服务初始化失败:", error);
        return false;
    }
};

const sendEmail = async (to, subject, html) => {
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

// Initialize email service when the module is loaded
initializeTransporter().catch(error => {
    logger.error("[email] 模块加载时初始化邮件服务失败:", error);
});

export {sendEmail};