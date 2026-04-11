import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

const PUSHPLUS_API = 'http://www.pushplus.plus/send';

/**
 * PushPlus 通知 Provider
 * 文档: https://www.pushplus.plus/
 */
export default {
    name: 'pushplus',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyPushplus === 'true' && !!spaceConfig.pushPlusKey;
    },

    async send(type, context, spaceConfig) {
        const {
            pushPlusKey,
            pushPlusTopic,
            pushPlusChannel,
            pushPlusTemplate: tpl,
            pushPlusWebhook,
            pushPlusCallbackUrl,
        } = spaceConfig;
        const { self, site } = context;

        const title = `${site.name} 有新评论啦`;
        const content = tpl
            ? renderTemplate(tpl, context)
            : [
                `<h3>💬 ${site.name} 有新评论啦</h3>`,
                `<p><b>${self.nick}</b> 评论道：</p>`,
                `<blockquote>${self.commentHtml}</blockquote>`,
                `<p>邮箱: ${self.mail}<br>状态: ${self.status}</p>`,
                `<p><a href="${site.postUrl}">查看完整内容</a></p>`,
            ].join('\n');

        const body = {
            token: pushPlusKey,
            title: title.substring(0, 40),
            content,
            template: 'html',
        };

        if (pushPlusTopic) body.topic = pushPlusTopic;
        if (pushPlusChannel) body.channel = pushPlusChannel;
        if (pushPlusWebhook) body.webhook = pushPlusWebhook;
        if (pushPlusCallbackUrl) body.callbackUrl = pushPlusCallbackUrl;

        try {
            await axios.post(PUSHPLUS_API, body, { timeout: 10000 });
            return { success: true };
        } catch (err) {
            logger.error('[notify:pushplus] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
