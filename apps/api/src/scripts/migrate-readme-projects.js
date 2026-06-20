/**
 * 迁移脚本：将与用户名同名的项目类型改为 "readme"
 *
 * 查找 ow_projects 中 name 与作者 username 相同的项目，
 * 将其 type 从当前值更新为 "readme"。
 *
 * 用法：node apps/api/src/scripts/migrate-readme-projects.js
 */

import {prisma} from "../services/prisma.js";

async function main() {
  console.log("=== 迁移：标记 readme 项目 ===\n");

  // 查找所有有作者的项目，包含作者信息用于比较
  const projects = await prisma.ow_projects.findMany({
    where: { authorid: { not: null } },
    select: {
      id: true,
      name: true,
      type: true,
      author: { select: { username: true } },
    },
  });

  // 在 JS 中进行大小写不敏感的匹配
  const candidates = projects.filter(
    (p) => p.author?.username && p.name.toLowerCase() === p.author.username.toLowerCase()
  );

  if (candidates.length === 0) {
    console.log("没有找到与用户名同名的项目，无需迁移。");
    return;
  }

  console.log(`找到 ${candidates.length} 个与用户名同名的项目：\n`);
  for (const p of candidates) {
    console.log(`  - 项目 #${p.id} "${p.name}" (当前类型: ${p.type || "null"}, 作者: ${p.author.username})`);
  }

  // 将这些项目的 type 更新为 "readme"
  const projectIds = candidates.map((p) => p.id);
  const result = await prisma.ow_projects.updateMany({
    where: { id: { in: projectIds } },
    data: { type: "readme" },
  });

  console.log(`\n已将 ${result.count} 个项目的类型更新为 "readme"。`);
}

main()
  .catch((err) => {
    console.error("迁移失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
