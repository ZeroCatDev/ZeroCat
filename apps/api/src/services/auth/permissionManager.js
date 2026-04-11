import {prisma} from "../prisma.js";

export async function hasProjectPermission(projectId, userId, permission) {
    const project = await prisma.ow_projects.findFirst({
        where: {id: Number(projectId)},
    });

    if (!project) {
        return false;
    }

    if (permission === "read") {
        if (project.state === "public" || project.authorid === userId) {
            return true;
        }
    } else if (permission === "write") {
        if (project.authorid === userId) {
            return true;
        }
    }

    return false;
}
