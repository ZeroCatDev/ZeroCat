import nunjucks from 'nunjucks';

// 配置 Nunjucks 环境（不使用文件系统，仅渲染字符串模板）
const env = new nunjucks.Environment(null, {
    autoescape: false,
    throwOnUndefined: false,
});

/**
 * HTML 转义用户生成内容
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 截断过长的内容
 */
export function truncate(str, len = 300) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

/**
 * 渲染 Nunjucks 模板字符串
 * @param {string} templateStr - Nunjucks 模板字符串
 * @param {object} context - { self, parent, site } 上下文
 * @returns {string} 渲染后的字符串
 */
export function renderTemplate(templateStr, context) {
    if (!templateStr) return '';
    return env.renderString(templateStr, context);
}

/**
 * 从 HTML 中提取纯文本
 */
export function extractPlainText(html, maxLen = 200) {
    if (!html) return '';
    const text = String(html)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return truncate(text, maxLen);
}
