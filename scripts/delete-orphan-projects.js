#!/usr/bin/env node

/**
 * Delete Orphan Projects Tool
 *
 * 识别以下项目并清理：
 * 1) 作者不存在的项目（authorid 不为空但关联用户不存在）
 * 2) id 为 0 的项目
 * 先导出到本地 JSON，再删除这些项目。
 *
 * Usage:
 *   node scripts/delete-orphan-projects.js
 *   node scripts/delete-orphan-projects.js --dry-run
 *   node scripts/delete-orphan-projects.js --limit 100
 *   node scripts/delete-orphan-projects.js --output migration-output/orphan-projects/custom.json
 */

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../apps/api/src/services/prisma.js";
import logger from "../apps/api/src/services/logger.js";

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (current === "--limit") {
      const value = Number(argv[index + 1]);
      index += 1;
      if (Number.isFinite(value) && value > 0) {
        args.limit = Math.floor(value);
      }
      continue;
    }

    if (current === "--output") {
      args.output = argv[index + 1] || null;
      index += 1;
      continue;
    }
  }

  return args;
}

function formatDateForFile(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolveOutputPath(customOutput) {
  if (customOutput) {
    return path.resolve(customOutput);
  }
  const filename = `orphan-projects-${formatDateForFile()}.json`;
  return path.resolve("migration-output", "orphan-projects", filename);
}

async function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function findOrphanProjects(limit = null) {
  return prisma.ow_projects.findMany({
    where: {
      OR: [
        {
          authorid: { not: null },
          author: { is: null },
        },
        {
          id: 0,
        },
      ],
    },
    orderBy: { id: "asc" },
    take: limit || undefined,
  });
}

async function exportProjectsToJson(filePath, projects, options) {
  const payload = {
    generatedAt: new Date().toISOString(),
    total: projects.length,
    dryRun: options.dryRun,
    limit: options.limit,
    projects,
  };

  await ensureDirectory(filePath);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function deleteProjectsByIds(projectIds) {
  if (projectIds.length === 0) {
    return { count: 0 };
  }

  return prisma.ow_projects.deleteMany({
    where: {
      id: { in: projectIds },
    },
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = resolveOutputPath(options.output);

  logger.info("[orphan-project-cleanup] 开始扫描异常项目（author 缺失或 id=0）");
  logger.info(`[orphan-project-cleanup] 参数: ${JSON.stringify(options)}`);

  const orphanProjects = await findOrphanProjects(options.limit);
  logger.info(`[orphan-project-cleanup] 找到 ${orphanProjects.length} 个孤儿项目`);

  await exportProjectsToJson(outputPath, orphanProjects, options);
  logger.info(`[orphan-project-cleanup] 已导出 JSON: ${outputPath}`);

  if (options.dryRun) {
    logger.info("[orphan-project-cleanup] dry-run 模式，未执行删除");
    return;
  }

  const projectIds = orphanProjects.map((item) => item.id);
  const result = await deleteProjectsByIds(projectIds);
  logger.info(`[orphan-project-cleanup] 删除完成，删除数量: ${result.count}`);
}

main()
  .catch((error) => {
    logger.error("[orphan-project-cleanup] 执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
