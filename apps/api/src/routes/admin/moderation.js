import { Router } from "express";
import { prisma } from "../../services/prisma.js";
import { requireScope } from "../../middleware/scope.js";
import { createRestriction, revokeRestriction, RESTRICTION_CATEGORIES } from "../../services/moderation/restrictions.js";
import { softDeleteContent, restoreContent, setContentShadowban } from "../../services/moderation/lifecycle.js";
import { ModerationError, positiveId } from "../../services/moderation/policy.js";
import logger from "../../services/logger.js";

const router = Router();
const success = (res, data) => res.json({ status: "success", data });
const authorizationContext = res => ({ tokenType: res.locals.tokenType, tokenScopes: res.locals.scopes || [] });
const handle = (work) => async (req, res) => {
    try { await work(req, res); }
    catch (error) {
        if (!error.status) logger.error("[moderation]", error);
        res.status(error.status || 500).json({ status: "error", code: error.code || "MODERATION_FAILED", message: error.status ? error.message : "治理操作失败" });
    }
};

router.get("/categories", requireScope("admin:restrictions:read"), (_req, res) => success(res, RESTRICTION_CATEGORIES));
router.get("/users/:id/restrictions", requireScope("admin:restrictions:read"), handle(async (req, res) => {
    const userId = positiveId(req.params.id);
    const user = await prisma.ow_users.findUnique({ where: { id: userId }, select: { id: true, username: true, display_name: true } });
    if (!user) throw new ModerationError(404, "USER_NOT_FOUND", "用户不存在");
    const restrictions = await prisma.ow_user_restrictions.findMany({ where: { user_id: userId }, orderBy: { created_at: "desc" } });
    success(res, { user, restrictions, categories: RESTRICTION_CATEGORIES });
}));
router.post("/users/:id/restrictions", requireScope("admin:restrictions:manage"), handle(async (req, res) => {
    success(res, await createRestriction(req.params.id, res.locals.userid, req.body || {}, { authorizationContext: authorizationContext(res) }));
}));
router.delete("/restrictions/:id", requireScope("admin:restrictions:manage"), handle(async (req, res) => {
    success(res, await revokeRestriction(req.params.id, res.locals.userid, { authorizationContext: authorizationContext(res) }));
}));
router.get("/content", requireScope("admin:hidden_content:read"), handle(async (req, res) => {
    const kind = req.query.kind === "project" ? "project" : req.query.kind === "post" ? "post" : null;
    if (!kind) throw new ModerationError(400, "INVALID_CONTENT_KIND", "请选择内容类型");
    const model = kind === "project" ? prisma.ow_projects : prisma.ow_posts;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    if (req.query.state === "deleted") Object.assign(where, kind === "post" ? { is_deleted: true } : { deleted_at: { not: null } });
    else if (req.query.state === "shadowbanned") Object.assign(where, { is_shadowbanned: true });
    if (req.query.user_id) where[kind === "post" ? "author_id" : "authorid"] = positiveId(req.query.user_id);
    const [items, total] = await Promise.all([
        model.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { id: "desc" }, include: { author: { select: { id: true, username: true, display_name: true } } } }),
        model.count({ where }),
    ]);
    success(res, { items, total, page, limit });
}));
router.post("/:kind/:id/delete", requireScope("admin:content:manage"), handle(async (req, res) => {
    success(res, await softDeleteContent(req.params.kind, req.params.id, res.locals.userid, { administrative: true, reason: req.body?.reason, authorizationContext: authorizationContext(res) }));
}));
router.post("/:kind/:id/restore", requireScope("admin:content:manage"), handle(async (req, res) => {
    success(res, await restoreContent(req.params.kind, req.params.id, res.locals.userid, { administrative: true, reason: req.body?.reason, authorizationContext: authorizationContext(res) }));
}));
router.put("/:kind/:id/shadowban", requireScope("admin:content:manage"), handle(async (req, res) => {
    success(res, await setContentShadowban(req.params.kind, req.params.id, res.locals.userid, req.body?.hidden, { reason: req.body?.reason, expiresAt: req.body?.expires_at, authorizationContext: authorizationContext(res) }));
}));

export default router;
