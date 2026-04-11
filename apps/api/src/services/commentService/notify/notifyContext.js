import { prisma } from '../../prisma.js';
import zcconfig from '../../config/zcconfig.js';
import { escapeHtml, truncate, extractPlainText } from './templateRenderer.js';

/**
 * 构建标准化通知上下文
 * @param {object} comment - 当前评论
 * @param {object|null} parent - 父评论（回复时）
 * @param {object} spaceConfig - 空间配置
 * @param {string} spaceCuid - 空间 CUID
 * @returns {{ self, parent, site }}
 */
export async function buildContext(comment, parent, spaceConfig, spaceCuid) {
    const frontendUrl = await zcconfig.get('urls.frontend') || '';
    const siteName = await zcconfig.get('site.name') || 'ZeroCat';

    const space = await prisma.ow_comment_spaces.findUnique({
        where: { cuid: spaceCuid },
        select: { name: true },
    });
    const spaceName = space?.name || spaceCuid;

    const self = {
        nick: comment.nick || 'Anonymous',
        mail: comment.mail || '',
        link: comment.link || '',
        url: comment.url || '',
        comment: extractPlainText(comment.comment, 500),
        commentHtml: escapeHtml(truncate(comment.comment, 500)),
        commentRaw: truncate(comment.comment, 500),
        commentText: extractPlainText(comment.comment, 300),
        commentLink: `${frontendUrl}${comment.url || '/'}`,
        status: comment.status,
        ip: comment.ip || '',
        insertedAt: comment.insertedAt ? new Date(comment.insertedAt).toLocaleString('zh-CN') : '',
    };

    const parentCtx = parent ? {
        nick: parent.nick || 'Anonymous',
        mail: parent.mail || '',
        link: parent.link || '',
        comment: extractPlainText(parent.comment, 200),
        commentHtml: escapeHtml(truncate(parent.comment, 200)),
        commentRaw: truncate(parent.comment, 200),
        commentText: extractPlainText(parent.comment, 200),
    } : null;

    const site = {
        name: siteName,
        url: frontendUrl,
        spaceName,
        spaceCuid,
        postUrl: `${frontendUrl}${comment.url || '/'}`,
        manageUrl: `${frontendUrl}/app/commentservice/manage/${spaceCuid}`,
    };

    return { self, parent: parentCtx, site };
}

/**
 * 获取空间管理员通知邮箱
 */
export async function getAdminEmail(spaceConfig, spaceCuid) {
    if (spaceConfig.authorEmail) return spaceConfig.authorEmail;

    const space = await prisma.ow_comment_spaces.findUnique({ where: { cuid: spaceCuid } });
    if (!space) return null;

    const owner = await prisma.ow_users.findUnique({
        where: { id: space.owner_id },
        select: { email: true },
    });
    return owner?.email || null;
}
