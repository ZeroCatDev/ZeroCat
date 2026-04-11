/**
 * Markdown 渲染 + XSS 消毒管线
 * 模仿 @waline/vercel 的 markdown 处理逻辑:
 *   markdown-it (breaks, linkify, typographer, html)
 *   + emoji / sub / sup 插件
 *   + PrismJS 代码高亮
 *   → DOMPurify 消毒 (FORBID_TAGS, FORBID_ATTR, link 安全 hook)
 */

import MarkdownIt from 'markdown-it';
import { full as emojiPlugin } from 'markdown-it-emoji';
import { sub as subPlugin } from '@mdit/plugin-sub';
import { sup as supPlugin } from '@mdit/plugin-sup';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';
import DOMPurify from 'isomorphic-dompurify';

// ── PrismJS 高亮 ──────────────────────────────────────────────

loadLanguages.silent = true;

function resolveHighlighter(language) {
    if (!language) return null;
    try {
        if (!Prism.languages[language]) {
            loadLanguages([language]);
        }
    } catch {
        // ignore unknown language
    }
    if (!Prism.languages[language]) return null;
    return (code) => Prism.highlight(code, Prism.languages[language], language);
}

// ── markdown-it 实例 ──────────────────────────────────────────

const md = MarkdownIt({
    breaks: true,
    linkify: true,
    typographer: true,
    highlight(code, lang) {
        const highlighter = resolveHighlighter(lang);
        return highlighter ? highlighter(code) : '';
    },
    // 必须开启 html，emoji 插件会产生 HTML 实体
    html: true,
});

// 插件
md.use(emojiPlugin);
md.use(subPlugin);
md.use(supPlugin);

// ── DOMPurify 消毒 ────────────────────────────────────────────

/**
 * afterSanitizeAttributes hook (与 Waline 一致):
 * - 外部链接设置 target=_blank / rel=nofollow noreferrer noopener
 * - 媒体 preload 强制设为 none
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node) {
        const href = node.getAttribute('href') || '';
        if (href && !href.startsWith('about:blank#')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'nofollow noreferrer noopener');
        }
    }
    if (
        !node.hasAttribute('target') &&
        (node.hasAttribute('xlink:href') || node.hasAttribute('href'))
    ) {
        node.setAttribute('xlink:show', 'new');
    }
    if ('preload' in node) {
        node.setAttribute('preload', 'none');
    }
});

function sanitize(html) {
    return DOMPurify.sanitize(html, {
        FORBID_TAGS: ['form', 'input', 'style'],
        FORBID_ATTR: ['autoplay', 'style'],
    });
}

// ── 对外接口 ──────────────────────────────────────────────────

/**
 * 将 Markdown 文本渲染为已消毒的 HTML
 * @param {string} content - 原始 Markdown 文本
 * @returns {string} 消毒后的 HTML
 */
export function renderMarkdown(content) {
    if (!content) return '';
    return sanitize(md.render(content));
}

export default renderMarkdown;
