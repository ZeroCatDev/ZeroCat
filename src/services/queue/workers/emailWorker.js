import { Worker } from 'bullmq';
import { createTransport } from 'nodemailer';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';
import { decodeMailOptionsFromJob } from '../mailJobCodec.js';

let worker = null;

const SMTP_TIMEOUTS = {
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 60000,
};
const DEFAULT_FROM_NAME = "零猫社区";

const isRetryableConnectionError = (error) => {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();

    if (['ESOCKET', 'ECONNECTION', 'ECONNRESET', 'ETIMEDOUT', 'ETLS'].includes(code)) {
        return true;
    }

    return message.includes('unexpected socket close') || message.includes('connection closed');
};

const resolveSecureCandidates = (secureConfig, port) => {
    const normalizedPort = Number(port);
    const primarySecure = typeof secureConfig === 'boolean'
        ? secureConfig
        : normalizedPort === 465;
    return primarySecure ? [true, false] : [false, true];
};

const extractAddress = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return extractAddress(value[0]);
    if (typeof value === 'object') return extractAddress(value.address || value.from);

    const text = String(value).trim();
    if (!text) return null;
    const match = text.match(/<([^>]+)>/);
    return (match ? match[1] : text).trim().toLowerCase();
};

const isEmailAddress = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value);

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

    if (typeof value === 'object') {
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

async function createEmailWorker() {
    const concurrency = await zcconfig.get('bullmq.email.concurrency') || 3;
    const connection = await createConnection('worker-email');

    worker = new Worker(
        QUEUE_NAMES.EMAIL,
        async (job) => {
            const rawMailOptions = job.data?.mailOptions || {
                to: job.data?.to,
                subject: job.data?.subject,
                html: job.data?.html,
            };
            const decodedMailOptions = decodeMailOptionsFromJob(rawMailOptions || {});
            const to = decodedMailOptions?.to || '(unknown recipient)';
            const subject = decodedMailOptions?.subject || '(no subject)';
            await job.log(`Processing email to ${to}, subject: "${subject}"`);

            const enabled = await zcconfig.get('mail.enabled');
            if (!enabled) {
                await job.log('ERROR: Email service is disabled');
                throw new Error('Email service is disabled');
            }

            const host = await zcconfig.get('mail.host');
            const port = await zcconfig.get('mail.port');
            const secure = await zcconfig.get('mail.secure');
            const user = await zcconfig.get('mail.auth.user');
            const pass = await zcconfig.get('mail.auth.pass');
            const fromAddress = await zcconfig.get('mail.from_address');

            const senderAddress = resolveSenderAddress(fromAddress, user);
            if (!host || !port || !user || !pass || !senderAddress) {
                await job.log('ERROR: Missing required email configuration');
                throw new Error('Missing required email configuration');
            }

            const secureCandidates = resolveSecureCandidates(secure, port);
            let lastError = null;

            for (let index = 0; index < secureCandidates.length; index += 1) {
                const secureFlag = secureCandidates[index];
                await job.log(`Connecting to SMTP ${host}:${port} (secure: ${secureFlag})`);

                const transporter = createTransport({
                    host,
                    port: Number(port),
                    secure: secureFlag,
                    auth: { user, pass },
                    tls: { rejectUnauthorized: false },
                    ...SMTP_TIMEOUTS,
                });

                try {
                    const payload = { ...decodedMailOptions };
                    const fromDisplayName = resolveFromDisplayName(payload);
                    const fromHeader = buildFromHeader(fromDisplayName, senderAddress);

                    delete payload.senderName;
                    const envelope = { ...(payload.envelope || {}) };
                    if (extractAddress(envelope.from) !== senderAddress) {
                        envelope.from = senderAddress;
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
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    if (!isRetryableConnectionError(error) || index === secureCandidates.length - 1) {
                        break;
                    }
                    await job.log(`SMTP connection failed with secure=${secureFlag}, retrying alternate mode`);
                }
            }

            if (lastError) {
                throw lastError;
            }

            await job.log(`Email sent successfully to ${to}`);
            return { to, subject, sentAt: new Date().toISOString() };
        },
        {
            connection,
            concurrency,
            limiter: {
                max: 10,
                duration: 60000,
            },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[email-worker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[email-worker] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        logger.error('[email-worker] Worker error:', err.message);
    });

    logger.info(`[email-worker] Email worker started (concurrency: ${concurrency})`);
    return worker;
}

function getEmailWorker() {
    return worker;
}

export { createEmailWorker, getEmailWorker };
