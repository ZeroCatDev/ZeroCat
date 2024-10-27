const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

(async () => {
  try {
    // 获取所有项目
    const projects = await prisma.ow_projects.findMany({});

    // 遍历项目，计算哈希并更新数据库
    for (const project of projects) {
      if (isHash256(project.source)) {
        console.log("Source is a valid hash, processing as hash...");
        continue;
      }
      var source = processSource(project.source);
      const hash = calculateHash(source);

      var devsource = processSource(project.devsource);
      const devhash = calculateHash(devsource);

      console.log(`Hash for project ${project.id} source: ${hash}`);
      console.log(`Hash for project ${project.id} devsource: ${devhash}`);

      // 插入或更新 `ow_projects_file` 表
      await upsertProjectFile(hash, source);
      // 插入或更新 `ow_projects_file` 表
      await upsertProjectFile(devhash, devsource);

      // 更新 `ow_projects` 表
      await updateProjectSource(project.id, hash);
      // 更新 `ow_projects` 表
      await updateProjectDevsource(project.id, devhash);
      console.log(`Project ${project.id} processed successfully.`);
    }

    console.log("All projects processed.");
  } catch (error) {
    console.error("Error processing projects:", error);
  } finally {
    // 关闭数据库连接
    await prisma.$disconnect();
  }
})();

// 计算 SHA-256 哈希值
function calculateHash(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

// 插入或更新 `ow_projects_file` 表
async function upsertProjectFile(hash, source) {
  try {
    await prisma.ow_projects_file.upsert({
      where: { sha256: hash },
      update: { sha256: hash, source: String(source) },
      create: { sha256: hash, source: String(source) },
    });
  } catch (error) {
    console.error(`Error in upserting project file for hash ${hash}:`, error);
  }
}

// 更新 `ow_projects` 表中的 `source` 字段
async function updateProjectSource(projectId, hash) {
  try {
    await prisma.ow_projects.update({
      where: { id: projectId },
      data: { source: hash },
    });
  } catch (error) {
    console.error(`Error in updating project ${projectId}:`, error);
  }
}
// 更新 `ow_projects` 表中的 `devsource` 字段
async function updateProjectDevsource(projectId, hash) {
  try {
    await prisma.ow_projects.update({
      where: { id: projectId },
      data: { devsource: hash },
    });
  } catch (error) {
    console.error(`Error in updating project ${projectId}:`, error);
  }
}

// 检查是否为哈希值
function isHash256(str) {
  const sha256Regex = /^[a-fA-F0-9]{64}$/;
  return sha256Regex.test(str);
}

function processSource(source) {
  // 判断是否为 JSON 格式
  if (isJson(source)) {
    console.log("Source is valid JSON, processing as JSON...");
    // 对 JSON 字符串进行处理，例如将其转换为字符串
    return JSON.stringify(JSON.parse(source));
  } else {
    console.log("Source is not JSON, processing as a regular string...");
    // 直接处理非 JSON 字符串
    return String(source);
  }
}

// 判断是否为有效 JSON
function isJson(str) {
  try {
    JSON.parse(str); // 如果能成功解析，说明是合法的 JSON
    return true;
  } catch (error) {
    return false; // 如果解析失败，说明不是 JSON
  }
}
