import { prisma } from './prisma.js';

// Fork branches can retain commits created by the source project. Authorization belongs to the visible fork.
export async function findProjectCommit(projectId, commitId, branch = null, { db = prisma } = {}) {
    const branches = await db.ow_projects_branch.findMany({
        where: { projectid: Number(projectId), ...(branch ? { name: branch } : {}) },
        select: { latest_commit_hash: true },
    });
    const pending = branches.map((row) => row.latest_commit_hash).filter(Boolean);
    const seen = new Set();
    while (pending.length && seen.size < 10000) {
        const id = pending.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        const commit = await db.ow_projects_commits.findUnique({ where: { id } });
        if (!commit) continue;
        if (id === commitId) return commit;
        if (commit.parent_commit_id) pending.push(commit.parent_commit_id);
    }
    return null;
}
