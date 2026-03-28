import { prisma } from "../services/prisma.js";
import twitterText from "twitter-text";
import { createNotification } from "./notifications.js";
import zcconfig from "../services/config/zcconfig.js";
import logger from "../services/logger.js";
import queueManager from "../services/queue/queueManager.js";
import gorseService from "../services/gorse.js";
import * as embeddingService from "../services/embedding.js";
import { getAnalytics } from "../services/analytics.js";
import { getPostUrlPreview } from "../services/postPreview.js";

const POST_CHAR_LIMIT = 280;
const MAX_MEDIA_COUNT = 4;

// 预初始化的静态URL（模块加载时初始化）
let staticUrl = null;

async function initStaticUrl() {
  if (staticUrl === null) {
    const rawUrl = await zcconfig.get("s3.staticurl");
    // 使用URL解析处理首末斜杠问题
    const url = new URL(rawUrl);
    staticUrl = url.origin + url.pathname.replace(/\/+$/, "");
  }
  return staticUrl;
}

function buildMediaUrl(md5, extension) {
  if (!staticUrl || !md5) return null;
  const prefix1 = md5.substring(0, 2);
  const prefix2 = md5.substring(2, 4);
  return `${staticUrl}/assets/${prefix1}/${prefix2}/${md5}.${extension}`;
}

function dedupeMediaIds(mediaIds) {
  // 去重并保持顺序
  return [...new Set(mediaIds.map((id) => Number(id)))];
}

const EMBED_TYPES = ["project", "list", "user", "url","article"];

function validateEmbed(embed) {
  if (!embed) return null;
  if (typeof embed !== "object" || Array.isArray(embed)) return null;
  if (!embed.type || !EMBED_TYPES.includes(embed.type)) {
    throw new Error("不支持的嵌入类型");
  }

  // 如果是url类型，验证url字段存在且有效
  if (embed.type === "url") {
    if (!embed.url || typeof embed.url !== "string") {
      throw new Error("url类型嵌入必须包含有效的url字段");
    }
    // 验证URL格式
    try {
      new URL(embed.url);
    } catch (e) {
      throw new Error("无效的URL格式");
    }
  }

  return embed;
}

function countPostCharacters(content = "") {
  if (!content) return 0;
  return twitterText.parseTweet(content).weightedLength;
}

function analyzePostContent(content = "") {
  const tweet = twitterText.parseTweet(content || "");
  logger.debug(tweet);
  return {
    characterCount: tweet.weightedLength,
    valid: tweet.valid,
  };
}

function extractMentionUsernames(content = "") {
  if (!content) return [];
  const usernames = new Set();
  const regex = /@([a-zA-Z0-9_]{1,20})/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    usernames.add(match[1]);
  }
  return [...usernames];
}

async function resolveMentionedUsers(content, authorId) {
  const usernames = extractMentionUsernames(content);
  if (usernames.length === 0) return [];

  const users = await prisma.ow_users.findMany({
    where: {
      username: { in: usernames },
    },
    select: {
      id: true,
      username: true,
      display_name: true,
    },
  });

  return users.filter((user) => user.id !== authorId);
}

function buildLeanSelect() {
  return {
    id: true,
    author_id: true,
    post_type: true,
    content: true,
    in_reply_to_id: true,
    thread_root_id: true,
    quoted_post_id: true,
    retweet_post_id: true,
    reply_count: true,
    retweet_count: true,
    like_count: true,
    bookmark_count: true,
    is_deleted: true,
    embed: true,
    platform_refs: true,
    created_at: true,
    embedding_at: true,
    author: {
      select: { id: true, username: true, display_name: true, avatar: true },
    },
    post_media: {
      select: {
        id: true,
        order: true,
        asset: { select: { id: true, md5: true, extension: true, mime_type: true } },
      },
    },
    mentions: {
      select: {
        user: { select: { id: true, username: true } },
      },
    },
  };
}

/**
 * 格式化平台同步引用信息
 * 返回帖子在各平台的同步状态（Twitter、Bluesky、ActivityPub）
 */
function formatPlatformRefs(refs) {
  if (!refs || typeof refs !== 'object') return null;

  const result = {};
  let hasAny = false;

  if (refs.twitter) {
    result.twitter = {
      id: refs.twitter.id || null,
      url: refs.twitter.id ? `https://x.com/i/status/${refs.twitter.id}` : null,
      kind: refs.twitter.kind || null,
    };
    hasAny = true;
  }

  if (refs.bluesky) {
    result.bluesky = {
      uri: refs.bluesky.uri || null,
      cid: refs.bluesky.cid || null,
      kind: refs.bluesky.kind || null,
    };
    hasAny = true;
  }

  if (refs.activitypub) {
    result.activitypub = {
      id: refs.activitypub.id || null,
      url: refs.activitypub.url || null,
    };
    hasAny = true;
  }

  return hasAny ? result : null;
}

function formatPost(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    type: raw.post_type,
    content: raw.is_deleted ? null : raw.content,
    created_at: raw.created_at,
    is_deleted: raw.is_deleted,
    author: raw.author,
    stats: {
      replies: raw.reply_count,
      retweets: raw.retweet_count,
      likes: raw.like_count,
      bookmarks: raw.bookmark_count,
      views: 0,
    },
    reply_to_id: raw.in_reply_to_id,
    quote_of_id: raw.quoted_post_id,
    retweet_of_id: raw.retweet_post_id,
    thread_id: raw.thread_root_id,
    media: (raw.post_media || [])
      .map((m) => {
        if (!m.asset?.id) return null;
        const extension = m.asset.extension || m.asset.mime_type?.split("/")[1] || "webp";
        return {
          id: m.asset.id,
          url: buildMediaUrl(m.asset.md5, extension),
          mime_type: m.asset.mime_type,
          order: m.order,
        };
      })
      .filter(Boolean),
    mentions: (raw.mentions || [])
      .map((m) => ({
        id: m.user?.id,
        username: m.user?.username,
      }))
      .filter((m) => m.id),
    embed: raw.is_deleted ? null : raw.embed || null,
    embedding_at: raw.embedding_at || null,
    platform_refs: raw.is_deleted ? null : formatPlatformRefs(raw.platform_refs),
  };
}

async function getPostViewCountMap(postIds) {
  const normalizedIds = [...new Set((postIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (normalizedIds.length === 0) return new Map();

  const rows = await prisma.ow_analytics_event.groupBy({
    by: ["target_id"],
    where: {
      target_type: "post",
      target_id: { in: normalizedIds },
    },
    _count: { _all: true },
  });

  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.target_id), Number(row._count?._all || 0));
  }
  return map;
}

async function attachPostViewCounts(posts) {
  if (!posts || posts.length === 0) return posts || [];

  const viewMap = await getPostViewCountMap(posts.map((p) => p.id));
  return posts.map((post) => {
    const viewCount = viewMap.get(Number(post.id)) || 0;
    return {
      ...post,
      stats: {
        ...(post.stats || {}),
        views: viewCount,
      },
    };
  });
}

function collectReferencedIds(posts) {
  const ids = new Set();
  for (const p of posts) {
    if (p.reply_to_id) ids.add(p.reply_to_id);
    if (p.quote_of_id) ids.add(p.quote_of_id);
    if (p.retweet_of_id) ids.add(p.retweet_of_id);
  }
  const postIds = new Set(posts.map((p) => p.id));
  for (const id of ids) {
    if (postIds.has(id)) ids.delete(id);
  }
  return [...ids];
}

async function fetchReferencedPosts(ids) {
  if (ids.length === 0) return {};
  const raws = await prisma.ow_posts.findMany({
    where: { id: { in: ids } },
    select: buildLeanSelect(),
  });

  const formatted = raws.map(formatPost);
  const enriched = await attachPostViewCounts(formatted);

  const map = {};
  for (const post of enriched) {
    map[post.id] = post;
  }
  return map;
}

