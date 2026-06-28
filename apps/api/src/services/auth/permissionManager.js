import {prisma} from "../prisma.js";

export async function hasProjectPermission(projectId, userId, permission) {
    const project = await prisma.ow_projects.findFirst({
        where: {id: Number(projectId)},
    });

    if (!project) {
        return false;
    }

    if (permission === "read") {
        if (project.state === "public" || Number(project.authorid) === Number(userId)) {
            return true;
        }
    } else if (permission === "write") {
        if (Number(project.authorid) === Number(userId)) {
            return true;
        }
    }

    // 协作者放行：read 对任意在册协作者放行；write 需要 project:update（编辑者及以上）。
    if (userId && (permission === "read" || permission === "write")) {
        const [{ getCollabScopes }, { scopeSatisfies }] = await Promise.all([
            import("../projectCollaborationService.js"),
            import("./scopes.js"),
        ]);
        const scopes = await getCollabScopes(userId, project.id);
        if (permission === "read" && scopes.length > 0) {
            return true;
        }
        if (permission === "write" && scopeSatisfies(scopes, "project:update")) {
            return true;
        }
    }

    return false;
}
