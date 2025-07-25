import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function calculateDepth(commitId, cache = new Map()) {
    // 如果已经计算过这个提交的深度，直接返回缓存的结果
    if (cache.has(commitId)) {
        return cache.get(commitId);
    }

    const commit = await prisma.ow_projects_commits.findUnique({
        where: { id: commitId },
        select: { parent_commit_id: true }
    });

    // 如果是根提交（没有父提交），深度为0
    if (!commit || !commit.parent_commit_id) {
        cache.set(commitId, 0);
        return 0;
    }

    // 递归计算父提交的深度，当前提交的深度为父提交深度+1
    const parentDepth = await calculateDepth(commit.parent_commit_id, cache);
    const depth = parentDepth + 1;
    cache.set(commitId, depth);
    return depth;
}

async function main() {
    console.log('开始更新提交深度...');

    // 获取所有提交
    const commits = await prisma.ow_projects_commits.findMany({
        select: { id: true }
    });

    console.log(`找到 ${commits.length} 个提交需要更新`);

    // 用于缓存已计算的深度，避免重复计算
    const depthCache = new Map();

    // 批量计算每个提交的深度
    for (const commit of commits) {
        const depth = await calculateDepth(commit.id, depthCache);

        // 更新提交的深度
        await prisma.ow_projects_commits.update({
            where: { id: commit.id },
            data: { depth }
        });
    }

    console.log('提交深度更新完成');
}

main()
    .catch((e) => {
        console.error('迁移出错:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });