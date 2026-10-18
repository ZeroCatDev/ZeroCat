import { Router } from "express";
import { prisma } from "../../services/prisma.js";
import { requireScope } from "../../middleware/scope.js";
import * as administration from "../../services/auth/permissionAdministration.js";
import { getUserPolicy, getUserRoleAssignments, listUserScopedGrants } from "../../services/auth/policyEngine.js";
import { authorize } from "../../services/auth/authorization.js";
import { ModerationError, positiveId } from "../../services/moderation/policy.js";
import logger from "../../services/logger.js";

const router = Router();
const success = (res, data) => res.json({ status: "success", data });
const handle = (work) => async (req, res) => {
    try { await work(req, res); }
    catch (error) {
        if (!error.status) logger.error("[permissions]", error);
        res.status(error.status || 500).json({ status: "error", code: error.code || "PERMISSION_OPERATION_FAILED", message: error.status ? error.message : "权限操作失败" });
    }
};
const read = requireScope("admin:permissions:read");
const manage = requireScope("admin:permissions:manage");

async function userAccess(userId, targetType, targetId) {
    const id = positiveId(userId);
    const user = await prisma.ow_users.findUnique({ where: { id }, select: { id: true, username: true, display_name: true, status: true, type: true, avatar: true } });
    if (!user) throw new ModerationError(404, "USER_NOT_FOUND", "用户不存在");
    const [assignments, grants, permissions, policy] = await Promise.all([
        getUserRoleAssignments(id), listUserScopedGrants(id), administration.listUserPermissions(id),
        getUserPolicy(id, { targetType, targetId }),
    ]);
    return { user, assignments, grants, permissions, policy };
}

router.get("/roles", read, handle(async (_req, res) => success(res, { roles: await administration.listPermissionRoles() })));
router.post("/roles", manage, handle(async (req, res) => {
    success(res, await administration.createRole(res.locals.userid, { ...req.body, parentRoleIds: req.body.parent_role_ids || req.body.parentRoleIds || [] }));
}));
router.put("/roles/:id", manage, handle(async (req, res) => {
    const data = { ...req.body };
    if (data.parent_role_ids) data.parentRoleIds = data.parent_role_ids;
    success(res, await administration.updateRole(res.locals.userid, req.params.id, data));
}));
router.delete("/roles/:id", manage, handle(async (req, res) => success(res, await administration.deleteRole(res.locals.userid, req.params.id, req.body || {}))));
router.put("/roles/:id/parents", manage, handle(async (req, res) => {
    success(res, await administration.setRoleInheritance(res.locals.userid, req.params.id, req.body.parent_role_ids || [], req.body || {}));
}));
router.get("/users", read, handle(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const size = Math.max(1, Math.min(100, Number.parseInt(req.query.itemsPerPage, 10) || 20));
    const search = String(req.query.search || "").trim();
    const where = search ? { OR: [{ username: { contains: search, mode: "insensitive" } }, { display_name: { contains: search, mode: "insensitive" } }] } : {};
    const [users, total] = await Promise.all([
        prisma.ow_users.findMany({ where, skip: (page - 1) * size, take: size, orderBy: { id: "desc" }, select: { id: true, username: true, display_name: true, status: true, type: true, avatar: true } }),
        prisma.ow_users.count({ where }),
    ]);
    success(res, { users, items: users, total });
}));
router.get("/users/:id", read, handle(async (req, res) => success(res, await userAccess(req.params.id, req.query.target_type, req.query.target_id))));
router.put("/users/:id", manage, handle(async (req, res) => {
    const input = req.body || {};
    if (input.permissions !== undefined) {
        throw new ModerationError(400, "INDIVIDUAL_PERMISSION_UPDATES_REQUIRED", "直接权限请通过授权接口逐条授予或撤销");
    }
    if (input.role_keys === undefined) throw new ModerationError(400, "INVALID_PERMISSION_UPDATE", "请选择需要更新的角色");
    await administration.setUserRoles(res.locals.userid, req.params.id, input.role_keys, input);
    success(res, await userAccess(req.params.id));
}));
router.get("/users/:id/explain", read, handle(async (req, res) => {
    const scope = String(req.query.scope || "");
    if (!scope) throw new ModerationError(400, "SCOPE_REQUIRED", "请指定权限");
    const result = await authorize({ userId: positiveId(req.params.id), requiredScope: scope, tokenType: "session" });
    success(res, result);
}));
router.post("/grants", manage, handle(async (req, res) => {
    const input = { ...req.body, expiresAt: req.body?.expiresAt ?? req.body?.expires_at };
    const result = input.role_key
        ? await administration.grantResourceRole(res.locals.userid, input.user_id, input.role_key, input)
        : await administration.grantUserPermission(res.locals.userid, input.user_id, input);
    success(res, result);
}));
router.delete("/grants/:id", manage, handle(async (req, res) => {
    if (req.query.type === "role") {
        const grant = await prisma.ow_user_roles.findUnique({ where: { id: positiveId(req.params.id) }, include: { role: true } });
        if (!grant || grant.target_type === "global") throw new ModerationError(404, "GRANT_NOT_FOUND", "授权不存在");
        success(res, await administration.revokeResourceRole(res.locals.userid, grant.user_id, grant.role.key, { targetType: grant.target_type, targetId: grant.target_id }));
    } else {
        const grant = await prisma.ow_user_permissions.findUnique({ where: { id: positiveId(req.params.id) } });
        if (!grant) throw new ModerationError(404, "GRANT_NOT_FOUND", "授权不存在");
        success(res, await administration.revokeUserPermission(res.locals.userid, grant.user_id, grant.id));
    }
}));

export default router;
