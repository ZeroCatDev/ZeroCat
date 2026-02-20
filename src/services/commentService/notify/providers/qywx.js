import axios from 'axios';
import { renderTemplate } from '../templateRenderer.js';
import logger from '../../../logger.js';

/**
 * 企业微信应用消息 Provider
 * 通过企业微信 API 发送应用消息
 */
export default {
    name: 'qywx',

    isConfigured(spaceConfig) {
        return spaceConfig.notifyQywx === 'true' && !!spaceConfig.qywxAm;
    },

    async send(type, context, spaceConfig) {
        const { qywxAm, wxTemplate, qywxProxy, qywxProxyPort } = spaceConfig;
        const { self, site } = context;

        // qywxAm 格式: corpId,corpSecret,agentId,toUser
        const parts = qywxAm.split(',');
        if (parts.length < 4) {
            return { success: false, error: 'Invalid qywxAm format (need corpId,corpSecret,agentId,toUser)' };
        }

        const [corpId, corpSecret, agentId, toUser] = parts;

        try {
            // 获取 access_token
            const baseUrl = qywxProxy
                ? `http://${qywxProxy}${qywxProxyPort ? ':' + qywxProxyPort : ''}`
                : 'https://qyapi.weixin.qq.com';

            const tokenRes = await axios.get(
                `${baseUrl}/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`,
                { timeout: 10000 },
            );

            if (tokenRes.data.errcode !== 0) {
                return { success: false, error: `Token error: ${tokenRes.data.errmsg}` };
            }

            const accessToken = tokenRes.data.access_token;

            const content = wxTemplate
                ? renderTemplate(wxTemplate, context)
                : [
                    `💬 ${site.name} 有新评论啦`,
                    '',
                    `${self.nick} 评论道:`,
                    self.comment,
                    `邮箱: ${self.mail}`,
                    `状态: ${self.status}`,
                    '',
                    `查看详情: ${site.postUrl}`,
                ].join('\n');

            await axios.post(
                `${baseUrl}/cgi-bin/message/send?access_token=${accessToken}`,
                {
                    touser: toUser,
                    msgtype: 'text',
                    agentid: parseInt(agentId),
                    text: { content },
                },
                { timeout: 10000 },
            );

            return { success: true };
        } catch (err) {
            logger.error('[notify:qywx] Send failed:'+ err.message);
            return { success: false, error: err.message };
        }
    },
};