async function addViewerContext(posts, viewerId) {
  if (!viewerId || posts.length === 0) {
    return posts.map((p) => ({ ...p, viewer_context: null }));
  }

  const postIds = posts.map((p) => p.id);

  const [likes, bookmarks, retweets] = await Promise.all([
    prisma.ow_posts_like.findMany({
      where: { user_id: viewerId, post_id: { in: postIds } },
      select: { post_id: true },
    }),
    prisma.ow_posts_bookmark.findMany({
      where: { user_id: viewerId, post_id: { in: postIds } },
      select: { post_id: true },
    }),
    prisma.ow_posts.findMany({
      where: {
        author_id: viewerId,
        retweet_post_id: { in: postIds },
        is_deleted: false,
        post_type: "retweet",
      },
      select: { retweet_post_id: true },
    }),
  ]);

  const likedIds = new Set(likes.map((l) => l.post_id));
  const bookmarkedIds = new Set(bookmarks.map((b) => b.post_id));
  const retweetedIds = new Set(retweets.map((r) => r.retweet_post_id));

  return posts.map((p) => ({
    ...p,
    viewer_context: {
      liked: likedIds.has(p.id),
      bookmarked: bookmarkedIds.has(p.id),
      retweeted: retweetedIds.has(p.id),
    },
  }));
}

