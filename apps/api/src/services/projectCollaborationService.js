/**
 * 项目合作者服务
 *
 * 负责项目协作的全部业务逻辑：邀请生命周期、成员名单、权限判定。
 * 协作成员关系存放在 ow_user_roles 的实例级授予中
 * (grant_type='collaboration', target_type='project', target_id=<projectId>)，
 * 由 policyEngine 的 scoped-grant API 读写。资源边界检查 (scopes.js) 通过
 * getCollabScopes 判断协作者能否操作项目。
 */
import { prisma } from "./prisma.js";
import logger from "./logger.js";
import { scopeSatisfies } from "./auth/scopes.js";
import {
    assignScopedRole,
    getUserResourceRoleScopes,
    listResourceGrants,
    listUserScopedGrants,
    revokeScopedRole,
} from "./auth/policyEngine.js";
import {
    COLLABORATION_ROLE_KEYS,
    SYSTEM_ROLE_KEYS,
} from "./auth/rolePermissions.js";
import { createNotification } from "../controllers/notifications.js";

export const PROJECT_TARGET_TYPE = "project";
export const COLLABORATION_GRANT_TYPE = "collaboration";
const INVITATION_TTL_DAYS = 7;
const COLLABORATIONS_LINK = "/app/collaborations";

export const COLLABORATION_ROLE_LABELS = {
    [SYSTEM_ROLE_KEYS.PROJECT_VIEWER]: "查看者",
    [SYSTEM_ROLE_KEYS.PROJECT_EDITOR]: "编辑者",
    [SYSTEM_ROLE_KEYS.PROJECT_MANAGER]: "管理员",
};

export class CollaborationError extends Error {
    constructor(message, status = 400, code = "ZC_ERROR_COLLABORATION") {
        super(message);
        this.name = "CollaborationError";
        this.status = status;
        this.code = code;
    }
}

function isCollaborationRole(roleKey) {
    return COLLABORATION_ROLE_KEYS.includes(roleKey);
}

