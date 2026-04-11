import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

/**
 * Discord Webhook 通知 Provider
 */
export default {
    name: 'discord',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyDiscord === 'true' && !!spaceConfig.discordWebhook;
    },

    async send(type, context, spaceConfig) {
        const { discordWebhook, discordTemplate } = spaceConfig;
        const { self, site } = context;

        try {
            if (discordTemplate) {
                // 自定义模板 — 作为纯文本 content 发送
                const content = renderTemplate(discordTemplate, context);
                await axios.post(discordWebhook, { content }, { timeout: 10000 });
            } else {
                // 默认 Embed 格式
                await axios.post(discordWebhook, {
                    embeds: [{
                        title: `💬 ${site.name} 有新评论啦`,
                        description: `**${self.nick}** 评论道:\n\n${self.comment}\n\n邮箱: ${self.mail}\n状态: ${self.status}`,
                        url: site.postUrl,
                        color: 5814783,
                        author: { name: self.nick },
                        fields: [
                            { name: '空间', value: site.spaceName, inline: true },
                            { name: '状态', value: self.status, inline: true },
                        ],
                        footer: { text: self.insertedAt },
                    }],
                }, { timeout: 10000 });
            }

            return { success: true };
        } catch (err) {
            logger.error('[notify:discord] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
