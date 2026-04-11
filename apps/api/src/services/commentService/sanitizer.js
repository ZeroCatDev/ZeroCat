/**
 * 评论输入消毒 (defense-in-depth)
 *
 * 注意：真正的 Markdown → HTML 渲染及 XSS 消毒在 markdown.js 的输出管线中完成。
 * 本模块仅在写入数据库前做一次轻量清洗，剥离明显的恶意 HTML 标签，
 * 同时保留 Markdown 源文本不被破坏。
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * 使用 DOMPurify 消毒评论原始输入
 * 与 Waline 保持一致的禁止标签/属性
 * @param {string} html - 原始输入
 * @returns {string} 消毒后文本
 */
export function sanitizeComment(html) {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        FORBID_TAGS: ['form', 'input', 'style', 'script', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['autoplay', 'style', 'onerror', 'onload', 'onclick'],
    });
}

export default { sanitizeComment };
