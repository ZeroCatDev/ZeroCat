import { Router } from "express";
import { needLogin } from "../middleware/auth.js";
import logger from "../services/logger.js";
import * as draftService from "../services/blog/draftService.js";

const router = Router();

const sendServiceError = (res, err, fallback = "服务器错误") => {
  const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  if (status >= 500) logger.error("[router_blog]", err);
  return res.status(status).json({
    status: "error",
    message: err?.message || fallback,
  });
};

router.get("/drafts", needLogin, async (req, res) => {
  try {
    const drafts = await draftService.listDrafts(res.locals.userid);
    res.json({ status: "success", data: drafts });
  } catch (err) {
    return sendServiceError(res, err, "获取草稿列表失败");
  }
});

router.get("/drafts/:projectId", needLogin, async (req, res) => {
  try {
    const draft = await draftService.getDraft(res.locals.userid, req.params.projectId);
    if (!draft) {
      return res.status(404).json({ status: "error", message: "草稿不存在" });
    }
    res.json({ status: "success", data: draft });
  } catch (err) {
    return sendServiceError(res, err, "获取草稿失败");
  }
});

router.put("/drafts/:projectId", needLogin, async (req, res) => {
  try {
    const payload = req.body || {};
    const patch = {
      title: payload.title,
      description: payload.description,
      content: payload.content,
      tags: payload.tags,
      cover: payload.cover,
      slug: payload.slug,
    };
    const draft = await draftService.saveDraft(
      res.locals.userid,
      req.params.projectId,
      patch,
      { creatorIp: req.ipInfo?.clientIP || req.ip || "" }
    );
    res.json({ status: "success", data: draft });
  } catch (err) {
    return sendServiceError(res, err, "保存草稿失败");
  }
});

router.delete("/drafts/:projectId", needLogin, async (req, res) => {
  try {
    const removed = await draftService.discardDraft(res.locals.userid, req.params.projectId);
    res.json({ status: "success", data: { removed: Boolean(removed) } });
  } catch (err) {
    return sendServiceError(res, err, "丢弃草稿失败");
  }
});

router.post("/drafts/:projectId/publish", needLogin, async (req, res) => {
  try {
    const { message } = req.body || {};
    const result = await draftService.publishDraft(
      res.locals.userid,
      req.params.projectId,
      { message }
    );
    res.json({ status: "success", data: result });
  } catch (err) {
    return sendServiceError(res, err, "发布失败");
  }
});

import * as postsController from "../controllers/blog/postsController.js";
import * as tagsController from "../controllers/blog/tagsController.js";

// ========== CMS APIs ==========

router.get("/posts", postsController.getPosts);
router.get("/posts/@:username", postsController.getPostsByAuthor);
router.get("/posts/@:username/:slug", postsController.getPostDetail); // Assuming detail can handle slug or id
router.get("/posts/:id", postsController.getPostDetail);
router.post("/posts", needLogin, postsController.createPost);
router.patch("/posts/:id/meta", needLogin, postsController.updatePostMeta);
// router.post("/posts/:id/publish", needLogin, postsController.publishPost); // Re-uses draft publish?
router.post("/posts/:id/unpublish", needLogin, postsController.unpublishPost);
router.get("/posts/:id/related", postsController.getRelatedPosts);
// router.get("/posts/:id/toc", postsController.getPostToc);

router.get("/tags", tagsController.getTags);
// router.get("/tags/:name/posts", postsController.getPostsByTag);
// router.get("/series", tagsController.getSeries);

// router.get("/feed.rss", feedService.getRss);
// router.get("/search", postsController.search);

export default router;
