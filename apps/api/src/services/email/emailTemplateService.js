import React from 'react';
import { render } from '@react-email/render';
import logger from '../logger.js';
import zcconfig from '../config/zcconfig.js';
import templateRegistry from '../../emails/index.js';

class EmailTemplateService {
    /**
     * 获取站点配置信息
     */
    async getSiteConfig() {
        const siteName = await zcconfig.get("site.name") || 'ZeroCat';
        const siteDomain = await zcconfig.get("site.domain") || 'zerocat.top';
        const siteEmail = await zcconfig.get("site.email") || 'support@zerocat.top';
        const frontendUrl = await zcconfig.get("urls.frontend") || `https://${siteDomain}`;

        return {
            siteName,
            siteDomain,
            siteEmail,
            frontendUrl,
            year: new Date().getFullYear()
        };
    }

    /**
     * 处理链接URL，自动补充协议或前端URL
     */
    async processLink(link, isRawLink = false) {
        if (!link) return null;

        // 如果是原始链接模式且不包含协议
        if (isRawLink && !link.startsWith('http://') && !link.startsWith('https://')) {
            const siteConfig = await this.getSiteConfig();
            return `${siteConfig.frontendUrl}${link.startsWith('/') ? '' : '/'}${link}`;
        }

        // 如果没有协议，默认添加https://
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
            return `https://${link}`;
        }

        return link;
    }

    /**
     * 渲染邮件模板
     */
    async renderTemplate(templateName, data) {
        try {
            const siteConfig = await this.getSiteConfig();
            const templateData = {
                ...siteConfig,
                ...data,
                loginUrl: `${siteConfig.frontendUrl}/login`,
            };

            // 从注册表中获取React组件
            const Component = templateRegistry[templateName];
            if (!Component) {
                throw new Error(`未知的邮件模板: ${templateName}`);
            }

            // 使用React Email渲染
            const element = React.createElement(Component, templateData);
            const html = await render(element);

            // 改进的文本提取，更好地处理HTML标签和空白字符
            const text = html
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 移除style标签及其内容
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 移除script标签及其内容
                .replace(/<[^>]*>/g, '') // 移除所有HTML标签
                .replace(/\s+/g, ' ') // 合并多个空白字符为单个空格
                .replace(/\n\s*\n/g, '\n') // 移除多余的空行
                .trim();

            return {
                subject: data.subject || templateData.title || '通知',
                html,
                text
            };
        } catch (error) {
            logger.error(`渲染邮件模板失败 ${templateName}:`, error);
            throw error;
        }
    }

    /**
     * 从HTML中提取纯文本内容（用于通知内容）
     */
    extractPlainText(html) {
        return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 移除style标签及其内容
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 移除script标签及其内容
            .replace(/<[^>]*>/g, '') // 移除所有HTML标签
            .replace(/\s+/g, ' ') // 合并多个空白字符为单个空格
            .replace(/\n\s*\n/g, '\n') // 移除多余的空行
            .trim()
            .substring(0, 200) + '...'; // 截取前200字符
    }
}

// 创建单例实例
const emailTemplateService = new EmailTemplateService();

export default emailTemplateService;

// 导出核心方法
export const {
    renderTemplate,
    getSiteConfig,
    processLink,
    extractPlainText
} = emailTemplateService;
