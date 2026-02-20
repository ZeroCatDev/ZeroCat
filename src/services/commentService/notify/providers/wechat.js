import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

const SC_API = 'https://sctapi.ftqq.com';

/**
 * 微信 Server酱 通知 Provider
 * 文档: https://sct.ftqq.com/
 */
export default {
    name: 'wechat',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyWechat === 'true' && !!spaceConfig.scKey;
    },

    async send(type, context, spaceConfig) {
        const { scKey, scTemplate } = spaceConfig;
        const { self, site } = context;

        const title = `${site.name} 有新评论啦`;
        const desp = scTemplate
            ? renderTemplate(scTemplate, context)
            : [
                `${site.name} 有新评论啦`,
                `【评论者昵称】：${self.nick}`,
                `【评论者邮箱】：${self.mail}`,
                `【内容】：${self.comment}`,
                `【地址】：${site.postUrl}`,
            ].join('\n');

        try {
            await axios.post(`${SC_API}/${scKey}.send`, {
                title: title.substring(0, 32),
                desp,
            }, { timeout: 10000 });

            return { success: true };
        } catch (err) {
            logger.error('[notify:wechat] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
