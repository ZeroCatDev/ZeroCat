import twitterText from 'twitter-text';

export const getPostContentLimit = () => {
  const rawLimit = import.meta?.env?.VITE_POST_CONTENT_LIMIT;
  const parsed = Number(rawLimit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 280;
};

export const getLocalCountInfo = (content) => {
  const text = content == null ? '' : String(content);
  const limit = getPostContentLimit();
  const info = twitterText.parseTweet(text);
  const weightedLength = info.weightedLength;
  return {
    ...info,
    limit,
    count: weightedLength,
    remaining: limit - weightedLength
  };
};

const tryNormalizeHttpUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const extractFirstHttpUrl = (content) => {
  const text = content == null ? '' : String(content);
  if (!text.trim()) return null;

  const extracted = twitterText.extractUrls(text) || [];
  for (const raw of extracted) {
    const direct = tryNormalizeHttpUrl(raw);
    if (direct) return direct;

    const withProtocol = tryNormalizeHttpUrl(`https://${raw}`);
    if (withProtocol) return withProtocol;
  }

  return null;
};

/**
 * 发布前格式化内容：
 * - 去除首尾空白
 * - 合并连续空行为最多两个换行
 * - 使用 parseTweet 做最终校验，超限则截断到有效范围
 */
export const formatPostContent = (content) => {
  let text = content == null ? '' : String(content);

  text = text.trim();
  text = text.replace(/\n{3,}/g, '\n\n');

  const info = twitterText.parseTweet(text);
  if (!info.valid && info.validRangeEnd > 0) {
    text = [...text].slice(0, info.validRangeEnd + 1).join('');
  }

  return text;
};
