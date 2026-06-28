/**
 * 项目合作者路由
 *
 * 挂载于 /collaboration。分两类：
 *  - 项目级管理（邀请/成员/角色/取消邀请）：用 requireResource("project","manage",...)
 *    天然过滤为“项目作者 + 管理员协作者”。
 *  - 自助（受邀者接受/拒绝、查看/离开自己的协作）：needLogin + 服务内校验归属。
 */
import { Router } from "express";
import logger from "../services/logger.js";
import { needLogin } from "../middleware/auth.js";
import { requireResource } from "../middleware/scope.js";
import { COLLABORATION_ROLE_KEYS } from "../services/auth/rolePermissions.js";
import collaborationService, {
    CollaborationError,
} from "../services/projectCollaborationService.js";

const router = Router();

function handleError(res, error, fallback) {
    if (error instanceof CollaborationError) {
        return res.status(error.status).json({
            status: "error",
            message: error.message,
            code: error.code,
        });
    }
    logger.error(`[collaboration] ${fallback}: ${error?.message || error}`);
    return res.status(500).json({ status: "error", message: fallback });
}

// ---------- 项目级管理 ----------

// 邀请合作者
router.post(
    "/projects/:projectId/invitations",
    needLogin,
    requireResource("project", "manage", "projectId"),
    async (req, res) => {
        try {
            const inviteeIdentifier =
                req.body?.username ?? req.body?.user_id ?? req.body?.invitee ?? req.body?.invitee_id;
            const invitation = await collaborationService.inviteCollaborator({
                projectId: req.params.projectId,
                inviterId: res.locals.userid,
                inviteeIdentifier,
                roleKey: req.body?.role_key,
                message: req.body?.message,
            });
            res.json({ status: "success", message: "邀请已发送", data: { invitation } });
        } catch (error) {
            handleError(res, error, "发送邀请失败");
        }
    }
);

// 成员名单 + 待处理邀请（作者或在册成员可见）
router.get("/projects/:projectId/members", needLogin, async (req, res) => {
    try {
        const allowed = await collaborationService.isProjectMemberOrOwner(
            res.locals.userid,
            req.params.projectId
        );
        if (!allowed) {
            return res.status(403).json({
                status: "error",
                message: "无权查看该项目的合作者",
                code: "ZC_ERROR_FORBIDDEN",
            });
        }
        const data = await collaborationService.listProjectMembers(req.params.projectId);
        res.json({ status: "success", data });
    } catch (error) {
        handleError(res, error, "获取合作者列表失败");
    }
});

// 修改成员角色
router.patch(
    "/projects/:projectId/members/:userId",
    needLogin,
    requireResource("project", "manage", "projectId"),
    async (req, res) => {
        try {
            const data = await collaborationService.updateMemberRole({
                projectId: req.params.projectId,
                actorId: res.locals.userid,
                memberUserId: req.params.userId,
                roleKey: req.body?.role_key,
            });
            res.json({ status: "success", message: "已更新成员角色", data });
        } catch (error) {
            handleError(res, error, "更新成员角色失败");
        }
    }
);

// 移除成员
router.delete(
    "/projects/:projectId/members/:userId",
    needLogin,
    requireResource("project", "manage", "projectId"),
    async (req, res) => {
        try {
            const data = await collaborationService.removeMember({
                projectId: req.params.projectId,
                actorId: res.locals.userid,
                memberUserId: req.params.userId,
            });
            res.json({ status: "success", message: "已移除合作者", data });
        } catch (error) {
            handleError(res, error, "移除合作者失败");
        }
    }
);

// 取消待处理邀请
router.delete(
    "/projects/:projectId/invitations/:invitationId",
    needLogin,
    requireResource("project", "manage", "projectId"),
    async (req, res) => {
        try {
            const data = await collaborationService.cancelInvitation({
                projectId: req.params.projectId,
                actorId: res.locals.userid,
                invitationId: req.params.invitationId,
            });
            res.json({ status: "success", message: "已取消邀请", data });
        } catch (error) {
            handleError(res, error, "取消邀请失败");
        }
    }
);

// ---------- 自助 ----------

// 当前用户对某项目的访问能力（顶栏子菜单按权限加载用）。允许匿名（按公开性判断）。
router.get("/my-access", async (req, res) => {
    try {
        const access = await collaborationService.getMyProjectAccess(res.locals.userid, {
            projectId: req.query.project_id,
            authorname: req.query.author,
            projectname: req.query.project,
        });
        if (!access) {
            return res.status(404).json({ status: "error", message: "项目不存在或无权访问" });
        }
        res.json({ status: "success", data: access });
    } catch (error) {
        handleError(res, error, "获取项目权限失败");
    }
});

// 可选协作角色清单（前端展示用）
router.get("/roles", needLogin, (req, res) => {
    res.json({
        status: "success",
        data: {
            roles: COLLABORATION_ROLE_KEYS.map((key) => ({
                key,
                label: collaborationService.COLLABORATION_ROLE_LABELS[key] || key,
            })),
        },
    });
});

// 我收到的待处理邀请
router.get("/invitations", needLogin, async (req, res) => {
    try {
        const invitations = await collaborationService.listReceivedInvitations(res.locals.userid);
        res.json({ status: "success", data: { invitations } });
    } catch (error) {
        handleError(res, error, "获取邀请失败");
    }
});

// 接受邀请
router.post("/invitations/:id/accept", needLogin, async (req, res) => {
    try {
        const data = await collaborationService.respondToInvitation({
            invitationId: req.params.id,
            userId: res.locals.userid,
            accept: true,
        });
        res.json({ status: "success", message: "已接受邀请", data });
    } catch (error) {
        handleError(res, error, "接受邀请失败");
    }
});

// 拒绝邀请
router.post("/invitations/:id/decline", needLogin, async (req, res) => {
    try {
        const data = await collaborationService.respondToInvitation({
            invitationId: req.params.id,
            userId: res.locals.userid,
            accept: false,
        });
        res.json({ status: "success", message: "已拒绝邀请", data });
    } catch (error) {
        handleError(res, error, "拒绝邀请失败");
    }
});

// 我参与协作的项目
router.get("/memberships", needLogin, async (req, res) => {
    try {
        const memberships = await collaborationService.listMyCollaborations(res.locals.userid);
        res.json({ status: "success", data: { memberships } });
    } catch (error) {
        handleError(res, error, "获取协作项目失败");
    }
});

// 离开某项目（自助解除）
router.delete("/memberships/:projectId", needLogin, async (req, res) => {
    try {
        const data = await collaborationService.leaveProject({
            projectId: req.params.projectId,
            userId: res.locals.userid,
        });
        res.json({ status: "success", message: "已退出协作", data });
    } catch (error) {
        handleError(res, error, "退出协作失败");
    }
});

export default router;
