import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

// 确保migrations目录存在
const migrationsDir = path.join(__dirname, 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir);
}

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 提示用户确认
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * 使用Prisma CLI执行迁移
 */
async function runPrismaMigration() {
  try {
    console.log('开始Prisma迁移流程...');

    // 1. 使用Prisma模型生成迁移
    console.log('正在生成迁移...');

    const answer = await question('是否确认执行Prisma迁移? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('已取消迁移');
      rl.close();
      return;
    }

    try {
      // 生成迁移文件
      const { stdout: createMigrationOutput } = await execAsync(
        'npx prisma migrate dev --name add_auth_tokens_system --create-only'
      );
      console.log(createMigrationOutput);

      // 确认迁移
      const confirmMigration = await question('查看生成的迁移文件后，是否确认应用迁移? (y/n): ');
      if (confirmMigration.toLowerCase() !== 'y') {
        console.log('已取消应用迁移');
        rl.close();
        return;
      }

      // 应用迁移
      const { stdout: applyMigrationOutput } = await execAsync('npx prisma migrate deploy');
      console.log(applyMigrationOutput);

      // 更新Prisma客户端
      const { stdout: generateOutput } = await execAsync('npx prisma generate');
      console.log(generateOutput);

      console.log('Prisma迁移成功完成!');

    } catch (execError) {
      console.error('执行Prisma命令时出错:', execError.message);
      console.log('尝试使用手动SQL迁移...');

      // 如果Prisma迁移失败，尝试使用手动SQL迁移
      const manualSql = await question('是否使用手动SQL迁移? (y/n): ');
      if (manualSql.toLowerCase() === 'y') {
        console.log('请使用 node prisma/migrations.js 执行手动SQL迁移');
      }
    }
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    rl.close();
  }
}

// 执行迁移
runPrismaMigration();