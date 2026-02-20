import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
    'a', 'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'del', 'sup', 'sub', 'span', 'div',
];

const ALLOWED_ATTR = [
    'href', 'src', 'alt', 'title', 'class', 'target', 'rel',
    'width', 'height',
];

/**
 * 使用 DOMPurify 消毒评论 HTML
 * @param {string} html - 原始 HTML
 * @returns {string} 消毒后的 HTML
 */
export function sanitizeComment(html) {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
    });
}

export default { sanitizeComment };
