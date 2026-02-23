import { Router } from "express";
import multer from "multer";
import logger from "../services/logger.js";
import { needLogin } from "../middleware/auth.js";
import {
  createPost,
  replyToPost,
  retweetPost,
  unretweetPost,
  quotePost,
  likePost,
  unlikePost,
  bookmarkPost,
  unbookmarkPost,
  deletePost,
  getPostById,
  getUserPosts,
  getHomeFeed,
  getThread,
  getMentions,
  getRelatedPosts,
  getPostRetweets,
  getPostQuotes,
  getPostLikes,
  getPostAnalytics,
  getUserReplies,
  getUserOriginalPosts,
  getUserMediaPosts,
  getUserLikedPosts,
  getUserBookmarks,
  MAX_MEDIA_COUNT,
} from "../controllers/posts.js";
import { handleAssetUpload, validateFileTypeFromContent } from "../services/assets.js";

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

const pickQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const parseBooleanQuery = (value, fallback = false) => {
  const picked = pickQueryValue(value);
  if (picked === undefined || picked === null || String(picked).trim() === "") {
    return fallback;
  }
  return String(picked).trim().toLowerCase() === "true";
};

const parseEmbedDataQuery = (value) => {
  const picked = pickQueryValue(value);
  if (picked === undefined || picked === null) {
    throw new Error("embeddata 不能为空");
  }

  let parsed = picked;
  if (typeof picked === "string") {
    const trimmed = picked.trim();
    if (!trimmed) {
      throw new Error("embeddata 不能为空");
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("embeddata 必须是合法 JSON");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("embeddata 必须是对象");
  }

  if (Object.keys(parsed).length === 0) {
    throw new Error("embeddata 至少提供一个筛选条件");
  }

  return parsed;
};
router.post("/upload-image", needLogin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "没有上传文件" });
    }

    const validation = await validateFileTypeFromContent(req.file.buffer, req.file.mimetype);
    if (!validation.isValid || !validation.mimeType?.startsWith("image/")) {
      return res.status(400).json({ status: "error", message: "只允许上传图片" });
    }

    const uploadResult = await handleAssetUpload(req, res, {
      purpose: "scratch",
      category: "post",
      tags: "post",
      errorMessage: "图片上传失败",
    });

    if (!uploadResult.success) {
      return res.status(uploadResult.status).json({
        status: "error",
        message: uploadResult.error,
        ...(uploadResult.details && { details: uploadResult.details }),
      });
    }

    return res.status(200).json({
      status: "success",
      data: uploadResult.result,
    });
  } catch (error) {
    logger.error("上传图片失败:", error);
    return res.status(500).json({ status: "error", message: "图片上传失败" });
  }
});