async function buildListResponse(rawPosts, limit, viewerId = null) {
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, viewerId);
  posts = await attachPostViewCounts(posts);

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);

  if (viewerId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = rawPosts.length === Number(limit);
  const nextCursor =
    rawPosts.length > 0
      ? rawPosts[rawPosts.length - 1].created_at.toISOString()
      : null;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

function buildEmbedSubsetClauses(value, path = []) {
  const field = path.length > 0 ? `embed.${path.join(".")}` : "embed";

  if (value === undefined) return [];

  if (value === null || Array.isArray(value)) {
    if (path.length === 0) {
      throw new Error("embeddata 必须是对象");
    }

    return [{
      embed: {
        path,
        equals: value,
      },
    }];
  }

  if (typeof value === "object") {
    const clauses = [];

    for (const [rawKey, childValue] of Object.entries(value)) {
      const key = typeof rawKey === "string" ? rawKey.trim() : "";
      if (!key) {
        throw new Error("embeddata 字段名不能为空");
      }

      clauses.push(...buildEmbedSubsetClauses(childValue, [...path, key]));
    }

    return clauses;
  }

  if (typeof value === "string") {
    if (!value.trim()) {
      throw new Error(`${field} 不能为空字符串`);
    }

    return [{
      embed: {
        path,
        equals: value,
      },
    }];
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} 必须是有限数字`);
    }

    return [{
      embed: {
        path,
        equals: value,
      },
    }];
  }

  if (typeof value === "boolean") {
    return [{
      embed: {
        path,
        equals: value,
      },
    }];
  }

  throw new Error(`${field} 类型不支持`);
}

function normalizePositiveInt(value, fallback, max = 100) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === "") return null;
  const parsed = Number(cursor);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("cursor 必须是正整数");
  }
  return parsed;
}
async function notifyMentions(mentionedUsers, actorId, postId) {
  await Promise.all(
    mentionedUsers.map((user) =>
      createNotification({
        notificationType: "post_mention",
        title: "推文提及",
        content: "有人在推文中提到了你",
        userId: user.id,
        actorId,
        targetType: "post",
        targetId: postId,
        data: {
          post_id: postId,
          mentioned_user: user.username,
        },
      })
    )
  );

  const userIds = mentionedUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.ow_posts_mention.updateMany({
      where: {
        post_id: postId,
        user_id: { in: userIds },
      },
      data: {
        notified: true,
      },
    });
  }
}

export async function createPost({ authorId, content, mediaIds = [], embed }) {
  // 确保静态URL已初始化
  await initStaticUrl();

  // 去重 mediaIds
  const uniqueMediaIds = dedupeMediaIds(mediaIds);

  const { characterCount, valid } = analyzePostContent(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (!valid) {
    throw new Error("内容超过字数限制");
  }

  if (uniqueMediaIds.length > MAX_MEDIA_COUNT) {
    throw new Error(`最多只能上传${MAX_MEDIA_COUNT}张图片`);
  }

  const validatedEmbed = validateEmbed(embed);
  const mentionedUsers = await resolveMentionedUsers(content, authorId);
  const mentionedUserIds = mentionedUsers.map((user) => user.id);

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.ow_posts.create({
      data: {
        author_id: authorId,
        post_type: "normal",
        content,
        character_count: characterCount,
        ...(validatedEmbed ? { embed: validatedEmbed } : {}),
      },
      select: buildLeanSelect(),
    });

    if (uniqueMediaIds.length > 0) {
      await Promise.all(
        uniqueMediaIds.map((assetId, index) =>
          tx.ow_posts_media.create({
            data: {
              post_id: created.id,
              asset_id: assetId,
              order: index,
            },
          })
        )
      );
    }

    if (mentionedUserIds.length > 0) {
      await tx.ow_posts_mention.createMany({
        data: mentionedUserIds.map((userId) => ({
          post_id: created.id,
          user_id: userId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  if (mentionedUsers.length > 0) {
    await notifyMentions(mentionedUsers, authorId, post.id);
  }

  queueManager.enqueueSocialPostSync(authorId, post.id, "create").catch((error) => {
    logger.warn("推文社交同步入队失败(create):", error.message);
  });

  // 同步帖子到 Gorse 推荐系统
  gorseService.upsertPost(post).catch(e => logger.debug('[gorse] createPost upsert failed:', e.message));

  // 异步生成帖子向量
  queueManager.enqueuePostEmbedding(post.id).catch(e => logger.debug('[embedding] createPost enqueue failed:', e.message));

  // 异步刷新作者用户向量（帖子变化影响用户画像）
  queueManager.enqueueUserEmbedding(authorId, false, 'post_create').catch(e => logger.debug('[embedding] createPost user enqueue failed:', e.message));

  const formattedPost = formatPost(post);
  const [postWithViews] = await attachPostViewCounts([formattedPost]);
  return {
    post: postWithViews,
    includes: { posts: {} },
  };
}

export async function replyToPost({
  authorId,
  content,
  mediaIds = [],
  replyToId,
  embed,
}) {
  // 确保静态URL已初始化
  await initStaticUrl();

  // 去重 mediaIds
  const uniqueMediaIds = dedupeMediaIds(mediaIds);

  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(replyToId), is_deleted: false },
    select: { id: true, author_id: true, thread_root_id: true },
  });
  if (!target) {
    throw new Error("目标推文不存在");
  }

  const { characterCount, valid } = analyzePostContent(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (!valid) {
    throw new Error("内容超过字数限制");
  }
  if (uniqueMediaIds.length > MAX_MEDIA_COUNT) {
    throw new Error(`最多只能上传${MAX_MEDIA_COUNT}张图片`);
  }

  const validatedEmbed = validateEmbed(embed);
  const threadRootId = target.thread_root_id || target.id;
  const mentionedUsers = await resolveMentionedUsers(content, authorId);
  const mentionedUserIds = mentionedUsers.map((user) => user.id);

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.ow_posts.create({
      data: {
        author_id: authorId,
        post_type: "reply",
        content,
        character_count: characterCount,
        in_reply_to_id: target.id,
        thread_root_id: threadRootId,
        ...(validatedEmbed ? { embed: validatedEmbed } : {}),
      },
      select: buildLeanSelect(),
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { reply_count: { increment: 1 } },
    });

    if (uniqueMediaIds.length > 0) {
      await Promise.all(
        uniqueMediaIds.map((assetId, index) =>
          tx.ow_posts_media.create({
            data: {
              post_id: created.id,
              asset_id: assetId,
              order: index,
            },
          })
        )
      );
    }

    if (mentionedUserIds.length > 0) {
      await tx.ow_posts_mention.createMany({
        data: mentionedUserIds.map((userId) => ({
          post_id: created.id,
          user_id: userId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  if (target.author_id && target.author_id !== authorId) {
    await createNotification({
      notificationType: "post_reply",
      title: "推文回复",
      content: "有人回复了你的推文",
      userId: target.author_id,
      actorId: authorId,
      targetType: "post",
      targetId: target.id,
      data: { post_id: post.id },
    });
  }

  if (mentionedUsers.length > 0) {
    await notifyMentions(mentionedUsers, authorId, post.id);
  }

  queueManager.enqueueSocialPostSync(authorId, post.id, "reply").catch((error) => {
    logger.warn("推文社交同步入队失败(reply):", error.message);
  });

  // Gorse 反馈：回复 + 同步新帖子
  gorseService.feedbackPostReply(authorId, target.id).catch(e => logger.debug('[gorse] reply feedback failed:', e.message));
  gorseService.upsertPost(post).catch(e => logger.debug('[gorse] reply upsert failed:', e.message));

  // 异步生成回复帖子向量
  queueManager.enqueuePostEmbedding(post.id).catch(e => logger.debug('[embedding] reply enqueue failed:', e.message));
  queueManager.enqueueUserEmbedding(authorId, false, 'post_reply').catch(e => logger.debug('[embedding] reply user enqueue failed:', e.message));

  const formattedPost = formatPost(post);
  const [postWithViews] = await attachPostViewCounts([formattedPost]);
  const refIds = collectReferencedIds([postWithViews]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: postWithViews,
    includes: { posts: referencedPosts },
  };
}

export async function retweetPost({ authorId, retweetPostId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(retweetPostId), is_deleted: false },
    select: { id: true, author_id: true, post_type: true, retweet_post_id: true, content: true, embed: true },
  });
  if (!target) {
    throw new Error("目标推文不存在");
  }

  // 如果目标本身就是转推，自动追溯到原始推文
  let originalId = target.id;
  let originalAuthorId = target.author_id;
  // 默认使用目标帖子自身内容（目标是原始帖的情况）
  let originalContent = target.content;
  let originalEmbed = target.embed;
  if (target.post_type === "retweet" && target.retweet_post_id) {
    const original = await prisma.ow_posts.findFirst({
      where: { id: target.retweet_post_id, is_deleted: false },
      select: { id: true, author_id: true, content: true, embed: true },
    });
    if (!original) {
      throw new Error("原始推文不存在");
    }
    originalId = original.id;
    originalAuthorId = original.author_id;
    originalContent = original.content;
    originalEmbed = original.embed;
  }

  // 检查是否已经转推过该原始推文
  const existing = await prisma.ow_posts.findFirst({
    where: {
      author_id: authorId,
      retweet_post_id: originalId,
      post_type: "retweet",
      is_deleted: false,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("你已经转推过该推文");
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.ow_posts.create({
      data: {
        author_id: authorId,
        post_type: "retweet",
        retweet_post_id: originalId,
        content: null,
        character_count: 0,
      },
      select: buildLeanSelect(),
    });

    await tx.ow_posts.update({
      where: { id: originalId },
      data: { retweet_count: { increment: 1 } },
    });

    return created;
  });

  if (originalAuthorId && originalAuthorId !== authorId) {
    await createNotification({
      notificationType: "post_retweet",
      title: "推文转推",
      content: "有人转推了你的推文",
      userId: originalAuthorId,
      actorId: authorId,
      targetType: "post",
      targetId: originalId,
      data: { post_id: post.id },
    });
  }

  queueManager.enqueueSocialPostSync(authorId, post.id, "retweet").catch((error) => {
    logger.warn("推文社交同步入队失败(retweet):", error.message);
  });

  // Gorse 反馈：转推 + 推送转推帖子（使用原帖内容作为 Comment，以便语义检索）
  gorseService.feedbackPostRetweet(authorId, originalId).catch(e => logger.debug('[gorse] retweet feedback failed:', e.message));
  gorseService.upsertPost({
    ...post,
    content: originalContent,   // 填充原帖文字，转推本身 content 为 null
    embed: originalEmbed,
  }).catch(e => logger.debug('[gorse] retweet upsert failed:', e.message));

  // 纯转推不生成向量，但刷新作者用户向量
  queueManager.enqueueUserEmbedding(authorId, false, 'post_retweet').catch(e => logger.debug('[embedding] retweet user enqueue failed:', e.message));

  const formattedPost = formatPost(post);
  const [postWithViews] = await attachPostViewCounts([formattedPost]);
  const refIds = collectReferencedIds([postWithViews]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: postWithViews,
    includes: { posts: referencedPosts },
  };
}

export async function unretweetPost({ authorId, retweetPostId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(retweetPostId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("目标推文不存在");

  const result = await prisma.$transaction(async (tx) => {
    const retweet = await tx.ow_posts.findFirst({
      where: {
        author_id: authorId,
        retweet_post_id: target.id,
        post_type: "retweet",
        is_deleted: false,
      },
      select: { id: true },
    });

    if (!retweet) {
      return { count: 0, retweetId: null };
    }

    await tx.ow_posts.update({
      where: { id: retweet.id },
      data: { is_deleted: true },
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { retweet_count: { decrement: 1 } },
    });

    return { count: 1, retweetId: retweet.id };
  });

  if (result.count > 0 && result.retweetId) {
    queueManager.enqueueSocialPostSync(authorId, result.retweetId, "unretweet").catch((error) => {
      logger.warn("推文社交同步入队失败(unretweet):", error.message);
    });
    queueManager.enqueueUserEmbedding(authorId, false, 'post_unretweet').catch(e => logger.debug('[embedding] unretweet user enqueue failed:', e.message));
  }

  return result;
}

export async function quotePost({
  authorId,
  quotedPostId,
  content,
  mediaIds = [],
  embed,
}) {
  // 确保静态URL已初始化
  await initStaticUrl();

  // 去重 mediaIds
  const uniqueMediaIds = dedupeMediaIds(mediaIds);

  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(quotedPostId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!target) {
    throw new Error("目标推文不存在");
  }

  const { characterCount, valid } = analyzePostContent(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (!valid) {
    throw new Error("内容超过字数限制");
  }
  if (uniqueMediaIds.length > MAX_MEDIA_COUNT) {
    throw new Error(`最多只能上传${MAX_MEDIA_COUNT}张图片`);
  }

  const validatedEmbed = validateEmbed(embed);
  const mentionedUsers = await resolveMentionedUsers(content, authorId);
  const mentionedUserIds = mentionedUsers.map((user) => user.id);

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.ow_posts.create({
      data: {
        author_id: authorId,
        post_type: "quote",
        content,
        character_count: characterCount,
        quoted_post_id: target.id,
        ...(validatedEmbed ? { embed: validatedEmbed } : {}),
      },
      select: buildLeanSelect(),
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { retweet_count: { increment: 1 } },
    });

    if (uniqueMediaIds.length > 0) {
      await Promise.all(
        uniqueMediaIds.map((assetId, index) =>
          tx.ow_posts_media.create({
            data: {
              post_id: created.id,
              asset_id: assetId,
              order: index,
            },
          })
        )
      );
    }

    if (mentionedUserIds.length > 0) {
      await tx.ow_posts_mention.createMany({
        data: mentionedUserIds.map((userId) => ({
          post_id: created.id,
          user_id: userId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  if (target.author_id && target.author_id !== authorId) {
    await createNotification({
      notificationType: "post_quote",
      title: "推文引用",
      content: "有人引用了你的推文",
      userId: target.author_id,
      actorId: authorId,
      targetType: "post",
      targetId: target.id,
      data: { post_id: post.id },
    });
  }

  if (mentionedUsers.length > 0) {
    await notifyMentions(mentionedUsers, authorId, post.id);
  }

  queueManager.enqueueSocialPostSync(authorId, post.id, "quote").catch((error) => {
    logger.warn("推文社交同步入队失败(quote):", error.message);
  });

  // Gorse 反馈：引用 + 同步新帖子
  gorseService.feedbackPostQuote(authorId, target.id).catch(e => logger.debug('[gorse] quote feedback failed:', e.message));
  gorseService.upsertPost(post).catch(e => logger.debug('[gorse] quote upsert failed:', e.message));

  // 异步生成引用帖子向量
  queueManager.enqueuePostEmbedding(post.id).catch(e => logger.debug('[embedding] quote enqueue failed:', e.message));
  queueManager.enqueueUserEmbedding(authorId, false, 'post_quote').catch(e => logger.debug('[embedding] quote user enqueue failed:', e.message));

  const formattedPost = formatPost(post);
  const [postWithViews] = await attachPostViewCounts([formattedPost]);
  const refIds = collectReferencedIds([postWithViews]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: postWithViews,
    includes: { posts: referencedPosts },
  };
}

export async function likePost({ userId, postId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!target) throw new Error("目标推文不存在");

  const like = await prisma.$transaction(async (tx) => {
    const existing = await tx.ow_posts_like.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: target.id } },
    });
    if (existing) return existing;

    const created = await tx.ow_posts_like.create({
      data: {
        user_id: userId,
        post_id: target.id,
      },
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { like_count: { increment: 1 } },
    });

    return created;
  });

  if (target.author_id && target.author_id !== userId) {
    await createNotification({
      notificationType: "post_like",
      title: "推文点赞",
      content: "有人点赞了你的推文",
      userId: target.author_id,
      actorId: userId,
      targetType: "post",
      targetId: target.id,
      data: { post_id: target.id },
    });
  }

  queueManager.enqueueSocialPostSync(userId, target.id, "like").catch((error) => {
    logger.warn("推文社交同步入队失败(like):", error.message);
  });

  // Gorse 反馈：点赞
  gorseService.feedbackPostLike(userId, target.id).catch(e => logger.debug('[gorse] like feedback failed:', e.message));

  // 点赞影响用户画像，刷新用户向量
  queueManager.enqueueUserEmbedding(userId, false, 'post_like').catch(e => logger.debug('[embedding] like user enqueue failed:', e.message));

  return like;
}

export async function unlikePost({ userId, postId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("目标推文不存在");

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.ow_posts_like.deleteMany({
      where: { user_id: userId, post_id: target.id },
    });

    if (deleted.count > 0) {
      await tx.ow_posts.update({
        where: { id: target.id },
        data: { like_count: { decrement: 1 } },
      });
    }

    return deleted;
  });

  if (result.count > 0) {
    queueManager.enqueueSocialPostSync(userId, target.id, "unlike").catch((error) => {
      logger.warn("推文社交同步入队失败(unlike):", error.message);
    });
    // Gorse 反馈：取消点赞
    gorseService.feedbackPostUnlike(userId, target.id).catch(e => logger.debug('[gorse] unlike feedback failed:', e.message));
    queueManager.enqueueUserEmbedding(userId, false, 'post_unlike').catch(e => logger.debug('[embedding] unlike user enqueue failed:', e.message));
  }

  return result;
}

export async function bookmarkPost({ userId, postId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("目标推文不存在");

  const bookmark = await prisma.$transaction(async (tx) => {
    const existing = await tx.ow_posts_bookmark.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: target.id } },
    });
    if (existing) return existing;

    const created = await tx.ow_posts_bookmark.create({
      data: {
        user_id: userId,
        post_id: target.id,
      },
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { bookmark_count: { increment: 1 } },
    });

    return created;
  });

  queueManager.enqueueSocialPostSync(userId, target.id, "bookmark").catch((error) => {
    logger.warn("推文社交同步入队失败(bookmark):", error.message);
  });

  // Gorse 反馈：收藏
  gorseService.feedbackPostBookmark(userId, target.id).catch(e => logger.debug('[gorse] bookmark feedback failed:', e.message));

  // 收藏影响用户画像，刷新用户向量
  queueManager.enqueueUserEmbedding(userId, false, 'post_bookmark').catch(e => logger.debug('[embedding] bookmark user enqueue failed:', e.message));

  return bookmark;
}

export async function unbookmarkPost({ userId, postId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("目标推文不存在");

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.ow_posts_bookmark.deleteMany({
      where: { user_id: userId, post_id: target.id },
    });

    if (deleted.count > 0) {
      await tx.ow_posts.update({
        where: { id: target.id },
        data: { bookmark_count: { decrement: 1 } },
      });
    }

    return deleted;
  });

  if (result.count > 0) {
    queueManager.enqueueSocialPostSync(userId, target.id, "unbookmark").catch((error) => {
      logger.warn("推文社交同步入队失败(unbookmark):", error.message);
    });
    // Gorse 反馈：取消收藏
    gorseService.feedbackPostUnbookmark(userId, target.id).catch(e => logger.debug('[gorse] unbookmark feedback failed:', e.message));
    queueManager.enqueueUserEmbedding(userId, false, 'post_unbookmark').catch(e => logger.debug('[embedding] unbookmark user enqueue failed:', e.message));
  }

  return result;
}

/**
 * 标记帖子为已读（上报 Gorse read 反馈）
 * 登录用户：记录个人阅读反馈，用于个性化推荐去重
 * 未登录用户：直接忽略，不做任何操作
 */
export async function markPostRead({ userId, postId }) {
  if (!userId) return { acknowledged: false, reason: 'not_logged_in' };

  // 异步上报 Gorse，不阻塞响应
  gorseService.feedbackPostRead(userId, postId).catch(e =>
    logger.debug('[gorse] markPostRead feedback failed:', e.message)
  );

  return { acknowledged: true };
}

export async function deletePost({ userId, postId }) {
  const post = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!post) throw new Error("推文不存在");
  if (post.author_id !== userId) throw new Error("没有权限删除该推文");

  await prisma.ow_posts.update({
    where: { id: post.id },
    data: { is_deleted: true },
  });

  queueManager.enqueueSocialPostSync(userId, post.id, "delete").catch((error) => {
    logger.warn("推文社交同步入队失败(delete):", error.message);
  });

  // Gorse：隐藏已删除的帖子
  gorseService.hidePost(post.id).catch(e => logger.debug('[gorse] hidePost failed:', e.message));

  return { id: post.id, deleted: true };
}

/**
 * 获取帖子的祖先链（向上遍历到最顶级帖子）
 * @param {number} postId - 起始帖子ID
 * @param {number} maxDepth - 最大遍历深度，防止无限循环
 * @returns {Promise<Array>} 祖先帖子列表，从最顶级到直接父贴的顺序
 */
async function getAncestorChain(postId, maxDepth = 50) {
  const ancestors = [];
  const visited = new Set();
  let currentId = Number(postId);

  while (currentId && ancestors.length < maxDepth) {
    // 循环依赖检测
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const post = await prisma.ow_posts.findFirst({
      where: { id: currentId, is_deleted: false },
      select: buildLeanSelect(),
    });

    if (!post) break;

    // 如果没有父帖，说明已经到顶级
    if (!post.in_reply_to_id) {
      // 将顶级帖子加入祖先链
      ancestors.push(post);
      break;
    }

    ancestors.push(post);
    currentId = post.in_reply_to_id;
  }

  // 反转数组，使其从最顶级到当前帖子的父贴
  return ancestors.reverse();
}

/**
 * 获取作者点赞的回复ID列表
 * @param {number} postId - 帖子ID
 * @param {number} authorId - 作者ID
 * @returns {Promise<Set<number>>} 作者点赞的回复ID集合
 */
async function getAuthorLikedReplyIds(postId, authorId) {
  const likes = await prisma.ow_posts_like.findMany({
    where: {
      user_id: authorId,
      post: {
        in_reply_to_id: postId,
        is_deleted: false,
      },
    },
    select: { post_id: true },
  });
  return new Set(likes.map((l) => l.post_id));
}

/**
 * 获取帖子的直接回复，并分类为精选和普通回复
 * @param {number} postId - 帖子ID
 * @param {number} authorId - 原帖作者ID
 * @param {number} postLikeCount - 原帖的点赞数
 * @param {number} viewerId - 查看者ID
 * @returns {Promise<{featured: Array, regular: Array}>} 分类后的回复
 */
async function getRepliesWithClassification(postId, authorId, postLikeCount, viewerId = null) {
  // 获取所有直接回复
  const directReplies = await prisma.ow_posts.findMany({
    where: {
      in_reply_to_id: Number(postId),
      is_deleted: false,
    },
    orderBy: [{ like_count: "desc" }, { created_at: "asc" }],
    select: buildLeanSelect(),
  });

  if (directReplies.length === 0) {
    return { featured: [], regular: [] };
  }

  // 获取作者点赞的回复ID
  const authorLikedIds = await getAuthorLikedReplyIds(postId, authorId);

  // 格式化回复并添加viewer context
  let formattedReplies = directReplies.map(formatPost);
  formattedReplies = await addViewerContext(formattedReplies, viewerId);

  // 分类回复
  const featured = [];
  const regular = [];

  for (let i = 0; i < directReplies.length; i++) {
    const raw = directReplies[i];
    const formatted = formattedReplies[i];

    const isAuthorLiked = authorLikedIds.has(raw.id);
    const hasHighLikes = raw.like_count > postLikeCount;

    if (isAuthorLiked || hasHighLikes) {
      featured.push({
        ...formatted,
        featured_reason: isAuthorLiked
          ? hasHighLikes
            ? "author_liked_and_high_likes"
            : "author_liked"
          : "high_likes",
      });
    } else {
      regular.push(formatted);
    }
  }

  return { featured, regular };
}

export async function getPostById(postId, viewerId = null) {
  await initStaticUrl();
  const raw = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: buildLeanSelect(),
  });
  if (!raw) return null;

  let post = formatPost(raw);
  const [enriched] = await addViewerContext([post], viewerId);
  post = enriched;
  [post] = await attachPostViewCounts([post]);

  // 获取祖先链（如果是回复帖子）
  let ancestors = [];
  if (raw.in_reply_to_id) {
    const ancestorRaws = await getAncestorChain(raw.in_reply_to_id);
    // 排除当前帖子本身（如果意外出现）
    const filteredAncestors = ancestorRaws.filter((a) => a.id !== raw.id);
    ancestors = filteredAncestors.map(formatPost);
    ancestors = await addViewerContext(ancestors, viewerId);
    ancestors = await attachPostViewCounts(ancestors);
  }

  // 获取分类后的回复
  let { featured: featuredReplies, regular: regularReplies } =
    await getRepliesWithClassification(raw.id, raw.author_id, raw.like_count, viewerId);
  featuredReplies = await attachPostViewCounts(featuredReplies);
  regularReplies = await attachPostViewCounts(regularReplies);

  // 收集所有需要引用的帖子ID
  const allPosts = [post, ...ancestors, ...featuredReplies, ...regularReplies];
  const refIds = collectReferencedIds(allPosts);

  // 排除已在响应中的帖子
  const existingIds = new Set(allPosts.map((p) => p.id));
  const filteredRefIds = refIds.filter((id) => !existingIds.has(id));

  let referencedPosts = await fetchReferencedPosts(filteredRefIds);

  if (viewerId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enrichedRefs = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enrichedRefs) {
      referencedPosts[p.id] = p;
    }
  }

  return {
    post,
    ancestors, // 祖先链，从最顶级到直接父贴
    replies: {
      featured: featuredReplies, // 精选回复（作者点赞/高赞）
      regular: regularReplies, // 普通回复
    },
    includes: { posts: referencedPosts },
  };
}

export async function getRelatedPosts({
  embedData,
  cursor,
  limit = 20,
  includeReplies = false,
  viewerId = null,
}) {
  await initStaticUrl();

  if (
    embedData === null ||
    typeof embedData !== "object" ||
    Array.isArray(embedData)
  ) {
    throw new Error("embeddata 必须是对象");
  }

  const clauses = buildEmbedSubsetClauses(embedData);
  if (clauses.length === 0) {
    throw new Error("embeddata 至少提供一个筛选条件");
  }

  const safeLimit = normalizePositiveInt(limit, 20);
  const safeCursor = normalizeCursor(cursor);

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      embed: { not: null },
      ...(includeReplies ? {} : { post_type: { not: "reply" } }),
      ...(safeCursor ? { created_at: { lt: new Date(safeCursor) } } : {}),
      AND: clauses,
    },
    orderBy: { created_at: "desc" },
    take: safeLimit,
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, safeLimit, viewerId);
}

export async function getUserPosts({
  userId,
  cursor,
  limit = 20,
  includeReplies = false,
  viewerId = null,
}) {
  await initStaticUrl();
  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      author_id: Number(userId),
      is_deleted: false,
      ...(includeReplies ? {} : { post_type: { not: "reply" } }),
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, viewerId);
}

export async function getHomeFeed({
  userId = null,
  cursor,
  limit = 20,
  includeReplies = false,
  followingOnly = false,
}) {
  await initStaticUrl();

  // 获取当前用户关注列表（用于 followingOnly 以及联邦帖子过滤）
  let followedIds = [];
  if (userId) {
    const follows = await prisma.ow_user_relationships.findMany({
      where: {
        source_user_id: Number(userId),
        relationship_type: "follow",
      },
      select: { target_user_id: true },
    });
    followedIds = follows.map((rel) => rel.target_user_id).filter(Boolean);
  }

  let authorFilter = {};
  if (followingOnly && userId) {
    const authorIds = [Number(userId), ...followedIds];
    authorFilter = { author_id: { in: authorIds } };
  }

  // 联邦社交（ActivityPub）帖子过滤规则：
  // - 未登录用户：不展示任何联邦帖子
  // - 已登录 + followingOnly：已通过 authorFilter 限定为关注列表，无需额外过滤
  // - 已登录 + 全局时间线：排除未被当前用户关注的联邦用户帖子
  let federationFilter = {};
  if (!userId) {
    // 未登录：排除所有远程用户的帖子
    federationFilter = { author: { type: { not: "remote_activitypub" } } };
  } else if (!followingOnly) {
    // 已登录 + 全局时间线：仅展示已关注的联邦用户帖子
    federationFilter = {
      NOT: {
        author: { type: "remote_activitypub" },
        author_id: { notIn: followedIds },
      },
    };
  }

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      ...(includeReplies ? {} : { post_type: { not: "reply" } }),
      ...authorFilter,
      ...federationFilter,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, userId);
}

/**
 * 全局时间线 — 展示所有帖子（含联邦社交帖），按帖子原始发布时间排序
 * 仅限已登录用户访问
 */
export async function getGlobalFeed({
  userId,
  cursor,
  limit = 20,
  includeReplies = false,
}) {
  await initStaticUrl();

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  // cursor 为 ISO 8601 时间戳字符串，用于基于 created_at 的分页
  let cursorFilter = {};
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      cursorFilter = { created_at: { lt: cursorDate } };
    }
  }

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      ...(includeReplies ? {} : { post_type: { not: "reply" } }),
      ...cursorFilter,
    },
    orderBy: { created_at: "desc" },
    take: safeLimit,
    select: buildLeanSelect(),
  });

  // 构建响应（使用 created_at 作为游标而非 id）
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, userId);
  posts = await attachPostViewCounts(posts);

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);
  if (userId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, userId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = rawPosts.length === safeLimit;
  const nextCursor =
    rawPosts.length > 0
      ? rawPosts[rawPosts.length - 1].created_at.toISOString()
      : null;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

export async function getThread(postId, { cursor, limit = 50, viewerId = null } = {}) {
  await initStaticUrl();

  // 获取请求的帖子
  const raw = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: buildLeanSelect(),
  });
  if (!raw) return null;

  let post = formatPost(raw);
  const [enrichedPost] = await addViewerContext([post], viewerId);
  post = enrichedPost;
  [post] = await attachPostViewCounts([post]);

  // 获取祖先链（如果是回复帖子）
  let ancestors = [];
  if (raw.in_reply_to_id) {
    const ancestorRaws = await getAncestorChain(raw.in_reply_to_id);
    const filteredAncestors = ancestorRaws.filter((a) => a.id !== raw.id);
    ancestors = filteredAncestors.map(formatPost);
    ancestors = await addViewerContext(ancestors, viewerId);
    ancestors = await attachPostViewCounts(ancestors);
  }

  // 确定线程根ID
  const threadRootId = raw.thread_root_id || raw.id;

  // 找到真正的根帖（用于判断精选）
  const actualRootId = ancestors.length > 0 ? ancestors[0].id : raw.id;
  const actualRootLikeCount = ancestors.length > 0
    ? (await prisma.ow_posts.findFirst({
        where: { id: actualRootId },
        select: { like_count: true, author_id: true }
      }))
    : { like_count: raw.like_count, author_id: raw.author_id };

  // 获取线程中的所有回复
  const repliesRaw = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      thread_root_id: threadRootId,
      ...(cursor ? { created_at: { gt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "asc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  let replies = repliesRaw.map(formatPost);
  replies = await addViewerContext(replies, viewerId);
  replies = await attachPostViewCounts(replies);

  // 获取根帖作者点赞的所有回复ID
  const allReplyIds = repliesRaw.map((r) => r.id);
  const rootAuthorId = actualRootLikeCount?.author_id || raw.author_id;
  const authorLikedIds = allReplyIds.length > 0
    ? new Set(
        (
          await prisma.ow_posts_like.findMany({
            where: {
              user_id: rootAuthorId,
              post_id: { in: allReplyIds },
            },
            select: { post_id: true },
          })
        ).map((l) => l.post_id)
      )
    : new Set();

  // 将回复按父帖ID分组，并分类为精选/普通
  const repliesByParent = {};
  const rootLikeCount = actualRootLikeCount?.like_count || 0;

  for (let i = 0; i < repliesRaw.length; i++) {
    const rawReply = repliesRaw[i];
    const formatted = replies[i];
    const parentId = rawReply.in_reply_to_id || threadRootId;

    if (!repliesByParent[parentId]) {
      repliesByParent[parentId] = { featured: [], regular: [] };
    }

    const isAuthorLiked = authorLikedIds.has(rawReply.id);
    const hasHighLikes = rawReply.like_count > rootLikeCount;

    if (isAuthorLiked || hasHighLikes) {
      repliesByParent[parentId].featured.push({
        ...formatted,
        featured_reason: isAuthorLiked
          ? hasHighLikes
            ? "author_liked_and_high_likes"
            : "author_liked"
          : "high_likes",
      });
    } else {
      repliesByParent[parentId].regular.push(formatted);
    }
  }

  // 收集引用的帖子
  const allPosts = [post, ...ancestors, ...replies];
  const refIds = collectReferencedIds(allPosts);
  const existingIds = new Set(allPosts.map((p) => p.id));
  const filteredRefIds = refIds.filter((id) => !existingIds.has(id));
  let referencedPosts = await fetchReferencedPosts(filteredRefIds);

  if (viewerId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enrichedRefs = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enrichedRefs) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = repliesRaw.length === Number(limit);
  const nextCursor =
    repliesRaw.length > 0
      ? repliesRaw[repliesRaw.length - 1].created_at.toISOString()
      : null;

  return {
    post,                              // 请求的帖子（始终是主体）
    ancestors,                         // 祖先链（从根帖到直接父帖）
    replies_by_parent: repliesByParent, // 按父帖分组的回复
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

export async function getMentions({ userId, cursor, limit = 20 }) {
  await initStaticUrl();
  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      mentions: {
        some: {
          user_id: Number(userId),
        },
      },
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, userId);
}

/**
 * 获取帖子的所有转推
 */
export async function getPostRetweets({ postId, cursor, limit = 20, viewerId = null }) {
  await initStaticUrl();

  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("帖子不存在");

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      retweet_post_id: target.id,
      post_type: "retweet",
      is_deleted: false,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, viewerId);
}

/**
 * 获取帖子的所有引用
 */
export async function getPostQuotes({ postId, cursor, limit = 20, viewerId = null }) {
  await initStaticUrl();

  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true },
  });
  if (!target) throw new Error("帖子不存在");

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      quoted_post_id: target.id,
      post_type: "quote",
      is_deleted: false,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, viewerId);
}

/**
 * 获取帖子的点赞用户列表（仅发帖人可见）
 */
export async function getPostLikes({ postId, cursor, limit = 20, viewerId }) {
  await initStaticUrl();

  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!target) throw new Error("帖子不存在");

  // 仅发帖人可见
  if (!viewerId || target.author_id !== Number(viewerId)) {
    throw new Error("无权查看点赞列表");
  }

  const likes = await prisma.ow_posts_like.findMany({
    where: {
      post_id: target.id,
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: Number(limit),
    select: {
      id: true,
      created_at: true,
      user: {
        select: { id: true, username: true, display_name: true, avatar: true },
      },
    },
  });

  const users = likes.map((l) => ({
    id: l.user?.id,
    username: l.user?.username,
    display_name: l.user?.display_name,
    avatar: l.user?.avatar,
    liked_at: l.created_at,
  }));

  const hasMore = likes.length === Number(limit);
  const nextCursor = likes.length > 0 ? String(likes[likes.length - 1].id) : null;

  return {
    users,
    total: await prisma.ow_posts_like.count({ where: { post_id: target.id } }),
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

/**
 * 获取帖子的互动分析（转推数、引用数、点赞数等）
 */
export async function getPostAnalytics({ postId, viewerId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: {
      id: true,
      author_id: true,
      reply_count: true,
      retweet_count: true,
      like_count: true,
      bookmark_count: true,
    },
  });
  if (!target) throw new Error("帖子不存在");

  // 仅发帖人可见详细分析
  const isAuthor = viewerId && target.author_id === Number(viewerId);

  // 获取引用数（quote类型）
  const quoteCount = await prisma.ow_posts.count({
    where: {
      quoted_post_id: target.id,
      post_type: "quote",
      is_deleted: false,
    },
  });

  // 纯转推数 = retweet_count - quote_count
  const pureRetweetCount = Math.max(0, target.retweet_count - quoteCount);

  const result = {
    post_id: target.id,
    reply_count: target.reply_count,
    retweet_count: pureRetweetCount,
    quote_count: quoteCount,
    like_count: target.like_count,
  };

  // 浏览分析（基于 ow_analytics_event）
  const [viewCount, uniqueVisitors] = await Promise.all([
    prisma.ow_analytics_event.count({
      where: {
        target_type: "post",
        target_id: target.id,
      },
    }),
    prisma.ow_analytics_event.findMany({
      where: {
        target_type: "post",
        target_id: target.id,
      },
      distinct: ["device_id"],
      select: { device_id: true },
    }),
  ]);

  result.view_count = viewCount;
  result.visitor_count = uniqueVisitors.length;
  result.engagement_count =
    target.reply_count + pureRetweetCount + quoteCount + target.like_count + target.bookmark_count;
  result.engagement_rate =
    viewCount > 0 ? Number(((result.engagement_count / viewCount) * 100).toFixed(2)) : 0;

  // 仅作者可见收藏数
  if (isAuthor) {
    result.bookmark_count = target.bookmark_count;
  }

  return result;
}

/**
 * 获取帖子浏览分析明细（基于 ow_analytics_event / ow_analytics_device）
 * 仅发帖人可查看
 */
export async function getPostViewAnalytics({ postId, viewerId, startDate, endDate }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(postId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!target) throw new Error("帖子不存在");

  if (!viewerId || target.author_id !== Number(viewerId)) {
    throw new Error("无权查看帖子浏览分析");
  }

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parsedStart = startDate ? new Date(startDate) : defaultStart;
  const parsedEnd = endDate ? new Date(endDate) : now;

  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    throw new Error("无效的日期格式");
  }

  if (parsedStart > parsedEnd) {
    throw new Error("开始时间不能晚于结束时间");
  }

  const rangeStart = new Date(parsedStart);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(parsedEnd);
  rangeEnd.setHours(23, 59, 59, 999);

  const analytics = await getAnalytics(
    "post",
    target.id,
    parsedStart.toISOString().split("T")[0],
    parsedEnd.toISOString().split("T")[0]
  );

  const [
    likes,
    bookmarks,
    replies,
    retweets,
    quotes,
  ] = await Promise.all([
    prisma.ow_posts_like.findMany({
      where: {
        post_id: target.id,
        created_at: { gte: rangeStart, lte: rangeEnd },
      },
      select: { created_at: true },
    }),
    prisma.ow_posts_bookmark.findMany({
      where: {
        post_id: target.id,
        created_at: { gte: rangeStart, lte: rangeEnd },
      },
      select: { created_at: true },
    }),
    prisma.ow_posts.findMany({
      where: {
        in_reply_to_id: target.id,
        post_type: "reply",
        is_deleted: false,
        created_at: { gte: rangeStart, lte: rangeEnd },
      },
      select: { created_at: true },
    }),
    prisma.ow_posts.findMany({
      where: {
        retweet_post_id: target.id,
        post_type: "retweet",
        is_deleted: false,
        created_at: { gte: rangeStart, lte: rangeEnd },
      },
      select: { created_at: true },
    }),
    prisma.ow_posts.findMany({
      where: {
        quoted_post_id: target.id,
        post_type: "quote",
        is_deleted: false,
        created_at: { gte: rangeStart, lte: rangeEnd },
      },
      select: { created_at: true },
    }),
  ]);

  const bucketByDay = (rows) => {
    const map = new Map();
    for (const row of rows) {
      const day = new Date(row.created_at).toISOString().slice(0, 10);
      map.set(day, (map.get(day) || 0) + 1);
    }
    return map;
  };

  const likesByDay = bucketByDay(likes);
  const bookmarksByDay = bucketByDay(bookmarks);
  const repliesByDay = bucketByDay(replies);
  const retweetsByDay = bucketByDay(retweets);
  const quotesByDay = bucketByDay(quotes);

  const allDays = new Set([
    ...likesByDay.keys(),
    ...bookmarksByDay.keys(),
    ...repliesByDay.keys(),
    ...retweetsByDay.keys(),
    ...quotesByDay.keys(),
  ]);

  const engagementSeries = [...allDays]
    .sort()
    .map((day) => {
      const likeCount = likesByDay.get(day) || 0;
      const bookmarkCount = bookmarksByDay.get(day) || 0;
      const replyCount = repliesByDay.get(day) || 0;
      const retweetCount = retweetsByDay.get(day) || 0;
      const quoteCount = quotesByDay.get(day) || 0;
      return {
        x: `${day}T00:00:00`,
        y: likeCount + bookmarkCount + replyCount + retweetCount + quoteCount,
      };
    });

  const impressions = analytics?.overview?.pageviews?.value || 0;
  const engagements =
    likes.length + bookmarks.length + replies.length + retweets.length + quotes.length;
  const engagementRate = impressions > 0
    ? Number(((engagements / impressions) * 100).toFixed(2))
    : 0;

  return {
    post_id: target.id,
    range: {
      start_date: parsedStart.toISOString().split("T")[0],
      end_date: parsedEnd.toISOString().split("T")[0],
    },
    twitter_like_overview: {
      impressions,
      detail_expands: impressions,
      engagements,
      engagement_rate: engagementRate,
      likes: likes.length,
      replies: replies.length,
      reposts: retweets.length,
      quotes: quotes.length,
      bookmarks: bookmarks.length,
    },
    engagement_breakdown: {
      likes: likes.length,
      replies: replies.length,
      reposts: retweets.length,
      quotes: quotes.length,
      bookmarks: bookmarks.length,
    },
    twitter_like_timeseries: {
      impressions: analytics?.timeseries?.pageviews || [],
      visitors: analytics?.timeseries?.sessions || [],
      engagements: engagementSeries,
    },
    ...analytics,
  };
}

/**
 * 构建带祖先链的回帖列表响应
 */
async function buildRepliesListResponse(rawPosts, limit, viewerId = null) {
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, viewerId);
  posts = await attachPostViewCounts(posts);

  // 为每个回帖获取祖先链
  const postsWithAncestors = await Promise.all(
    posts.map(async (post, index) => {
      const raw = rawPosts[index];
      let ancestors = [];

      if (raw.in_reply_to_id) {
        const ancestorRaws = await getAncestorChain(raw.in_reply_to_id);
        const filteredAncestors = ancestorRaws.filter((a) => a.id !== raw.id);
        ancestors = filteredAncestors.map(formatPost);
        ancestors = await addViewerContext(ancestors, viewerId);
        ancestors = await attachPostViewCounts(ancestors);
      }

      return { post, ancestors };
    })
  );

  // 收集所有引用的帖子ID
  const allPosts = postsWithAncestors.flatMap((p) => [p.post, ...p.ancestors]);
  const refIds = collectReferencedIds(allPosts);
  const existingIds = new Set(allPosts.map((p) => p.id));
  const filteredRefIds = refIds.filter((id) => !existingIds.has(id));
  let referencedPosts = await fetchReferencedPosts(filteredRefIds);

  if (viewerId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = rawPosts.length === Number(limit);
  const nextCursor =
    rawPosts.length > 0
      ? rawPosts[rawPosts.length - 1].created_at.toISOString()
      : null;

  return {
    items: postsWithAncestors,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

/**
 * 获取用户的所有回帖（带祖先链）
 */
export async function getUserReplies({ userId, cursor, limit = 20, viewerId = null }) {
  await initStaticUrl();

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      author_id: Number(userId),
      post_type: "reply",
      is_deleted: false,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildRepliesListResponse(rawPosts, limit, viewerId);
}

/**
 * 获取用户的所有主贴（非回复）
 */
export async function getUserOriginalPosts({ userId, cursor, limit = 20, viewerId = null }) {
  await initStaticUrl();

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      author_id: Number(userId),
      post_type: "normal",
      is_deleted: false,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, viewerId);
}

/**
 * 获取用户的所有带媒体的帖子
 */
export async function getUserMediaPosts({ userId, cursor, limit = 20, viewerId = null }) {
  await initStaticUrl();

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      author_id: Number(userId),
      is_deleted: false,
      post_media: {
        some: {},
      },
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { created_at: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, viewerId);
}

/**
 * 获取用户喜欢的帖子（仅自己可见）
 */
export async function getUserLikedPosts({ userId, cursor, limit = 20, viewerId }) {
  await initStaticUrl();

  // 仅自己可见
  if (!viewerId || Number(userId) !== Number(viewerId)) {
    throw new Error("无权查看喜欢列表");
  }

  const likes = await prisma.ow_posts_like.findMany({
    where: {
      user_id: Number(userId),
      post: {
        is_deleted: false,
      },
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: Number(limit),
    select: {
      id: true,
      post: {
        select: buildLeanSelect(),
      },
    },
  });

  const rawPosts = likes.map((l) => l.post).filter(Boolean);
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, viewerId);
  posts = await attachPostViewCounts(posts);

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);

  if (Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = likes.length === Number(limit);
  const nextCursor = likes.length > 0 ? String(likes[likes.length - 1].id) : null;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

/**
 * 获取用户的收藏（仅自己可见）
 */
export async function getUserBookmarks({ userId, cursor, limit = 20, viewerId }) {
  await initStaticUrl();

  // 仅自己可见
  if (!viewerId || Number(userId) !== Number(viewerId)) {
    throw new Error("无权查看收藏列表");
  }

  const bookmarks = await prisma.ow_posts_bookmark.findMany({
    where: {
      user_id: Number(userId),
      post: {
        is_deleted: false,
      },
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: Number(limit),
    select: {
      id: true,
      post: {
        select: buildLeanSelect(),
      },
    },
  });

  const rawPosts = bookmarks.map((b) => b.post).filter(Boolean);
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, viewerId);
  posts = await attachPostViewCounts(posts);

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);

  if (Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = bookmarks.length === Number(limit);
  const nextCursor = bookmarks.length > 0 ? String(bookmarks[bookmarks.length - 1].id) : null;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

export { countPostCharacters, POST_CHAR_LIMIT, MAX_MEDIA_COUNT };

/**
 * 获取 Gorse 个性化推荐帖子列表
 * 已登录用户使用个性化推荐，未登录用户使用热门/最新帖子
 */
export async function getRecommendedFeed({
  userId = null,
  limit = 20,
  offset = 0,
}) {
  await initStaticUrl();

  let postIds;
  if (userId) {
    postIds = await gorseService.getRecommendedPostIds(userId, { limit, offset });
  } else {
    postIds = await gorseService.getLatestPostIds({ limit, offset });
  }

  // 如果 Gorse 无结果，降级到按时间排序
  if (!postIds || postIds.length === 0) {
    return getHomeFeed({ userId, limit, includeReplies: false, followingOnly: false });
  }

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      id: { in: postIds },
      is_deleted: false,
    },
    select: buildLeanSelect(),
  });

  // 按 Gorse 推荐顺序排序
  const postMap = new Map(rawPosts.map(p => [p.id, p]));
  const orderedRaw = postIds
    .map(id => postMap.get(id))
    .filter(Boolean);

  let posts = orderedRaw.map(formatPost);
  posts = await addViewerContext(posts, userId);
  posts = await attachPostViewCounts(posts);

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);
  if (userId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, userId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  const hasMore = postIds.length === limit;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_offset: hasMore ? offset + limit : null,
    has_more: hasMore,
  };
}

// ======================== 向量相似帖子 ========================

/**
 * 获取与指定帖子相似的帖子（基于向量相似度搜索）
 * @param {Object} params
 * @param {number} params.postId - 帖子 ID
 * @param {number} [params.limit=10] - 返回数量
 * @param {number|null} [params.viewerId] - 当前查看者 ID
 * @param {number|null} [params.minSimilarity] - 相似度下限（0~1）
 * @returns {Promise<Object>}
 */
export async function getSimilarPosts({ postId, limit = 10, viewerId = null, minSimilarity = null }) {
  await initStaticUrl();

  const enabled = await zcconfig.get('embedding.enabled');
  if (!enabled) {
    return { posts: [], includes: { posts: {} }, message: 'Embedding 服务未启用' };
  }

  const nPostId = Number(postId);
  if (isNaN(nPostId)) throw new Error('无效的帖子 ID');

  const sourcePost = await prisma.ow_posts.findFirst({
    where: { id: nPostId, is_deleted: false },
    select: {
      id: true,
      post_type: true,
      content: true,
      embed: true,
    },
  });
  if (!sourcePost) {
    throw new Error('帖子不存在');
  }

  let vector = await embeddingService.getEmbedding('post', nPostId);
  if (!vector) {
    const sourceText = embeddingService.buildPostText(sourcePost);
    if (!sourceText) {
      return { posts: [], includes: { posts: {} }, message: '该帖子无可用于向量的内容' };
    }

    vector = await embeddingService.generateEmbedding(sourceText);
    if (!vector) {
      return { posts: [], includes: { posts: {} }, message: '该帖子向量生成失败' };
    }

    try {
      await embeddingService.saveEmbedding('post', nPostId, vector, embeddingService.hashText(sourceText));
      await prisma.ow_posts.update({ where: { id: nPostId }, data: { embedding_at: new Date() } });
    } catch (e) {
      logger.debug(`[embedding] on-demand save post embedding failed: ${e.message}`);
    }
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const similarityThreshold =
    minSimilarity === null || minSimilarity === undefined
      ? null
      : Math.min(Math.max(Number(minSimilarity), 0), 1);

  // 搜索相似帖子（排除自身）
  const similarResults = await embeddingService.searchSimilar('post', vector, safeLimit + 20, [nPostId]);
  if (!similarResults || similarResults.length === 0) {
    return {
      posts: [],
      includes: { posts: {} },
      source_post_id: nPostId,
      min_similarity: similarityThreshold,
    };
  }

  const filteredResults =
    similarityThreshold === null
      ? similarResults
      : similarResults.filter((r) => Number(r.similarity) >= similarityThreshold);

  if (filteredResults.length === 0) {
    return {
      posts: [],
      includes: { posts: {} },
      source_post_id: nPostId,
      min_similarity: similarityThreshold,
    };
  }

  // 查询帖子详情（过滤已删除）
  const candidateIds = filteredResults.map(r => r.entityId);
  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      id: { in: candidateIds },
      is_deleted: false,
    },
    select: buildLeanSelect(),
  });

  // 按相似度排序
  const similarityMap = new Map(filteredResults.map(r => [r.entityId, r.similarity]));
  rawPosts.sort((a, b) => (similarityMap.get(b.id) || 0) - (similarityMap.get(a.id) || 0));

  // 截取到 safeLimit
  const trimmed = rawPosts.slice(0, safeLimit);

  let posts = trimmed.map(formatPost);
  posts = await addViewerContext(posts, viewerId);
  posts = await attachPostViewCounts(posts);

  // 附加相似度分数
  posts = posts.map(p => ({
    ...p,
    similarity: similarityMap.get(p.id) || 0,
  }));

  const refIds = collectReferencedIds(posts);
  let referencedPosts = await fetchReferencedPosts(refIds);
  if (viewerId && Object.keys(referencedPosts).length > 0) {
    const refPostsArray = Object.values(referencedPosts);
    const enriched = await addViewerContext(refPostsArray, viewerId);
    referencedPosts = {};
    for (const p of enriched) {
      referencedPosts[p.id] = p;
    }
  }

  return {
    posts,
    includes: { posts: referencedPosts },
    source_post_id: nPostId,
    min_similarity: similarityThreshold,
  };
}

/**
 * 获取 Embedding 服务基本信息（面向前端的公开接口）
 * 不暴露 API Key 等敏感信息
 */
export async function getEmbeddingInfo() {
  const enabled = await zcconfig.get('embedding.enabled');
  if (!enabled) {
    return { enabled: false };
  }

  const [provider, model, dimensions] = await Promise.all([
    zcconfig.get('embedding.provider'),
    zcconfig.get('embedding.model'),
    zcconfig.get('embedding.dimensions'),
  ]);

  let stats = null;
  try {
    const countResult = await prisma.$queryRawUnsafe(`
      SELECT entity_type, COUNT(*)::int as cnt
      FROM ow_embeddings
      GROUP BY entity_type
    `);
    stats = {};
    for (const row of countResult) {
      stats[row.entity_type] = row.cnt;
    }
  } catch {
    // pgvector 尚未初始化
    stats = null;
  }

  return {
    enabled: true,
    provider: provider || 'openai',
    model: model || 'text-embedding-3-small',
    dimensions: Number(dimensions) || 1536,
    stats,
  };
}

/**
 * 获取 URL 预览元数据（用于发帖时链接卡片）
 */
export async function getUrlPreview({ url, forceRefresh = false }) {
  return getPostUrlPreview(url, { forceRefresh });
}

