import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { prisma } from "./prisma.js";
import logger from "./logger.js";
import zcconfig from "./config/zcconfig.js";
import { createNotification } from "../controllers/notifications.js";
import { sendEmailAdvanced } from "./email/emailService.js";

const SMTP_APP_CONFIG_TARGET_TYPE = "oauth_application";
const SMTP_APP_CONFIG_KEY_FORWARD_EMAIL = "smtp.forward_to_user_email";
const SMTP_NOTIFICATION_TYPE = "oauth_smtp_mail_received";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_DOMAIN = "localhost";
const DEFAULT_MAX_MESSAGE_BYTES = 1024 * 1024;
const COMMON_SMTP_PORTS = [25, 465, 587, 2525];

// 内置自签名证书，确保无需额外配置即可使用TLS
const SMTP_TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIULj0gUar7pAQ6QY3YhT33gCSQWhgwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDIxMDA5NTQ1MVoXDTM2MDIw
ODA5NTQ1MVowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAz+tNVrCp8IEDJ59SfGABUIGtwNWl19D2jaRy4N6ki1Sk
jlgwlPAGZnZSx54giNNfkHwBS0RG+3H9NWbR99kYi+Ew6dSGIEXcLrdUFAZ1vt3G
YO3B1io7zPWEHnFiLjiXdZqy4GW2bKs2FOMa1VOHAAtlZGiFXkN8OTjAUG00Y63D
Uc76KFtF3bnajo/+G9grT7H94Oi3gU8bJINMtt4WxQvKqE/c4eW+X1NKR0BrZY9f
227Tl/mEzPGGSEQ8r1gKtIsRyGUofZhTiCS4c33Po8CFRsNWPsx1HC8B2l77V2sN
qzjI07GwKOLlA8dX+NIxqNQYTBoKl+6xnnJkYz7l9QIDAQABo1MwUTAdBgNVHQ4E
FgQUuhRt00sBIjGGjlOhws3Kz3jkjrEwHwYDVR0jBBgwFoAUuhRt00sBIjGGjlOh
ws3Kz3jkjrEwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAcDl0
jJ3srl/yttWtuJucCUR17UF5Em2/iXa5rh+1rE2TaGpa4P3YRFRCuocQbRyzyDML
onBjjMhrj9IfnJ6gUnwHYhXYDac+jW0xc+77uXRAq+nnsmdE9/yBT+bf2NNfdmzd
Q1nuim6PQ3udkRxMqo+Ixr2Pg2dyEaXtW6mSU2eHofTAZ5Vb/EKM2mqpATVyE6mN
la7mlauUC5KLURh/fSkI2EKnh3G4oCeL2W2b+D+Iz0Jcqe5/qe8Vj22RpUH3eJ/6
yuHU1E7g6JjNH3UNBWRJpHZ87/gfLLfRWUVBJrDehY+7TX0eckpmD19WGkzLiGaI
nq7wQxZuiJ/Kzg4BEg==
-----END CERTIFICATE-----`;

const SMTP_TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDP601WsKnwgQMn
n1J8YAFQga3A1aXX0PaNpHLg3qSLVKSOWDCU8AZmdlLHniCI01+QfAFLREb7cf01
ZtH32RiL4TDp1IYgRdwut1QUBnW+3cZg7cHWKjvM9YQecWIuOJd1mrLgZbZsqzYU
4xrVU4cAC2VkaIVeQ3w5OMBQbTRjrcNRzvooW0XdudqOj/4b2CtPsf3g6LeBTxsk
g0y23hbFC8qoT9zh5b5fU0pHQGtlj1/bbtOX+YTM8YZIRDyvWAq0ixHIZSh9mFOI
JLhzfc+jwIVGw1Y+zHUcLwHaXvtXaw2rOMjTsbAo4uUDx1f40jGo1BhMGgqX7rGe
cmRjPuX1AgMBAAECggEAGTEMz06bYID5JWFX6KrnLd5wc3dPXz05ykKdCqLfM+R/
BaIozLriQ6Ldd8MwdPOLViG4NGri4M9YWxKIqSt8HmKb/xDZaWqdeWmL/dskhAox
4YedHzpBwZ0Ts26Qc0I3E7A5MRgRyMvbwx8bHrK+niJDWC2Tzy6FDBfUsUnx+YuZ
hFTJ86txUlVIb5ViFyd4uRr2Yf8WXGjBJmI9zKjLczf0dunRrVnNL4cml1krID4c
OCnNiaOgVRMDuT36yPJO34GL+K+DQt4oL2fJbaqOWJkHy3me6IyFSpK+neZzQ4Ay
B+94RPTcQEnxXyo+fSqvjrqulFQXZL4ygHehUXlyFwKBgQD8+DYrs9GazsspmhL9
g9OqmlmWqMAorl/DgoidxuEHkDQG4GRKqBFW0UG3UHS5i8ugpOWDzcpoyjJrfUGd
t9ajzwTQnI4d44oFOgAUTI8aa4T2hony/Wt63/yPxvesgK6i9rfUSKsMNZmrOy+a
ml0vsQxdqKlGibJqV9H7G+slYwKBgQDSaO7kyFk2SwYjEnHj3fGU/BbssYKLMnUq
8aWxgPOgMDQPtbpSbxtMcmFEWOzaq0iLN7I/7f9EOTA1VY3dHIOE+3dYKrZNupal
bmZiLMSy9TnqtvU8j+rOxdwZ8ZT0R2IUdZ642n4pqPeSwwszmFqk+ZgRlruF0nGg
m2WYv5KyxwKBgQDRh5n+6stjaYO3qqmuGGHa/kvUUWQQjhY970HPRaqgRB4D0Bri
B4GNInhHKTn1ccgxAEQmvu63izrl83LE+z+qoM9BJ1tDgHOSzq7AIYWqgYI5W8ip
XqSGuz4LrOb6l/+OdcJf7+zViRQGU1ijutYSqZgvf4LuLSF9mc4QKtjDNwKBgBKA
nblKkOXAVSrSXWd/RdYnENEBjww0hK8hDsP8JfBJLNrQzTCgipL/X+RFuZZFB50O
acNLZ24VZVLbUh1Ge54/CrCbGOre5I5pleE+NJHUFKK6MfiAY1KJfaBeaQ3OFSbd
bPauZ/e73wFt21dPJ3FobWHmkljjN5C6+YUkG39TAoGBALztP/3xZdJwlZMxsX0k
qTSpF0M/KQ3MUMhMkdcwxZBrmqV+UbNBo9TWnm7NiZyovjTvN0f8W+Las4Xku0Qp
A0qAwaWOzHvcwOoQ1B0JNU3mCD/8lpzxSNA/Lef0Wzeju1Q+rNQmtxf00t2akulD
UAqdMlrm2yWBrPBj8HaWnAWH
-----END PRIVATE KEY-----`;

