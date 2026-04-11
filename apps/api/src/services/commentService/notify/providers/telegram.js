import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

const TG_API = 'https://api.telegram.org';

/**
 * MarkdownV2 转义：正文中的特殊字符
 * https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMdV2(text) {
    if (!text) return '';
    return String(text).replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * MarkdownV2 转义：``` 代码块和 ` 行内代码内部仅需转义 ` 和 \
 */
function escapeMdV2Pre(text) {
    if (!text) return '';
    return String(text).replace(/[`\\]/g, '\\$&');
}

function isAbsoluteUrl(url) {
    return /^https?:\/\//.test(url);
}

/**
 * Telegram Bot 通知 Provider（MarkdownV2 + Inline Keyboard）
 */
export default {
    name: 'telegram',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyTelegram === 'true' && !!(spaceConfig.tgBotToken && spaceConfig.tgChatId);
    },

    async send(type, context, spaceConfig) {
        const { tgBotToken, tgChatId, tgTemplate } = spaceConfig;
        const { self, site } = context;

        const text = tgTemplate
            ? renderTemplate(tgTemplate, context)
            : [
                `💬 *${escapeMdV2(site.name)}* 有新评论啦`,
                '',
                `*${escapeMdV2(self.nick)}* 回复说:`,
                '',
                '```',
                escapeMdV2Pre(self.comment || '(empty)'),
                '```',
                `_邮箱_: \`${escapeMdV2Pre(self.mail)}\``,
                `_审核_: ${escapeMdV2(self.status)}`,
            ].join('\n');

        // inline keyboard 要求绝对 URL，相对路径会导致 400
        const buttons = [];
        if (isAbsoluteUrl(site.postUrl)) {
            buttons.push({ text: '💬 查看完整内容', url: site.postUrl });
        }
        if (isAbsoluteUrl(site.manageUrl)) {
            buttons.push({ text: '⚙️ 管理面板', url: site.manageUrl });
        }

        const payload = {
            chat_id: tgChatId,
            text,
            parse_mode: 'MarkdownV2',
        };
        if (buttons.length > 0) {
            payload.reply_markup = { inline_keyboard: [buttons] };
        }

        try {
            await axios.post(
                `${TG_API}/bot${tgBotToken}/sendMessage`,
                payload,
                { timeout: 10000 },
            );

            return { success: true };
        } catch (err) {
            const detail = err.response?.data?.description || err.message;
            logger.error('[notify:telegram] Send failed: ' + detail);
            return { success: false, error: detail };
        }
    },
};