router.post("/", needLogin, async (req, res) => {
  try {
    const { content, mediaIds = [], embed } = req.body;
    if (mediaIds.length > MAX_MEDIA_COUNT) {
      return res.status(400).json({ status: "error", message: `最多只能上传${MAX_MEDIA_COUNT}张图片` });
    }
    const data = await createPost({
      authorId: res.locals.userid,
      content,
      mediaIds,
      embed,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("创建推文失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.post("/:id/reply", needLogin, async (req, res) => {
  try {
    const { content, mediaIds = [], embed } = req.body;
    const data = await replyToPost({
      authorId: res.locals.userid,
      content,
      mediaIds,
      replyToId: req.params.id,
      embed,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("回复推文失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.post("/:id/retweet", needLogin, async (req, res) => {
  try {
    const data = await retweetPost({
      authorId: res.locals.userid,
      retweetPostId: req.params.id,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("转推失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.delete("/:id/retweet", needLogin, async (req, res) => {
  try {
    const result = await unretweetPost({
      authorId: res.locals.userid,
      retweetPostId: req.params.id,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    logger.error("取消转推失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.post("/:id/quote", needLogin, async (req, res) => {
  try {
    const { content, mediaIds = [], embed } = req.body;
    const data = await quotePost({
      authorId: res.locals.userid,
      quotedPostId: req.params.id,
      content,
      mediaIds,
      embed,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("引用推文失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.post("/:id/like", needLogin, async (req, res) => {
  try {
    const like = await likePost({ userId: res.locals.userid, postId: req.params.id });
    res.status(200).json({ status: "success", data: like });
  } catch (error) {
    logger.error("点赞失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.delete("/:id/like", needLogin, async (req, res) => {
  try {
    const result = await unlikePost({ userId: res.locals.userid, postId: req.params.id });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    logger.error("取消点赞失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.post("/:id/bookmark", needLogin, async (req, res) => {
  try {
    const bookmark = await bookmarkPost({ userId: res.locals.userid, postId: req.params.id });
    res.status(200).json({ status: "success", data: bookmark });
  } catch (error) {
    logger.error("收藏失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.delete("/:id/bookmark", needLogin, async (req, res) => {
  try {
    const result = await unbookmarkPost({ userId: res.locals.userid, postId: req.params.id });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    logger.error("取消收藏失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.delete("/:id", needLogin, async (req, res) => {
  try {
    const result = await deletePost({ userId: res.locals.userid, postId: req.params.id });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    logger.error("删除推文失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.get("/feed", async (req, res) => {
  try {
    const { cursor, limit = 20, include_replies = "false", following_only = "false" } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getHomeFeed({
      userId: viewerId,
      cursor,
      limit,
      includeReplies: include_replies === "true",
      followingOnly: following_only === "true",
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取首页刷帖失败:", error);
    res.status(500).json({ status: "error", message: "获取刷帖失败" });
  }
});

router.get("/mentions", needLogin, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const data = await getMentions({
      userId: res.locals.userid,
      cursor,
      limit,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取提及失败:", error);
    res.status(500).json({ status: "error", message: "获取提及失败" });
  }
});

router.get("/related", async (req, res) => {
  try {
    const embedData = parseEmbedDataQuery(req.query.embeddata);

    const data = await getRelatedPosts({
      embedData,
      cursor: pickQueryValue(req.query.cursor),
      limit: pickQueryValue(req.query.limit) ?? 20,
      includeReplies: parseBooleanQuery(req.query.include_replies, false),
      viewerId: res.locals.userid || null,
    });

    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取关联帖子失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.get("/user/:userid", async (req, res) => {
  try {
    const { cursor, limit = 20, include_replies = "false" } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getUserPosts({
      userId: req.params.userid,
      cursor,
      limit,
      includeReplies: include_replies === "true",
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户推文失败:", error);
    res.status(500).json({ status: "error", message: "获取用户推文失败" });
  }
});

// 获取用户所有回帖（带祖先链）
router.get("/user/:userid/replies", async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getUserReplies({
      userId: req.params.userid,
      cursor,
      limit,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户回帖失败:", error);
    res.status(500).json({ status: "error", message: "获取用户回帖失败" });
  }
});

// 获取用户所有主贴（非回复）
router.get("/user/:userid/originals", async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getUserOriginalPosts({
      userId: req.params.userid,
      cursor,
      limit,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户主贴失败:", error);
    res.status(500).json({ status: "error", message: "获取用户主贴失败" });
  }
});

// 获取用户所有带媒体的帖子
router.get("/user/:userid/media", async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getUserMediaPosts({
      userId: req.params.userid,
      cursor,
      limit,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户媒体帖失败:", error);
    res.status(500).json({ status: "error", message: "获取用户媒体帖失败" });
  }
});

// 获取用户喜欢的帖子（仅自己可见）
router.get("/user/:userid/likes", needLogin, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const data = await getUserLikedPosts({
      userId: req.params.userid,
      cursor,
      limit,
      viewerId: res.locals.userid,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户喜欢失败:", error);
    if (error.message === "无权查看喜欢列表") {
      return res.status(403).json({ status: "error", message: error.message });
    }
    res.status(500).json({ status: "error", message: "获取用户喜欢失败" });
  }
});

// 获取用户收藏（仅自己可见）
router.get("/user/:userid/bookmarks", needLogin, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const data = await getUserBookmarks({
      userId: req.params.userid,
      cursor,
      limit,
      viewerId: res.locals.userid,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取用户收藏失败:", error);
    if (error.message === "无权查看收藏列表") {
      return res.status(403).json({ status: "error", message: error.message });
    }
    res.status(500).json({ status: "error", message: "获取用户收藏失败" });
  }
});

router.get("/thread/:id", async (req, res) => {
  try {
    const { cursor, limit = 50 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getThread(req.params.id, { cursor, limit, viewerId });
    if (!data) {
      return res.status(404).json({ status: "error", message: "线程不存在" });
    }
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取线程失败:", error);
    res.status(500).json({ status: "error", message: "获取线程失败" });
  }
});

// 获取帖子的所有转推
router.get("/:id/retweets", async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getPostRetweets({
      postId: req.params.id,
      cursor,
      limit,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取转推列表失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

// 获取帖子的所有引用
router.get("/:id/quotes", async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const viewerId = res.locals.userid || null;
    const data = await getPostQuotes({
      postId: req.params.id,
      cursor,
      limit,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取引用列表失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

// 获取帖子的点赞用户列表（仅发帖人可见）
router.get("/:id/likes", needLogin, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const data = await getPostLikes({
      postId: req.params.id,
      cursor,
      limit,
      viewerId: res.locals.userid,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取点赞列表失败:", error);
    if (error.message === "无权查看点赞列表") {
      return res.status(403).json({ status: "error", message: error.message });
    }
    res.status(400).json({ status: "error", message: error.message });
  }
});

// 获取帖子的互动分析
router.get("/:id/analytics", async (req, res) => {
  try {
    const viewerId = res.locals.userid || null;
    const data = await getPostAnalytics({
      postId: req.params.id,
      viewerId,
    });
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取帖子分析失败:", error);
    res.status(400).json({ status: "error", message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const viewerId = res.locals.userid || null;
    const data = await getPostById(req.params.id, viewerId);
    if (!data) {
      return res.status(404).json({ status: "error", message: "推文不存在" });
    }
    res.status(200).json({ status: "success", data });
  } catch (error) {
    logger.error("获取推文失败:", error);
    res.status(500).json({ status: "error", message: "获取推文失败" });
  }
});

export default router;

