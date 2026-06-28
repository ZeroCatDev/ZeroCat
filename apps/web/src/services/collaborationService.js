import request from "@/axios/axios";

// 项目合作者 API 封装。成功返回后端 { status, data, message } 信封；失败抛出由调用方捕获。

// ---- 项目级管理 ----

export async function getProjectMembers(projectId) {
  const { data } = await request.get(`/collaboration/projects/${projectId}/members`);
  return data;
}

export async function inviteCollaborator(projectId, { username, userId, roleKey, message }) {
  const { data } = await request.post(`/collaboration/projects/${projectId}/invitations`, {
    username,
    user_id: userId,
    role_key: roleKey,
    message,
  });
  return data;
}

export async function updateMemberRole(projectId, userId, roleKey) {
  const { data } = await request.patch(
    `/collaboration/projects/${projectId}/members/${userId}`,
    { role_key: roleKey }
  );
  return data;
}

export async function removeMember(projectId, userId) {
  const { data } = await request.delete(`/collaboration/projects/${projectId}/members/${userId}`);
  return data;
}

export async function cancelInvitation(projectId, invitationId) {
  const { data } = await request.delete(
    `/collaboration/projects/${projectId}/invitations/${invitationId}`
  );
  return data;
}

// ---- 自助 ----

// 当前用户对某项目的访问能力（顶栏子菜单按权限加载用）。
export async function getMyProjectAccess({ projectId, author, project } = {}) {
  const params = {};
  if (projectId) params.project_id = projectId;
  if (author) params.author = author;
  if (project) params.project = project;
  try {
    const { data } = await request.get(`/collaboration/my-access`, { params });
    return data?.data || null;
  } catch {
    return null;
  }
}

export async function getCollaborationRoles() {
  const { data } = await request.get(`/collaboration/roles`);
  return data?.data?.roles || [];
}

export async function getMyInvitations() {
  const { data } = await request.get(`/collaboration/invitations`);
  return data?.data?.invitations || [];
}

export async function acceptInvitation(invitationId) {
  const { data } = await request.post(`/collaboration/invitations/${invitationId}/accept`);
  return data;
}

export async function declineInvitation(invitationId) {
  const { data } = await request.post(`/collaboration/invitations/${invitationId}/decline`);
  return data;
}

export async function getMyCollaborations() {
  const { data } = await request.get(`/collaboration/memberships`);
  return data?.data?.memberships || [];
}

export async function leaveProject(projectId) {
  const { data } = await request.delete(`/collaboration/memberships/${projectId}`);
  return data;
}

export default {
  getProjectMembers,
  inviteCollaborator,
  updateMemberRole,
  removeMember,
  cancelInvitation,
  getMyProjectAccess,
  getCollaborationRoles,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  getMyCollaborations,
  leaveProject,
};
