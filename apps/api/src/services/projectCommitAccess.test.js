import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
mock.module('./prisma.js', { namedExports: { prisma: {} } });
const { findProjectCommit } = await import('./projectCommitAccess.js');
const commits = [
    { id: 'fork-tip', project_id: 99, parent_commit_id: 'source-ancestor' },
    { id: 'source-ancestor', project_id: 99, parent_commit_id: null },
    { id: 'unrelated', project_id: 99, parent_commit_id: null },
];
const db = {
    ow_projects_branch: { findMany: async () => [{ latest_commit_hash: 'fork-tip' }] },
    ow_projects_commits: { findUnique: async ({ where }) => commits.find((commit) => commit.id === where.id) || null },
};
test('permits retained source history reachable from a visible fork branch', async () => {
    assert.equal((await findProjectCommit(7, 'source-ancestor', 'main', { db })).project_id, 99);
});
test('rejects unrelated commits even when they belong to the same original project', async () => {
    assert.equal(await findProjectCommit(7, 'unrelated', 'main', { db }), null);
});
test('terminates on cyclic commit history', async () => {
    const cyclic = { ...db, ow_projects_commits: { findUnique: async ({ where }) => ({ id: where.id, parent_commit_id: where.id }) } };
    assert.equal(await findProjectCommit(7, 'absent', null, { db: cyclic }), null);
});
