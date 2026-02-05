import { prisma } from "../services/prisma.js";
import { createNotification } from "./notifications.js";
import zcconfig from "../services/config/zcconfig.js";

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

const URL_WEIGHT = 23;
const EMBED_TYPES = ["project", "list", "user", "url"];

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
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];
  const contentWithoutUrls = content.replace(urlRegex, "");
  const otherLength = Array.from(contentWithoutUrls).length;
  return urls.length * URL_WEIGHT + otherLength;
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
    created_at: true,
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
  };
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
  const map = {};
  for (const raw of raws) {
    map[raw.id] = formatPost(raw);
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
    posts.length > 0 ? String(posts[posts.length - 1].id) : null;

  return {
    posts,
    includes: { posts: referencedPosts },
    next_cursor: hasMore ? nextCursor : null,
    has_more: hasMore,
  };
}

async function notifyMentions(mentionedUsers, actorId, postId) {
  await Promise.all(
    mentionedUsers.map((user) =>
      createNotification({
        notificationType: "post_mention",
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

  const characterCount = countPostCharacters(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (characterCount > POST_CHAR_LIMIT) {
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

  const formattedPost = formatPost(post);
  return {
    post: formattedPost,
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

  const characterCount = countPostCharacters(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (characterCount > POST_CHAR_LIMIT) {
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

  const formattedPost = formatPost(post);
  const refIds = collectReferencedIds([formattedPost]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: formattedPost,
    includes: { posts: referencedPosts },
  };
}

export async function retweetPost({ authorId, retweetPostId }) {
  const target = await prisma.ow_posts.findFirst({
    where: { id: Number(retweetPostId), is_deleted: false },
    select: { id: true, author_id: true },
  });
  if (!target) {
    throw new Error("目标推文不存在");
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.ow_posts.create({
      data: {
        author_id: authorId,
        post_type: "retweet",
        retweet_post_id: target.id,
        content: null,
        character_count: 0,
      },
      select: buildLeanSelect(),
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { retweet_count: { increment: 1 } },
    });

    return created;
  });

  if (target.author_id && target.author_id !== authorId) {
    await createNotification({
      notificationType: "post_retweet",
      userId: target.author_id,
      actorId: authorId,
      targetType: "post",
      targetId: target.id,
      data: { post_id: post.id },
    });
  }

  const formattedPost = formatPost(post);
  const refIds = collectReferencedIds([formattedPost]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: formattedPost,
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
      return { count: 0 };
    }

    await tx.ow_posts.update({
      where: { id: retweet.id },
      data: { is_deleted: true },
    });

    await tx.ow_posts.update({
      where: { id: target.id },
      data: { retweet_count: { decrement: 1 } },
    });

    return { count: 1 };
  });

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

  const characterCount = countPostCharacters(content);
  if (!content || characterCount === 0) {
    throw new Error("内容不能为空");
  }
  if (characterCount > POST_CHAR_LIMIT) {
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

  const formattedPost = formatPost(post);
  const refIds = collectReferencedIds([formattedPost]);
  const referencedPosts = await fetchReferencedPosts(refIds);

  return {
    post: formattedPost,
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
      userId: target.author_id,
      actorId: userId,
      targetType: "post",
      targetId: target.id,
      data: { post_id: target.id },
    });
  }

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

  return result;
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
    orderBy: [{ like_count: "desc" }, { id: "asc" }],
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

  // 获取祖先链（如果是回复帖子）
  let ancestors = [];
  if (raw.in_reply_to_id) {
    const ancestorRaws = await getAncestorChain(raw.in_reply_to_id);
    // 排除当前帖子本身（如果意外出现）
    const filteredAncestors = ancestorRaws.filter((a) => a.id !== raw.id);
    ancestors = filteredAncestors.map(formatPost);
    ancestors = await addViewerContext(ancestors, viewerId);
  }

  // 获取分类后的回复
  const { featured: featuredReplies, regular: regularReplies } =
    await getRepliesWithClassification(raw.id, raw.author_id, raw.like_count, viewerId);

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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
}) {
  await initStaticUrl();
  let authorIds = null;

  if (userId) {
    const follows = await prisma.ow_user_relationships.findMany({
      where: {
        source_user_id: Number(userId),
        relationship_type: "follow",
      },
      select: { target_user_id: true },
    });
    authorIds = [
      Number(userId),
      ...follows.map((rel) => rel.target_user_id).filter(Boolean),
    ];
  }

  const rawPosts = await prisma.ow_posts.findMany({
    where: {
      is_deleted: false,
      ...(includeReplies ? {} : { post_type: { not: "reply" } }),
      ...(authorIds ? { author_id: { in: authorIds } } : {}),
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  return buildListResponse(rawPosts, limit, userId);
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

  // 获取祖先链（如果是回复帖子）
  let ancestors = [];
  if (raw.in_reply_to_id) {
    const ancestorRaws = await getAncestorChain(raw.in_reply_to_id);
    const filteredAncestors = ancestorRaws.filter((a) => a.id !== raw.id);
    ancestors = filteredAncestors.map(formatPost);
    ancestors = await addViewerContext(ancestors, viewerId);
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
      ...(cursor ? { id: { gt: Number(cursor) } } : {}),
    },
    orderBy: { id: "asc" },
    take: Number(limit),
    select: buildLeanSelect(),
  });

  let replies = repliesRaw.map(formatPost);
  replies = await addViewerContext(replies, viewerId);

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
    replies.length > 0 ? String(replies[replies.length - 1].id) : null;

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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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

  // 仅作者可见收藏数
  if (isAuthor) {
    result.bookmark_count = target.bookmark_count;
  }

  return result;
}

/**
 * 构建带祖先链的回帖列表响应
 */
async function buildRepliesListResponse(rawPosts, limit, viewerId = null) {
  let posts = rawPosts.map(formatPost);
  posts = await addViewerContext(posts, viewerId);

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
    posts.length > 0 ? String(posts[posts.length - 1].id) : null;

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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
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
