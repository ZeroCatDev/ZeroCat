import { createTransport } from "nodemailer";
import zcconfig from "../config/zcconfig.js";
import logger from "../logger.js";

const SMTP_TIMEOUTS = {
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
};
const DEFAULT_FROM_NAME = "零猫社区";

const isRetryableConnectionError = (error) => {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || "").toLowerCase();

    if (["ESOCKET", "ECONNECTION", "ECONNRESET", "ETIMEDOUT", "ETLS"].includes(code)) {
        return true;
    }

    return message.includes("unexpected socket close") || message.includes("connection closed");
};

const resolveSecureCandidates = (secureConfig, port) => {
    const normalizedPort = Number(port);
    const primarySecure =
        typeof secureConfig === "boolean"
            ? secureConfig
            : normalizedPort === 465;

    return primarySecure ? [true, false] : [false, true];
};

const extractAddress = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return extractAddress(value[0]);
    if (typeof value === "object") return extractAddress(value.address || value.from);

    const text = String(value).trim();
    if (!text) return null;
    const match = text.match(/<([^>]+)>/);
    return (match ? match[1] : text).trim().toLowerCase();
};

const isEmailAddress = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+$/.test(value);

const resolveSenderAddress = (fromAddress, authUser) => {
    const configuredFromAddress = extractAddress(fromAddress);
    if (isEmailAddress(configuredFromAddress)) return configuredFromAddress;

    const authAddress = extractAddress(authUser);
    if (isEmailAddress(authAddress)) return authAddress;

    return null;
};

const extractDisplayName = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return extractDisplayName(value[0]);

    if (typeof value === "object") {
        if (value.name) return extractDisplayName(value.name);
        if (value.text) return extractDisplayName(value.text);
        return null;
    }

    const text = String(value).trim();
    if (!text) return null;
    const angleMatch = text.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
    const candidate = (angleMatch ? angleMatch[1] : text).trim().replace(/^"+|"+$/g, "");
    if (!candidate || candidate.includes("@")) return null;
    return candidate;
};

const resolveFromDisplayName = (mailOptions = {}) => {
    const explicit = extractDisplayName(mailOptions.senderName);
    if (explicit) return explicit;

    const fromName = extractDisplayName(mailOptions.from);
    if (fromName) return fromName;

    return DEFAULT_FROM_NAME;
};

const buildFromHeader = (displayName, senderAddress) => `${displayName} <${senderAddress}>`;

const rewriteRawHeaders = (rawInput, fromHeader) => {
    const raw = Buffer.isBuffer(rawInput) ? rawInput.toString("utf8") : String(rawInput || "");
    const separator = raw.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
    const splitIndex = raw.indexOf(separator);
    if (splitIndex < 0) return rawInput;

    const headerPart = raw.slice(0, splitIndex);
    const bodyPart = raw.slice(splitIndex + separator.length);
    const headerLines = headerPart.split(/\r?\n/);
    const excludedHeaders = new Set([
        "from",
        "sender",
        "reply-to",
        "return-path",
        "x-original-from",
        "x-forwarded-for",
        "x-forwarded-to",
    ]);

    const keptHeaders = [];
    let skipContinuation = false;
    for (const line of headerLines) {
        if (/^\s/.test(line)) {
            if (!skipContinuation) keptHeaders.push(line);
            continue;
        }

        const colonIndex = line.indexOf(":");
        const headerName = (colonIndex > 0 ? line.slice(0, colonIndex) : line).trim().toLowerCase();
        skipContinuation = excludedHeaders.has(headerName);
        if (!skipContinuation) {
            keptHeaders.push(line);
        }
    }

    const rewritten = [`From: ${fromHeader}`, ...keptHeaders].join("\r\n") + "\r\n\r\n" + bodyPart;
    return Buffer.from(rewritten, "utf8");
};

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
    const fromAddress = await zcconfig.get("mail.from_address");

    const senderAddress = resolveSenderAddress(fromAddress, user);
    if (!host || !port || !user || !pass || !senderAddress) {
        logger.error("[email] 缺少必要的邮件配置");
        return null;
    }

    return {
        host,
        port: Number(port),
        secure,
        auth: { user, pass },
        senderAddress,
    };
};

const sendMailDirect = async (mailOptions = {}, mailConfig = null) => {
    const config = mailConfig || await getMailConfig();
    if (!config) {
        throw new Error("Email service is disabled or not properly configured");
    }

    const secureCandidates = resolveSecureCandidates(config.secure, config.port);
    let lastError = null;

    for (let index = 0; index < secureCandidates.length; index += 1) {
        const secureFlag = secureCandidates[index];
        const transporter = createTransport({
            host: config.host,
            port: config.port,
            secure: secureFlag,
            auth: config.auth,
            tls: {
                rejectUnauthorized: false,
            },
            ...SMTP_TIMEOUTS,
        });

        try {
            const payload = { ...mailOptions };
            const fromDisplayName = resolveFromDisplayName(payload);
            const fromHeader = buildFromHeader(fromDisplayName, config.senderAddress);

            delete payload.senderName;
            const envelope = { ...(payload.envelope || {}) };

            if (extractAddress(envelope.from) !== config.senderAddress) {
                envelope.from = config.senderAddress;
            }
            payload.envelope = envelope;

            if (payload.raw) {
                payload.raw = rewriteRawHeaders(payload.raw, fromHeader);
                delete payload.from;
            } else {
                payload.from = fromHeader;
            }

            await transporter.sendMail({
                ...payload,
            });
            return true;
        } catch (error) {
            lastError = error;
            if (!isRetryableConnectionError(error) || index === secureCandidates.length - 1) {
                break;
            }
            logger.warn(`[email] SMTP连接失败，尝试切换secure模式后重试 (secure=${secureFlag})`);
        }
    }

    throw lastError || new Error("Unknown SMTP send failure");
};

const sendEmailDirect = async (to, subject, html) => {
    try {
        await sendMailDirect({
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

const tryEnqueueMail = async (mailOptions = {}) => {
    const { default: queueManager } = await import("../queue/queueManager.js");
    if (!queueManager.isInitialized()) {
        return null;
    }
    return queueManager.enqueueMail(mailOptions);
};

const sendEmail = async (to, subject, html) => {
    const mailConfig = await getMailConfig();
    if (!mailConfig) {
        throw new Error("Email service is disabled or not properly configured");
    }

    try {
        const queuedResult = await tryEnqueueMail({ to, subject, html });
        if (queuedResult) {
            return queuedResult;
        }
    } catch (error) {
        logger.warn("[email] 通过队列发送失败，回退到直接发送:", error.message);
    }

    return sendMailDirect({ to, subject, html }, mailConfig);
};

const sendEmailAdvanced = async (mailOptions = {}) => {
    const mailConfig = await getMailConfig();
    if (!mailConfig) {
        throw new Error("Email service is disabled or not properly configured");
    }

    try {
        const queuedResult = await tryEnqueueMail(mailOptions);
        if (queuedResult) {
            return queuedResult;
        }
    } catch (error) {
        logger.warn("[email] 高级邮件队列发送失败，回退到直接发送:", error.message);
    }

    try {
        return await sendMailDirect(mailOptions, mailConfig);
    } catch (error) {
        logger.error("[email] 高级邮件发送失败:", error);
        throw error;
    }
};

export { sendEmail, sendEmailDirect, sendEmailAdvanced };
