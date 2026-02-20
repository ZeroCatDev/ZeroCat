import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

/**
 * QQ (Qmsg酱) 通知 Provider
 * 文档: https://qmsg.zendee.cn/
 */
export default {
    name: 'qq',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyQq === 'true' && !!(spaceConfig.qmsgKey && spaceConfig.qqId);
    },

    async send(type, context, spaceConfig) {
        const { qmsgKey, qqId, qmsgHost, qqTemplate } = spaceConfig;
        const { self, site } = context;

        const host = qmsgHost || 'https://qmsg.zendee.cn';

        const msg = qqTemplate
            ? renderTemplate(qqTemplate, context)
            : [
                `💬 ${site.name} 有新评论啦`,
                '',
                `${self.nick} 评论道:`,
                self.comment,
                `邮箱: ${self.mail}`,
                `状态: ${self.status}`,
                '',
                '仅供评论预览，查看完整內容:',
                site.postUrl,
            ].join('\n');

        try {
            await axios.post(
                `${host}/send/${qmsgKey}`,
                `msg=${encodeURIComponent(msg)}&qq=${qqId}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000,
                },
            );

            return { success: true };
        } catch (err) {
            logger.error('[notify:qq] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