async function getProject(projectId) {
    const id = Number(projectId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return prisma.ow_projects.findUnique({
        where: { id },
        select: { id: true, name: true, title: true, authorid: true, state: true, type: true },
    });
}

async function resolveUser(identifier) {
    const raw = String(identifier ?? "").trim();
    if (!raw) return null;
    const where = /^\d+$/.test(raw) ? { id: Number(raw) } : { username: raw };
    return prisma.ow_users.findUnique({
        where,
        select: { id: true, username: true, display_name: true, avatar: true, status: true },
    });
}

async function safeNotify(payload) {
    try {
        // 不传 actorId/targetType，避免被接收方的“屏蔽该用户/项目”设置拦截，确保邀请类通知必达。
        await createNotification(payload);
    } catch (error) {
        logger.warn(`[collaboration] 发送通知失败: ${error.message}`);
    }
}

/** 读取用户在某项目上协作角色覆盖的 allow scope（供资源边界检查使用）。 */
export async function getCollabScopes(userId, projectId) {
    return getUserResourceRoleScopes(userId, PROJECT_TARGET_TYPE, String(projectId));
}

/** 用户能否对项目执行某动作：作者放行全部；删除永远仅作者；其余看协作角色 scope。 */
export async function userCanActOnProject(userId, projectId, action) {
    const project = await getProject(projectId);
    if (!project) return false;
    if (Number(project.authorid) === Number(userId)) return true;
    if (action === "delete") return false;
    const scopes = await getCollabScopes(userId, project.id);
    return scopeSatisfies(scopes, `project:${action}`);
}

/** 是否可管理协作者（邀请/移除/改角色）：作者或拥有 project:manage 的管理员协作者。 */
export async function canManageCollaborators(userId, projectId) {
    const project = await getProject(projectId);
    if (!project) return false;
    if (Number(project.authorid) === Number(userId)) return true;
    const scopes = await getCollabScopes(userId, project.id);
    return scopeSatisfies(scopes, "project:manage");
}

/** 是否为项目作者或在册协作者（用于成员名单可见性）。 */
export async function isProjectMemberOrOwner(userId, projectId) {
    const project = await getProject(projectId);
    if (!project) return false;
    if (Number(project.authorid) === Number(userId)) return true;
    const scopes = await getCollabScopes(userId, project.id);
    return scopes.length > 0;
}

/**
 * 计算当前用户对某项目的访问能力，供顶栏子菜单等 UI 按权限加载。
 * 可按 projectId 或 namespace(authorname + projectname) 定位。
 * 私有项目且无权访问时返回 null（视为不存在，避免泄露）。
 */
export async function getMyProjectAccess(userId, { projectId, authorname, projectname } = {}) {
    let project = null;
    if (projectId) {
        const id = Number(projectId);
        if (Number.isInteger(id) && id > 0) {
            project = await prisma.ow_projects.findUnique({
                where: { id },
                select: { id: true, authorid: true, state: true },
            });
        }
    } else if (authorname && projectname) {
        const author = await prisma.ow_users.findUnique({
            where: { username: String(authorname) },
            select: { id: true },
        });
        if (author) {
            project = await prisma.ow_projects.findFirst({
                where: { name: String(projectname), authorid: author.id },
                select: { id: true, authorid: true, state: true },
            });
        }
    }
    if (!project) return null;

    const uid = Number(userId) || 0;
    const isOwner = uid > 0 && Number(project.authorid) === uid;
    if (isOwner) {
        return {
            project_id: project.id,
            is_owner: true,
            role_key: "owner",
            can_read: true,
            can_edit: true,
            can_manage: true,
        };
    }

    const isPublic = project.state === "public";
    const scopes = uid > 0 ? await getCollabScopes(uid, project.id) : [];
    const canReadViaCollab = scopeSatisfies(scopes, "project:read");
    if (!isPublic && !canReadViaCollab) return null; // 私有且无权访问：当作不存在

    const canManage = scopeSatisfies(scopes, "project:manage");
    const canEdit = scopeSatisfies(scopes, "project:update");
    const roleKey = canManage
        ? "project_manager"
        : canEdit
            ? "project_editor"
            : canReadViaCollab
                ? "project_viewer"
                : null;

    return {
        project_id: project.id,
        is_owner: false,
        role_key: roleKey,
        can_read: isPublic || canReadViaCollab,
        can_edit: canEdit,
        can_manage: canManage,
    };
}

function formatProjectSummary(project) {
    if (!project) return null;
    return {
        id: project.id,
        name: project.name,
        title: project.title,
        state: project.state,
        type: project.type,
        author: project.author
            ? { username: project.author.username, display_name: project.author.display_name }
            : undefined,
    };
}

function formatInvitation(invitation) {
    return {
        id: invitation.id,
        project_id: invitation.project_id,
        role_key: invitation.role_key,
        role_label: COLLABORATION_ROLE_LABELS[invitation.role_key] || invitation.role_key,
        status: invitation.status,
        message: invitation.message,
        created_at: invitation.created_at,
        expires_at: invitation.expires_at,
        responded_at: invitation.responded_at,
        project: formatProjectSummary(invitation.project),
        inviter: invitation.inviter
            ? {
                id: invitation.inviter.id,
                username: invitation.inviter.username,
                display_name: invitation.inviter.display_name,
                avatar: invitation.inviter.avatar,
            }
            : undefined,
        invitee: invitation.invitee
            ? {
                id: invitation.invitee.id,
                username: invitation.invitee.username,
                display_name: invitation.invitee.display_name,
                avatar: invitation.invitee.avatar,
            }
            : undefined,
    };
}

/** 邀请合作者。 */
export async function inviteCollaborator({ projectId, inviterId, inviteeIdentifier, roleKey, message }) {
    const project = await getProject(projectId);
    if (!project) throw new CollaborationError("项目不存在", 404);
    if (!isCollaborationRole(roleKey)) throw new CollaborationError("无效的协作角色", 400);
    if (!(await canManageCollaborators(inviterId, project.id))) {
        throw new CollaborationError("无权管理该项目的合作者", 403);
    }

    const invitee = await resolveUser(inviteeIdentifier);
    if (!invitee || invitee.status !== "active") throw new CollaborationError("找不到该用户", 404);
    if (Number(invitee.id) === Number(project.authorid)) {
        throw new CollaborationError("项目作者无需被邀请", 400);
    }
    if (Number(invitee.id) === Number(inviterId)) {
        throw new CollaborationError("不能邀请自己", 400);
    }

    const existingScopes = await getUserResourceRoleScopes(invitee.id, PROJECT_TARGET_TYPE, String(project.id));
    if (existingScopes.length > 0) throw new CollaborationError("该用户已是项目合作者", 409);

    const pending = await prisma.ow_project_collaboration_invitations.findFirst({
        where: { project_id: project.id, invitee_id: invitee.id, status: "pending" },
    });
    if (pending) throw new CollaborationError("已有待处理的邀请", 409);

    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const invitation = await prisma.ow_project_collaboration_invitations.create({
        data: {
            project_id: project.id,
            inviter_id: Number(inviterId),
            invitee_id: invitee.id,
            role_key: roleKey,
            status: "pending",
            message: message ? String(message).slice(0, 500) : null,
            expires_at: expiresAt,
        },
    });

    const inviter = await prisma.ow_users.findUnique({
        where: { id: Number(inviterId) },
        select: { username: true, display_name: true },
    });
    const inviterName = inviter?.display_name || inviter?.username || "有人";
    const projectName = project.title || project.name;
    await safeNotify({
        userId: invitee.id,
        notificationType: "project_collaboration_invitation",
        title: "项目合作邀请",
        content: `${inviterName} 邀请你以「${COLLABORATION_ROLE_LABELS[roleKey]}」身份参与项目《${projectName}》`,
        link: COLLABORATIONS_LINK,
        data: {
            invitation_id: invitation.id,
            project_id: project.id,
            project_name: projectName,
            role_key: roleKey,
            inviter_id: Number(inviterId),
            inviter_name: inviterName,
        },
    });

    return formatInvitation({ ...invitation, project, inviter, invitee });
}

/** 受邀者接受 / 拒绝邀请。 */
export async function respondToInvitation({ invitationId, userId, accept }) {
    const invitation = await prisma.ow_project_collaboration_invitations.findUnique({
        where: { id: Number(invitationId) },
    });
    if (!invitation) throw new CollaborationError("邀请不存在", 404);
    if (Number(invitation.invitee_id) !== Number(userId)) {
        throw new CollaborationError("无权处理该邀请", 403);
    }
    if (invitation.status !== "pending") throw new CollaborationError("邀请已被处理", 409);
    if (invitation.expires_at && invitation.expires_at < new Date()) {
        await prisma.ow_project_collaboration_invitations.update({
            where: { id: invitation.id },
            data: { status: "expired", responded_at: new Date() },
        });
        throw new CollaborationError("邀请已过期", 410);
    }

    if (!accept) {
        await prisma.ow_project_collaboration_invitations.update({
            where: { id: invitation.id },
            data: { status: "declined", responded_at: new Date() },
        });
        return { status: "declined" };
    }

    await prisma.$transaction(async (tx) => {
        await tx.ow_project_collaboration_invitations.update({
            where: { id: invitation.id },
            data: { status: "accepted", responded_at: new Date() },
        });
        await assignScopedRole(invitation.invitee_id, invitation.role_key, {
            targetType: PROJECT_TARGET_TYPE,
            targetId: String(invitation.project_id),
            grantType: COLLABORATION_GRANT_TYPE,
            assignedBy: invitation.inviter_id,
            reason: "project-collaboration",
            metadata: { invitation_id: invitation.id },
            db: tx,
        });
    });

    const project = await getProject(invitation.project_id);
    const responder = await prisma.ow_users.findUnique({
        where: { id: Number(userId) },
        select: { username: true, display_name: true },
    });
    const responderName = responder?.display_name || responder?.username || "对方";
    await safeNotify({
        userId: invitation.inviter_id,
        notificationType: "project_collaboration_accepted",
        title: "合作邀请已被接受",
        content: `${responderName} 接受了你的项目《${project?.title || project?.name || ""}》合作邀请`,
        link: COLLABORATIONS_LINK,
        data: { project_id: invitation.project_id, invitee_id: Number(userId), role_key: invitation.role_key },
    });

    return { status: "accepted", role_key: invitation.role_key };
}

/** 受邀者：我收到的待处理邀请。 */
export async function listReceivedInvitations(userId) {
    const rows = await prisma.ow_project_collaboration_invitations.findMany({
        where: {
            invitee_id: Number(userId),
            status: "pending",
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        orderBy: { created_at: "desc" },
        include: {
            project: {
                select: {
                    id: true, name: true, title: true, state: true, type: true,
                    author: { select: { username: true, display_name: true } },
                },
            },
            inviter: { select: { id: true, username: true, display_name: true, avatar: true } },
        },
    });
    return rows.map(formatInvitation);
}

/** 项目作者/成员：成员名单 + 待处理邀请。 */
export async function listProjectMembers(projectId) {
    const project = await getProject(projectId);
    if (!project) throw new CollaborationError("项目不存在", 404);

    const grants = await listResourceGrants(PROJECT_TARGET_TYPE, String(project.id));
    const collaborators = grants
        .filter((grant) => isCollaborationRole(grant.role_key))
        .map((grant) => ({
            user_id: grant.user_id,
            user: grant.user,
            role_key: grant.role_key,
            role_label: COLLABORATION_ROLE_LABELS[grant.role_key] || grant.role_name,
            grant_type: grant.grant_type,
            assigned_by_user: grant.assigned_by_user,
            created_at: grant.created_at,
        }));

    const invitationRows = await prisma.ow_project_collaboration_invitations.findMany({
        where: {
            project_id: project.id,
            status: "pending",
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        orderBy: { created_at: "desc" },
        include: { invitee: { select: { id: true, username: true, display_name: true, avatar: true } } },
    });

    return {
        project: {
            id: project.id,
            name: project.name,
            title: project.title,
            authorid: project.authorid,
        },
        collaborators,
        invitations: invitationRows.map(formatInvitation),
    };
}

/** 作者/管理员：修改某成员的协作角色。 */
export async function updateMemberRole({ projectId, actorId, memberUserId, roleKey }) {
    const project = await getProject(projectId);
    if (!project) throw new CollaborationError("项目不存在", 404);
    if (!isCollaborationRole(roleKey)) throw new CollaborationError("无效的协作角色", 400);
    if (!(await canManageCollaborators(actorId, project.id))) {
        throw new CollaborationError("无权管理该项目的合作者", 403);
    }
    if (Number(memberUserId) === Number(project.authorid)) {
        throw new CollaborationError("不能修改项目作者", 400);
    }

    await prisma.$transaction(async (tx) => {
        for (const key of COLLABORATION_ROLE_KEYS) {
            if (key !== roleKey) {
                await revokeScopedRole(memberUserId, key, {
                    targetType: PROJECT_TARGET_TYPE,
                    targetId: String(project.id),
                    db: tx,
                });
            }
        }
        await assignScopedRole(memberUserId, roleKey, {
            targetType: PROJECT_TARGET_TYPE,
            targetId: String(project.id),
            grantType: COLLABORATION_GRANT_TYPE,
            assignedBy: Number(actorId),
            reason: "project-collaboration-role-update",
            db: tx,
        });
    });

    return { user_id: Number(memberUserId), role_key: roleKey };
}

async function revokeAllCollaborationRoles(tx, userId, projectId) {
    for (const key of COLLABORATION_ROLE_KEYS) {
        await revokeScopedRole(userId, key, {
            targetType: PROJECT_TARGET_TYPE,
            targetId: String(projectId),
            db: tx,
        });
    }
}

/** 作者/管理员：移除成员。 */
export async function removeMember({ projectId, actorId, memberUserId }) {
    const project = await getProject(projectId);
    if (!project) throw new CollaborationError("项目不存在", 404);
    if (!(await canManageCollaborators(actorId, project.id))) {
        throw new CollaborationError("无权管理该项目的合作者", 403);
    }
    if (Number(memberUserId) === Number(project.authorid)) {
        throw new CollaborationError("不能移除项目作者", 400);
    }
    await prisma.$transaction((tx) => revokeAllCollaborationRoles(tx, memberUserId, project.id));
    return { user_id: Number(memberUserId) };
}

/** 协作者：主动离开项目（自助解除）。 */
export async function leaveProject({ projectId, userId }) {
    const project = await getProject(projectId);
    if (!project) throw new CollaborationError("项目不存在", 404);
    if (Number(project.authorid) === Number(userId)) {
        throw new CollaborationError("项目作者不能离开自己的项目", 400);
    }
    await prisma.$transaction((tx) => revokeAllCollaborationRoles(tx, userId, project.id));
    return { project_id: project.id };
}

/** 作者/管理员：取消待处理邀请。 */
export async function cancelInvitation({ projectId, actorId, invitationId }) {
    const invitation = await prisma.ow_project_collaboration_invitations.findUnique({
        where: { id: Number(invitationId) },
    });
    if (!invitation || Number(invitation.project_id) !== Number(projectId)) {
        throw new CollaborationError("邀请不存在", 404);
    }
    if (!(await canManageCollaborators(actorId, projectId))) {
        throw new CollaborationError("无权管理该项目的合作者", 403);
    }
    if (invitation.status !== "pending") throw new CollaborationError("邀请已被处理", 409);

    await prisma.ow_project_collaboration_invitations.update({
        where: { id: invitation.id },
        data: { status: "cancelled", responded_at: new Date() },
    });
    return { id: invitation.id, status: "cancelled" };
}

/** 协作者：我参与协作的项目（自助管理）。 */
export async function listMyCollaborations(userId) {
    const grants = await listUserScopedGrants(userId, { grantType: COLLABORATION_GRANT_TYPE });
    const projectGrants = grants.filter(
        (grant) => grant.target_type === PROJECT_TARGET_TYPE && isCollaborationRole(grant.role_key)
    );
    const projectIds = [...new Set(projectGrants.map((grant) => Number(grant.target_id)).filter(Boolean))];
    const projects = projectIds.length
        ? await prisma.ow_projects.findMany({
            where: { id: { in: projectIds } },
            select: {
                id: true, name: true, title: true, state: true, type: true,
                author: { select: { username: true, display_name: true } },
            },
        })
        : [];
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    return projectGrants.map((grant) => ({
        grant_id: grant.id,
        role_key: grant.role_key,
        role_label: COLLABORATION_ROLE_LABELS[grant.role_key] || grant.role_name,
        granted_at: grant.created_at,
        project: formatProjectSummary(projectMap.get(Number(grant.target_id))) || { id: Number(grant.target_id) },
    }));
}

export default {
    PROJECT_TARGET_TYPE,
    COLLABORATION_GRANT_TYPE,
    COLLABORATION_ROLE_LABELS,
    CollaborationError,
    getCollabScopes,
    userCanActOnProject,
    canManageCollaborators,
    isProjectMemberOrOwner,
    getMyProjectAccess,
    inviteCollaborator,
    respondToInvitation,
    listReceivedInvitations,
    listProjectMembers,
    updateMemberRole,
    removeMember,
    leaveProject,
    cancelInvitation,
    listMyCollaborations,
};
