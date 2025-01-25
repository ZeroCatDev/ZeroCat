import { prisma } from "../utils/global.js";
import { createHash } from "crypto";
import configManager from "../utils/configManager.js";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import { generateFileAccessToken } from "../utils/tokenManager.js";

async function createCommit(project, source, message, parent_commit_id = null) {
  const sha256 = source; // 直接使用传入的 source 作为 sha256

  // 创建文件记录
  await prisma.ow_projects_file.create({
    data: {
      sha256: sha256,
      source: source,
    },
  }).catch((err) => {
    if (err.code === "P2002") {
      logger.debug("File already exists, skipping.");
    } else {
      logger.error(err);
    }
  });

  // 计算提交的哈希值作为 id
  const commitContent = JSON.stringify({
    userid: project.authorid,
    project_id: project.id,
    project_branch: "main",
    source_sha256: sha256,
    commit_message: message,
    parent_commit: parent_commit_id,
    timestamp: Date.now(),
  });
  const commitId = createHash("sha256").update(commitContent).digest("hex");

  // 创建提交记录
  const result = await prisma.ow_projects_commits.create({
    data: {
      id: commitId,
      project_id: project.id,
      author_id: project.authorid,
      branch: "main",
      commit_file: sha256,
      commit_message: message,
      parent_commit_id: parent_commit_id,
      commit_date: new Date(),
    },
  });

  return result.id;
}

async function main() {
  const projects = await prisma.ow_projects.findMany();
  const totalProjects = projects.length;
  let processedProjects = 0;

  for (const project of projects) {
    try {
      let parent_commit_id = null;

      // 创建 source 提交
      if (project.source) {
        parent_commit_id = await createCommit(project, project.source, "自动迁移的项目当前生产环境代码");
      }

      // 创建 devsource 提交
      if (project.devsource) {
        await createCommit(project, project.devsource, "自动迁移的项目最后一次开发环境代码", parent_commit_id);
      }

      processedProjects++;
      logger.info(`Processed ${processedProjects}/${totalProjects} projects.`);
    } catch (err) {
      logger.error(`Error processing project ID ${project.id}:`, err);
    }
  }
}

main().catch((err) => {
  logger.error("Error in script execution:", err);
}).finally(async () => {
  await prisma.$disconnect();
});
