import { Worker } from 'bullmq';
import { createTransport } from 'nodemailer';
import { createConnection } from '../redisConnectionFactory.js';
import { QUEUE_NAMES } from '../queues.js';
import { prisma } from '../../prisma.js';
import zcconfig from '../../config/zcconfig.js';
import { getSpaceConfig } from '../../commentService/spaceManager.js';
import emailTemplateService from '../../email/emailTemplateService.js';
import logger from '../../logger.js';

let worker = null;

// ── helpers ──

/**
 * HTML-escape 用户生成内容，防止邮件模板注入
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 截断过长的内容
 */
function truncate(str, len = 300) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

/**
 * 为空间创建 SMTP transporter
 * 自定义 SMTP → 使用空间的 senderName/senderEmail
 * 回退全局   → 使用全局 mail.from_*
 */
async function createTransporterForSpace(spaceConfig) {
    // 空间自定义 SMTP
    if (spaceConfig.smtpHost && spaceConfig.smtpUser && spaceConfig.smtpPass) {
        const port = parseInt(spaceConfig.smtpPort) || 587;
        const secure = spaceConfig.smtpSecure === 'true';
        const opts = {
            host: spaceConfig.smtpHost,
            port,
            secure,
            auth: { user: spaceConfig.smtpUser, pass: spaceConfig.smtpPass },
        };
        if (spaceConfig.smtpService) opts.service = spaceConfig.smtpService;
        return {
            transporter: createTransport(opts),
            from: spaceConfig.senderName
                ? `${spaceConfig.senderName} <${spaceConfig.senderEmail || spaceConfig.smtpUser}>`
                : (spaceConfig.senderEmail || spaceConfig.smtpUser),
        };
    }

    // 全局 SMTP
    const host = await zcconfig.get('mail.host');
    const port = await zcconfig.get('mail.port');
    const secure = await zcconfig.get('mail.secure');
    const user = await zcconfig.get('mail.auth.user');
    const pass = await zcconfig.get('mail.auth.pass');
    const fromName = await zcconfig.get('mail.from_name');
    const fromAddress = await zcconfig.get('mail.from_address');

    if (!host || !user || !pass) return null;

    return {
        transporter: createTransport({ host, port, secure, auth: { user, pass } }),
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
    };
}

/**
 * 获取空间管理员通知邮箱
 * authorEmail → 空间所有者邮箱
 */
async function getAdminEmail(spaceConfig, spaceCuid) {
    if (spaceConfig.authorEmail) return spaceConfig.authorEmail;

    const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid: spaceCuid } });
    if (!space) return null;

    const owner = await prisma.ow_users.findUnique({
        where: { id: space.owner_id },
        select: { email: true },
    });
    return owner?.email || null;
}

/**
 * 获取空间名称
 */
async function getSpaceName(spaceCuid) {
    const space = await prisma.ow_comment_spaces.findUnique({
        where: { cuid: spaceCuid },
        select: { name: true },
    });
    return space?.name || spaceCuid;
}

/**
 * 发送邮件（统一出口，便于日志/错误处理）
 */
async function sendMail(transporter, from, to, subject, html, job) {
    await transporter.sendMail({ from, to, subject, html });
    await job.log(`Mail sent to ${to}`);
}

// ── 通知类型处理器 ──

/**
 * 管理员新评论通知
 * 包括 approved 和 waiting（待审核）评论
 */
async function handleAdminNotify(comment, spaceConfig, spaceCuid, mailCtx, job) {
    const toEmail = await getAdminEmail(spaceConfig, spaceCuid);
    if (!toEmail) {
        await job.log('No admin email, skipping');
        return { skipped: true, reason: 'no_admin_email' };
    }

    const frontendUrl = await zcconfig.get('urls.frontend') || '';
    const spaceName = await getSpaceName(spaceCuid);
    const nick = comment.nick || 'Anonymous';
    const isWaiting = comment.status === 'waiting';

    const title = isWaiting ? '新评论待审核' : '新评论通知';
    const subject = isWaiting
        ? `[待审核] ${nick} 在 ${spaceName} 发表了评论`
        : `${nick} 在 ${spaceName} 发表了新评论`;

    const buttons = [];
    if (isWaiting) {
        buttons.push({ text: '前往审核', url: `${frontendUrl}/app/commentservice/manage/${spaceCuid}`, style: '' });
    } else {
        buttons.push({ text: '查看评论', url: `${frontendUrl}${comment.url || '/'}`, style: '' });
        buttons.push({ text: '管理面板', url: `${frontendUrl}/app/commentservice/manage/${spaceCuid}`, style: 'secondary' });
    }

    const rendered = await emailTemplateService.renderTemplate('comment_notification', {
        title,
        subject,
        spaceName,
        nick,
        pageUrl: comment.url || '',
        time: comment.insertedAt ? new Date(comment.insertedAt).toLocaleString('zh-CN') : '',
        commentHtml: escapeHtml(truncate(comment.comment, 500)),
        buttons,
    });

    await sendMail(mailCtx.transporter, mailCtx.from, toEmail, rendered.subject, rendered.html, job);
    return { sent: true, to: toEmail };
}