const parseBooleanInput = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
    return null;
};

const parseBooleanConfigValue = (value, fallback = false) => {
    const parsed = parseBooleanInput(value);
    return parsed === null ? fallback : parsed;
};

const normalizeEmailAddress = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    return raw.replace(/^mailto:/i, "").toLowerCase();
};

const normalizeUsername = (value) => {
    const raw = String(value || "").trim();
    return raw || null;
};

const getEmailLocalPart = (address) => {
    const normalized = normalizeEmailAddress(address);
    if (!normalized || !normalized.includes("@")) return null;
    return normalized.split("@")[0] || null;
};

const extractSenderName = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const angleMatch = raw.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
    const candidate = (angleMatch ? angleMatch[1] : raw).trim().replace(/^"+|"+$/g, "");
    if (!candidate || candidate.includes("@")) return null;
    return candidate;
};

const stripHtml = (html) => {
    return String(html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const smtpError = (message, responseCode = 550) => {
    const error = new Error(message);
    error.responseCode = responseCode;
    return error;
};

class SmtpGatewayService {
    constructor() {
        this.host = DEFAULT_HOST;
        this.domain = DEFAULT_DOMAIN;
        this.maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES;
        this.servers = [];
    }

    async initialize() {
        if (this.servers.length > 0) return true;

        this.domain = await this.resolveDefaultDomain();
        this.maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES;

        const portDefs = COMMON_SMTP_PORTS.map((port) => ({
            port,
            secure: port === 465,
        }));

        for (const def of portDefs) {
            try {
                const server = await this.startServer(def);
                this.servers.push({
                    port: def.port,
                    secure: def.secure,
                    server,
                });
                logger.info(`[smtp-gateway] 端口已监听 smtp://${this.host}:${def.port} secure=${def.secure}`);
            } catch (error) {
                logger.warn(`[smtp-gateway] 端口监听失败 ${def.port}: ${error.code || error.message}`);
            }
        }

        if (this.servers.length === 0) {
            logger.error("[smtp-gateway] 所有常见SMTP端口监听均失败");
            throw new Error("No SMTP ports could be bound");
        }

        logger.info(
            `[smtp-gateway] 启动完成，监听端口=${this.getListeningPorts().join(",")} secure_ports=${this.getSecurePorts().join(",")}`
        );
        return true;
    }

    async shutdown() {
        if (this.servers.length === 0) return;

        const closeJobs = this.servers.map(({ server }) =>
            new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            })
        );

        await Promise.allSettled(closeJobs);
        logger.info(`[smtp-gateway] 已关闭，释放端口=${this.getListeningPorts().join(",")}`);
        this.servers = [];
    }

    getListeningPorts() {
        return this.servers.map((item) => item.port);
    }

    getSecurePorts() {
        return this.servers.filter((item) => item.secure).map((item) => item.port);
    }

    async startServer({ port, secure }) {
        const server = new SMTPServer({
            secure,
            key: SMTP_TLS_KEY,
            cert: SMTP_TLS_CERT,
            banner: "ZeroCat SMTP Gateway Ready",
            size: this.maxMessageBytes,
            authMethods: ["PLAIN", "LOGIN"],
            allowInsecureAuth: true,
            hideSTARTTLS: false,
            disabledCommands: [],
            logger: false,
            onConnect: (session, callback) => this.onConnect(session, callback),
            onAuth: (auth, session, callback) => this.onAuth(auth, session, callback),
            onMailFrom: (address, session, callback) => this.onMailFrom(address, session, callback),
            onRcptTo: (address, session, callback) => this.onRcptTo(address, session, callback),
            onData: (stream, session, callback) => this.onData(stream, session, callback),
        });

        await new Promise((resolve, reject) => {
            const onError = (error) => {
                server.off("listening", onListening);
                reject(error);
            };
            const onListening = () => {
                server.off("error", onError);
                resolve();
            };

            server.once("error", onError);
            server.once("listening", onListening);
            server.listen(port, this.host);
        });

        server.on("error", (error) => {
            logger.error(`[smtp-gateway] 服务器错误 port=${port}:`, error);
        });

        return server;
    }

    onConnect(session, callback) {
        session.zc = {
            application: null,
            mailFrom: null,
            recipientsByAddress: new Map(),
        };
        callback();
    }

    async onAuth(auth, session, callback) {
        try {
            const clientId = normalizeUsername(auth?.username);
            const clientSecret = String(auth?.password || "");
            if (!clientId || !clientSecret) {
                return callback(smtpError("Invalid authentication credentials", 535));
            }

            const application = await this.authenticateApplication(clientId, clientSecret);
            if (!application) {
                return callback(smtpError("Invalid authentication credentials", 535));
            }

            session.zc.application = application;
            session.zc.recipientsByAddress = new Map();
            return callback(null, {
                user: clientId,
            });
        } catch (error) {
            logger.error("[smtp-gateway] AUTH处理失败:", error);
            return callback(smtpError("Authentication failed", 535));
        }
    }

    async onMailFrom(address, session, callback) {
        try {
            if (!session?.zc?.application) {
                return callback(smtpError("Authentication required", 530));
            }

            // from 不参与业务校验，保持兼容各种客户端写法
            const senderAddress = normalizeEmailAddress(address?.address) || String(address?.address || "").trim();
            session.zc.mailFrom = senderAddress || "unknown";
            session.zc.recipientsByAddress = new Map();
            return callback();
        } catch (error) {
            logger.error("[smtp-gateway] MAIL FROM处理失败:", error);
            return callback(smtpError("Unable to accept sender", 451));
        }
    }

    async onRcptTo(address, session, callback) {
        try {
            const application = session?.zc?.application;
            if (!application) {
                return callback(smtpError("Authentication required", 530));
            }

            if (!session?.zc?.mailFrom) {
                return callback(smtpError("Need MAIL FROM before RCPT TO", 503));
            }

            const recipientAddress = normalizeEmailAddress(address?.address);
            if (!recipientAddress) {
                return callback(smtpError("Invalid recipient address", 553));
            }

            let recipient = await this.resolveRecipientForApplication(application.id, recipientAddress);
            if (!recipient && application.is_verified) {
                recipient = {
                    userId: null,
                    username: null,
                    displayName: null,
                    authorizedEmail: recipientAddress,
                    recipientAddress,
                    matchType: "external_email",
                };
            }
            if (!recipient) {
                return callback(smtpError("Recipient not found", 550));
            }

            if (!(session.zc.recipientsByAddress instanceof Map)) {
                session.zc.recipientsByAddress = new Map();
            }
            session.zc.recipientsByAddress.set(recipientAddress, recipient);
            return callback();
        } catch (error) {
            logger.error("[smtp-gateway] RCPT TO处理失败:", error);
            return callback(smtpError("Unable to accept recipient", 451));
        }
    }

    async onData(stream, session, callback) {
        try {
            const application = session?.zc?.application;
            if (!application) {
                return callback(smtpError("Authentication required", 530));
            }

            const recipients = Array.from(session?.zc?.recipientsByAddress?.values?.() || []);
            if (recipients.length === 0) {
                return callback(smtpError("Need valid RCPT TO before DATA", 503));
            }

            const rawBuffer = await this.readStreamToBuffer(stream);
            const parsedMail = await simpleParser(rawBuffer);
            const fromDisplay = parsedMail?.from?.text || session?.zc?.mailFrom || `${application.client_id}@localhost`;
            const subject = parsedMail?.subject || "（无主题）";
            const textRaw = parsedMail?.text || stripHtml(parsedMail?.html || "");
            const preview = String(textRaw || "").replace(/\s+/g, " ").trim().slice(0, 240);
            const messageId = parsedMail?.messageId || null;
            const mailDate = parsedMail?.date || null;

            const result = await this.processIncomingMail({
                application,
                mailFrom: session.zc.mailFrom,
                recipients,
                parsed: {
                    from: fromDisplay,
                    subject,
                    text: String(textRaw || "").trim(),
                    preview,
                    messageId,
                    date: mailDate,
                    rawBuffer,
                },
                connectionIp: session?.remoteAddress || "unknown",
            });

            session.zc.mailFrom = null;
            session.zc.recipientsByAddress = new Map();

            return callback(
                null,
                `Accepted (forwarded=${result.forwardSuccess}, notified=${result.notifySuccess}, failed=${result.failedCount})`
            );
        } catch (error) {
            logger.error("[smtp-gateway] DATA处理失败:", error);
            return callback(smtpError("Unable to process message", 451));
        }
    }

    async readStreamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let totalBytes = 0;

            stream.on("data", (chunk) => {
                const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                totalBytes += bufferChunk.length;
                chunks.push(bufferChunk);
            });

            stream.once("error", (error) => {
                reject(error);
            });

            stream.once("end", () => {
                resolve(Buffer.concat(chunks, totalBytes));
            });
        });
    }

    async resolveDefaultDomain() {
        try {
            const backendUrl = await zcconfig.get("urls.backend");
            const hostname = new URL(backendUrl).hostname;
            return hostname || DEFAULT_DOMAIN;
        } catch (error) {
            return DEFAULT_DOMAIN;
        }
    }

    async authenticateApplication(clientId, clientSecret) {
        return prisma.ow_oauth_applications.findFirst({
            where: {
                client_id: String(clientId),
                client_secret: String(clientSecret),
                status: "active",
            },
            select: {
                id: true,
                name: true,
                client_id: true,
                owner_id: true,
                is_verified: true,
            },
        });
    }

    async resolveRecipientForApplication(applicationId, recipientAddress) {
        const normalizedRecipient = normalizeEmailAddress(recipientAddress);
        if (!normalizedRecipient) return null;

        const toRecipient = async (user, matchType, fallbackEmail = null) => {
            if (!user) return null;

            const authorization = await prisma.ow_oauth_authorizations.findUnique({
                where: {
                    application_id_user_id: {
                        application_id: Number(applicationId),
                        user_id: user.id,
                    },
                },
                select: {
                    status: true,
                    authorized_email: true,
                },
            });

            const authorizedEmail =
                authorization?.status === "active" && authorization?.authorized_email
                    ? String(authorization.authorized_email).toLowerCase()
                    : user.email
                        ? String(user.email).toLowerCase()
                        : fallbackEmail
                            ? String(fallbackEmail).toLowerCase()
                            : normalizedRecipient;

            return {
                userId: user.id,
                username: user.username,
                displayName: user.display_name || user.username,
                authorizedEmail,
                recipientAddress: normalizedRecipient,
                matchType,
            };
        };

        const byAuthorizedEmail = await prisma.ow_oauth_authorizations.findFirst({
            where: {
                application_id: Number(applicationId),
                status: "active",
                authorized_email: {
                    equals: normalizedRecipient,
                    mode: "insensitive",
                },
            },
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                    },
                },
                authorized_email: true,
            },
        });
        if (byAuthorizedEmail?.user) {
            return toRecipient(byAuthorizedEmail.user, "authorized_email", byAuthorizedEmail.authorized_email);
        }

        const byEmailContact = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_type: "email",
                contact_value: {
                    equals: normalizedRecipient,
                    mode: "insensitive",
                },
            },
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        email: true,
                    },
                },
            },
        });
        if (byEmailContact?.user) {
            return toRecipient(byEmailContact.user, "email_contact", normalizedRecipient);
        }

        const byUserEmail = await prisma.ow_users.findFirst({
            where: {
                email: {
                    equals: normalizedRecipient,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                email: true,
            },
        });
        if (byUserEmail) {
            return toRecipient(byUserEmail, "user_email", normalizedRecipient);
        }

        const localPart = getEmailLocalPart(normalizedRecipient);
        if (!localPart) return null;

        const uidMatch = localPart.match(/^uid-(\d+)$/i);
        if (uidMatch) {
            const byUid = await prisma.ow_users.findUnique({
                where: { id: Number(uidMatch[1]) },
                select: {
                    id: true,
                    username: true,
                    display_name: true,
                    email: true,
                },
            });
            if (byUid) {
                return toRecipient(byUid, "uid_hint", normalizedRecipient);
            }
        }

        const byUsername = await prisma.ow_users.findFirst({
            where: {
                username: {
                    equals: localPart,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                email: true,
            },
        });
        if (byUsername) {
            return toRecipient(byUsername, "username_hint", normalizedRecipient);
        }

        return null;
    }

    async getApplicationForwardSetting(applicationId) {
        const record = await prisma.ow_target_configs.findUnique({
            where: {
                target_type_target_id_key: {
                    target_type: SMTP_APP_CONFIG_TARGET_TYPE,
                    target_id: String(applicationId),
                    key: SMTP_APP_CONFIG_KEY_FORWARD_EMAIL,
                },
            },
            select: {
                value: true,
            },
        });
        return parseBooleanConfigValue(record?.value, false);
    }

    async processIncomingMail({ application, mailFrom, recipients, parsed, connectionIp }) {
        const frontendUrl = await zcconfig.get("urls.frontend");
        const notificationLink = frontendUrl
            ? `${String(frontendUrl).replace(/\/+$/, "")}/app/notifications`
            : null;

        const safeTitle = parsed.subject || "（无主题）";
        const subject = `${application.name} 邮件通知`.slice(0, 100);
        const fromDisplay = parsed.from || mailFrom || `${application.client_id}@localhost`;
        const textContent = String(parsed.text || "").trim();
        const preview = parsed.preview || String(textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
        const baseContent = preview
            ? preview
            : safeTitle;
        const rawBuffer = Buffer.isBuffer(parsed.rawBuffer) ? parsed.rawBuffer : Buffer.alloc(0);

        const uniqueRecipientsByAddress = new Map();
        const uniqueRecipientsByUserId = new Map();
        for (const recipient of recipients) {
            const normalizedAddress =
                normalizeEmailAddress(recipient?.recipientAddress) ||
                normalizeEmailAddress(recipient?.authorizedEmail);

            if (normalizedAddress && !uniqueRecipientsByAddress.has(normalizedAddress)) {
                uniqueRecipientsByAddress.set(normalizedAddress, {
                    ...recipient,
                    recipientAddress: normalizedAddress,
                    authorizedEmail: normalizeEmailAddress(recipient?.authorizedEmail) || normalizedAddress,
                });
            }

            if (recipient?.userId && !uniqueRecipientsByUserId.has(recipient.userId)) {
                uniqueRecipientsByUserId.set(recipient.userId, recipient);
            }
        }

        let forwardSuccess = 0;
        let forwardFailed = 0;
        let notifySuccess = 0;
        let notifyFailed = 0;

        if (application.is_verified) {
            for (const recipient of uniqueRecipientsByAddress.values()) {
                try {
                    await this.forwardRawMail({
                        recipientAddress: recipient.recipientAddress,
                        rawBuffer,
                        fallbackSubject: subject,
                        fallbackTextContent: textContent,
                        senderName: extractSenderName(fromDisplay),
                    });
                    forwardSuccess += 1;
                } catch (error) {
                    forwardFailed += 1;
                    logger.error(
                        `[smtp-gateway] 原文转发失败 app=${application.client_id} recipient=${recipient.recipientAddress}:`,
                        error
                    );
                }
            }
        } else {
            for (const recipient of uniqueRecipientsByUserId.values()) {
                try {
                    const notificationData = {
                        smtp_from: fromDisplay,
                        smtp_subject: subject,
                        smtp_preview: preview,
                        smtp_text: textContent.slice(0, 5000),
                        smtp_recipient: recipient.recipientAddress,
                        smtp_message_id: parsed.messageId,
                        smtp_date: parsed.date,
                        oauth_application_id: application.id,
                        oauth_application_client_id: application.client_id,
                        oauth_application_name: application.name,
                        oauth_application_owner_id: application.owner_id,
                        recipient_match_type: recipient.matchType,
                        connection_ip: connectionIp,
                    };

                    await createNotification({
                        userId: recipient.userId,
                        actorId: application.owner_id ? Number(application.owner_id) : undefined,
                        notificationType: SMTP_NOTIFICATION_TYPE,
                        title: safeTitle,
                        content: baseContent,
                        link: notificationLink,
                        targetType: "user",
                        targetId: recipient.userId,
                        pushChannels: ["browser"],
                        data: notificationData,
                    });

                    notifySuccess += 1;
                } catch (error) {
                    notifyFailed += 1;
                    logger.error(
                        `[smtp-gateway] 发送通知失败 app=${application.client_id} user=${recipient.userId}:`,
                        error
                    );
                }
            }
        }

        const successCount = forwardSuccess + notifySuccess;
        const failedCount = forwardFailed + notifyFailed;

        logger.info(
            `[smtp-gateway] 邮件处理完成 app=${application.client_id} verified=${application.is_verified} from=${mailFrom} recipients=${uniqueRecipientsByAddress.size} users=${uniqueRecipientsByUserId.size} forward_success=${forwardSuccess} forward_failed=${forwardFailed} notify_success=${notifySuccess} notify_failed=${notifyFailed} ip=${connectionIp}`
        );

        return {
            successCount,
            failedCount,
            forwardSuccess,
            forwardFailed,
            notifySuccess,
            notifyFailed,
        };
    }

    async forwardRawMail({ recipientAddress, rawBuffer, fallbackSubject, fallbackTextContent, senderName }) {
        const normalizedRecipient = normalizeEmailAddress(recipientAddress);
        if (!normalizedRecipient) {
            throw new Error("Invalid forwarding recipient");
        }

        const safeSubject = String(fallbackSubject || "（无主题）").slice(0, 180);
        const safeTextContent = String(fallbackTextContent || "").trim();
        const rawMessage =
            Buffer.isBuffer(rawBuffer) && rawBuffer.length > 0
                ? rawBuffer
                : Buffer.from(
                    `From: no-reply@localhost\r\nTo: ${normalizedRecipient}\r\nSubject: ${safeSubject}\r\n\r\n${safeTextContent}`,
                    "utf8"
                );

        const envelope = { to: normalizedRecipient };

        await sendEmailAdvanced({
            envelope,
            raw: rawMessage,
            senderName: senderName || "零猫社区",
        });
    }
}

const smtpGateway = new SmtpGatewayService();
export default smtpGateway;
