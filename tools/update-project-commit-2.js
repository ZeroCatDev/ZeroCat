import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

async function updateProjectBranches() {
  try {
    const projects = await prisma.ow_projects.findMany();
    const totalProjects = projects.length;
    let processedProjects = 0;

    for (const project of projects) {
      try {
        const latestCommit = await prisma.ow_projects_commits.findFirst({
          where: { project_id: project.id },
          orderBy: { commit_date: "desc" },
        });

        if (latestCommit) {
          await prisma.ow_projects_branch.create({
            data: {
              projectid: project.id,
              name: project.default_branch,
              latest_commit_hash: latestCommit.id,
              description: "自动迁移",
              creator: 0,
            },
          });
        }

        processedProjects++;
        console.log(`Processed ${processedProjects}/${totalProjects} projects`);
      } catch (err) {
        logger.error(`Error processing project ID ${project.id}:`, err);
        continue;
      }
    }

    console.log("Project branches update completed.");
  } catch (err) {
    logger.error("Error updating project branches:", err);
  }
}

updateProjectBranches();
