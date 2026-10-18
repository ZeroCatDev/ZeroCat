import {prisma} from "../prisma.js";

export async function hasProjectPermission(projectId, userId, permission) {
    const project = await prisma.ow_projects.findFirst({
        where: {id: Number(projectId)},
    });

    if (!project) {
        return false;
    }

    const { canViewContent } = await import("../moderation/visibility.js");
    if (!await canViewContent("project", project, userId)) return false;
    if (!userId) return permission === "read" && project.state === "public";
    const action = permission === "write" ? "update" : permission;
    if (!["read", "create", "update", "delete", "interact", "manage"].includes(action)) return false;
    const { authorize } = await import("./authorization.js");
    return (await authorize({
        userId, requiredScope: `project:${project.id}:${action}`, tokenType: "session",
    })).allowed;
}
