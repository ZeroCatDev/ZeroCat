import { prisma } from "../utils/global.js";
import logger from "../utils/logger.js";

async function updateProjectNames() {
  try {
    logger.info("开始更新项目名称...");
    const projects = await prisma.ow_projects.findMany({
      select: { id: true },
    });

    for (const project of projects) {
      await prisma.ow_projects.update({
        where: { id: project.id },
        data: { name: String(project.id) },
      });
      logger.info(`项目ID ${project.id} 的名称已更新为 ${project.id}`);
    }

    logger.info("项目名称更新成功");
  } catch (err) {
    logger.error("更新项目名称时出错:", err);
  } finally {
    await prisma.$disconnect();
  }
}

await updateProjectNames();
