import { createTransport } from 'nodemailer';
import zcconfig from '../../../config/zcconfig.js';
import emailTemplateService from '../../../email/emailTemplateService.js';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

/**
 * 邮件通知 Provider
 * 支持空间自定义 SMTP 或全局 SMTP 回退
 */
export default {
    name: 'email',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyEmailAdmin === 'true' || spaceConfig.notifyEmailReply === 'true';
    },

    async send(type, context, spaceConfig) {
        // 按通知类型检查对应开关
        if (type === 'admin_new_comment' && spaceConfig.notifyEmailAdmin !== 'true') {
            return { success: false, error: 'notifyEmailAdmin disabled' };
        }
        if (type === 'reply_notification' && spaceConfig.notifyEmailReply !== 'true') {
            return { success: false, error: 'notifyEmailReply disabled' };
        }

        const mailCtx = await createTransporterForSpace(spaceConfig);
        if (!mailCtx) {
            return { success: false, error: 'no_transport' };
        }

        try {
            if (type === 'admin_new_comment') {
                return await sendAdminMail(context, spaceConfig, mailCtx);
            } else if (type === 'reply_notification') {
                return await sendReplyMail(context, spaceConfig, mailCtx);
            }
            return { success: false, error: 'unknown_type' };
        } catch (err) {
            logger.error('[notify:email] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};

/**
 * 为空间创建 SMTP transporter
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
 * 发送管理员通知邮件
 */
async function sendAdminMail(context, spaceConfig, mailCtx) {
    const { self, site } = context;
    const adminEmail = context._adminEmail;
    if (!adminEmail) return { success: false, error: 'no_admin_email' };

    const isWaiting = self.status === 'waiting';

    // 自定义模板
    if (spaceConfig.mailTemplateAdmin) {
        const subject = spaceConfig.mailSubjectAdmin
            ? renderTemplate(spaceConfig.mailSubjectAdmin, context)
            : `${self.nick} 在 ${site.spaceName} 发表了新评论`;
        const html = renderTemplate(spaceConfig.mailTemplateAdmin, context);
        await mailCtx.transporter.sendMail({ from: mailCtx.from, to: adminEmail, subject, html });
        return { success: true, to: adminEmail };
    }

    // 默认 EJS 模板
    const title = isWaiting ? '新评论待审核' : '新评论通知';
    const subject = isWaiting
        ? `[待审核] ${self.nick} 在 ${site.spaceName} 发表了评论`
        : `${self.nick} 在 ${site.spaceName} 发表了新评论`;

    const buttons = [];
    if (isWaiting) {
        buttons.push({ text: '前往审核', url: site.manageUrl, style: '' });
    } else {
        buttons.push({ text: '查看评论', url: site.postUrl, style: '' });
        buttons.push({ text: '管理面板', url: site.manageUrl, style: 'secondary' });
    }

    const rendered = await emailTemplateService.renderTemplate('comment_notification', {
        title,
        subject,
        spaceName: site.spaceName,
        nick: self.nick,
        pageUrl: self.url,
        time: self.insertedAt,
        commentHtml: self.commentHtml,
        buttons,
    });

    await mailCtx.transporter.sendMail({ from: mailCtx.from, to: adminEmail, subject: rendered.subject, html: rendered.html });
    return { success: true, to: adminEmail };
}

/**
 * 发送回复通知邮件
 */
async function sendReplyMail(context, spaceConfig, mailCtx) {
    const { self, parent, site } = context;
    if (!parent?.mail) return { success: false, error: 'no_parent_email' };

    // 自定义模板
    if (spaceConfig.mailTemplate) {
        const subject = spaceConfig.mailSubject
            ? renderTemplate(spaceConfig.mailSubject, context)
            : `${self.nick} 回复了您在 ${site.spaceName} 的评论`;
        const html = renderTemplate(spaceConfig.mailTemplate, context);
        await mailCtx.transporter.sendMail({ from: mailCtx.from, to: parent.mail, subject, html });
        return { success: true, to: parent.mail };
    }

    // 默认 EJS 模板
    const rendered = await emailTemplateService.renderTemplate('comment_notification', {
        title: '您的评论收到了回复',
        subject: `${self.nick} 回复了您在 ${site.spaceName} 的评论`,
        spaceName: site.spaceName,
        nick: self.nick,
        pageUrl: self.url,
        time: self.insertedAt,
        commentHtml: self.commentHtml,
        parentNick: parent.nick,
        parentHtml: parent.commentHtml,
        link: site.postUrl,
    });

    await mailCtx.transporter.sendMail({ from: mailCtx.from, to: parent.mail, subject: rendered.subject, html: rendered.html });
    return { success: true, to: parent.mail };
}
