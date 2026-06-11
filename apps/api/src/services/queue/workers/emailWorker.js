import { Worker } from 'bullmq';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import { sendMail, getMailProvider } from '../../email/emailSender.js';
import { createTransport } from 'nodemailer';
import zcconfig from '../../config/zcconfig.js';
import logger from '../../logger.js';

let worker = null;

async function createEmailWorker() {
    const concurrency = await zcconfig.get('bullmq.email.concurrency') || 3;
    const connection = await createConnection('worker-email');

    worker = new Worker(
        QUEUE_NAMES.EMAIL,
        async (job) => {
            const { to, subject, html } = job.data;
            await job.log(`Processing email to ${to}, subject: "${subject}"`);

            const provider = await getMailProvider();
            await job.log(`Using mail provider: ${provider}`);

            if (provider === 'amail') {
                const result = await sendMail({ to, subject, html });
                await job.log(`Amail email sent, id: ${result?.id}`);
                return { to, subject, sentAt: new Date().toISOString(), provider: 'amail', id: result?.id };
            }

            // SMTP 模式
            const host = await zcconfig.get('mail.host');
            const port = await zcconfig.get('mail.port');
            const secure = await zcconfig.get('mail.secure');
            const user = await zcconfig.get('mail.auth.user');
            const pass = await zcconfig.get('mail.auth.pass');
            const fromName = await zcconfig.get('mail.from_name');
            const fromAddress = await zcconfig.get('mail.from_address');

            if (!host || !port || !user || !pass) {
                await job.log('ERROR: Missing required SMTP configuration');
                throw new Error('Missing required SMTP configuration');
            }

            await job.log(`Connecting to SMTP ${host}:${port} (secure: ${secure})`);

            const transporter = createTransport({
                host,
                port,
                secure,
                auth: { user, pass },
            });

            const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

            await transporter.sendMail({ from, to, subject, html });

            await job.log(`Email sent successfully to ${to}`);
            return { to, subject, sentAt: new Date().toISOString(), provider: 'smtp' };
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
