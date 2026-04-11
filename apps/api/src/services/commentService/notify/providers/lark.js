import crypto from 'crypto';
import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

/**
 * 飞书 Webhook 通知 Provider
 * 支持可选的签名验证
 */
export default {
    name: 'lark',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyLark === 'true' && !!spaceConfig.larkWebhook;
    },

    async send(type, context, spaceConfig) {
        const { larkWebhook, larkSecret, larkTemplate } = spaceConfig;
        const { self, site } = context;

        try {
            const body = {};

            // 签名
            if (larkSecret) {
                const timestamp = Math.floor(Date.now() / 1000);
                const stringToSign = `${timestamp}\n${larkSecret}`;
                const sign = crypto
                    .createHmac('sha256', stringToSign)
                    .update('')
                    .digest('base64');
                body.timestamp = String(timestamp);
                body.sign = sign;
            }

            if (larkTemplate) {
                // 自定义模板 — 作为富文本 post 消息
                const content = renderTemplate(larkTemplate, context);
                body.msg_type = 'text';
                body.content = { text: content };
            } else {
                // 默认富文本卡片
                body.msg_type = 'interactive';
                body.card = {
                    header: {
                        title: { tag: 'plain_text', content: `💬 ${site.name} 有新评论啦` },
                        template: 'blue',
                    },
                    elements: [
                        {
                            tag: 'div',
                            text: {
                                tag: 'lark_md',
                                content: `**${self.nick}** 评论道：\n${self.comment}\n\n邮箱: ${self.mail}\n状态: ${self.status}`,
                            },
                        },
                        {
                            tag: 'action',
                            actions: [{
                                tag: 'button',
                                text: { tag: 'plain_text', content: '查看完整内容' },
                                url: site.postUrl,
                                type: 'primary',
                            }],
                        },
                    ],
                };
            }

            await axios.post(larkWebhook, body, { timeout: 10000 });
            return { success: true };
        } catch (err) {
            logger.error('[notify:lark] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