/**
 * 回复通知（通知父评论作者）
 */
async function handleReplyNotify(comment, spaceConfig, spaceCuid, mailCtx, job) {
    if (spaceConfig.disableAuthorNotify === 'true') {
        await job.log('Author notify disabled');
        return { skipped: true, reason: 'notify_disabled' };
    }

    // 仅 approved 评论触发回复通知
    if (comment.status !== 'approved') {
        await job.log(`Comment status is '${comment.status}', skip reply notify`);
        return { skipped: true, reason: 'not_approved' };
    }

    if (!comment.pid) {
        await job.log('No parent comment');
        return { skipped: true, reason: 'no_parent' };
    }

    const parent = await prisma.ow_comment_service.findUnique({
        where: { id: parseInt(comment.pid) },
    });
    if (!parent || !parent.mail) {
        await job.log('Parent has no email');
        return { skipped: true, reason: 'no_parent_email' };
    }

    // 自回复跳过
    if (comment.user_id && parent.user_id && comment.user_id === parent.user_id) {
        await job.log('Self-reply (same user_id)');
        return { skipped: true, reason: 'self_reply' };
    }
    if (comment.mail && parent.mail && comment.mail === parent.mail) {
        await job.log('Self-reply (same mail)');
        return { skipped: true, reason: 'self_reply' };
    }

    const frontendUrl = await zcconfig.get('urls.frontend') || '';
    const spaceName = await getSpaceName(spaceCuid);
    const nick = comment.nick || 'Anonymous';
    const parentNick = parent.nick || 'Anonymous';

    const rendered = await emailTemplateService.renderTemplate('comment_notification', {
        title: '您的评论收到了回复',
        subject: `${nick} 回复了您在 ${spaceName} 的评论`,
        spaceName,
        nick,
        pageUrl: comment.url || '',
        time: comment.insertedAt ? new Date(comment.insertedAt).toLocaleString('zh-CN') : '',
        commentHtml: escapeHtml(truncate(comment.comment, 500)),
        parentNick,
        parentHtml: escapeHtml(truncate(parent.comment, 200)),
        link: `${frontendUrl}${comment.url || '/'}`,
    });

    await sendMail(mailCtx.transporter, mailCtx.from, parent.mail, rendered.subject, rendered.html, job);
    return { sent: true, to: parent.mail };
}

// ── Worker 主处理函数 ──

async function processNotification(job) {
    const { type, commentId, spaceCuid } = job.data;
    await job.log(`Processing ${type} for comment #${commentId} in ${spaceCuid}`);

    const comment = await prisma.ow_comment_service.findUnique({ where: { id: commentId } });
    if (!comment) {
        await job.log('Comment not found');
        return { skipped: true, reason: 'comment_not_found' };
    }

    // 被删除或标记为 spam 的评论不发通知
    if (comment.status === 'spam') {
        await job.log('Comment is spam, skip');
        return { skipped: true, reason: 'spam' };
    }

    const spaceConfig = await getSpaceConfig(spaceCuid);
    const mailCtx = await createTransporterForSpace(spaceConfig);
    if (!mailCtx) {
        await job.log('No mail transport available');
        return { skipped: true, reason: 'no_transport' };
    }

    switch (type) {
        case 'admin_new_comment':
            return handleAdminNotify(comment, spaceConfig, spaceCuid, mailCtx, job);
        case 'reply_notification':
            return handleReplyNotify(comment, spaceConfig, spaceCuid, mailCtx, job);
        default:
            await job.log(`Unknown type: ${type}`);
            return { skipped: true, reason: 'unknown_type' };
    }
}

async function createCommentNotificationWorker() {
    const connection = await createConnection('worker-comment-notification');

    worker = new Worker(
        QUEUE_NAMES.COMMENT_NOTIFICATION,
        processNotification,
        {
            connection,
            concurrency: 2,
            limiter: { max: 10, duration: 60000 },
        }
    );

    worker.on('completed', (job) => {
        logger.debug(`[comment-notify] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger.error(`[comment-notify] Job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        logger.error('[comment-notify] Worker error:', err.message);
    });

    logger.info('[comment-notify] Comment notification worker started');
    return worker;
}

function getCommentNotificationWorker() {
    return worker;
}

export { createCommentNotificationWorker, getCommentNotificationWorker };
