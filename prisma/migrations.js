import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

/**
 * 执行数据库迁移
 */
async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');

    // 读取SQL迁移文件
    const sqlFile = path.join(__dirname, 'migrations', 'auth_tokens_setup.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 分割SQL语句
    const statements = sql
      .split(';')
      .filter(statement => statement.trim() !== '')
      .map(statement => statement.trim() + ';');

    // 执行每条SQL语句
    for (const statement of statements) {
      console.log(`执行SQL: ${statement.substring(0, 100)}...`);
      await prisma.$executeRawUnsafe(statement);
    }

    console.log('数据库迁移完成!');

    // 验证表是否创建成功
    await validateMigration();

  } catch (error) {
    console.error('数据库迁移失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 验证迁移是否成功
 */
async function validateMigration() {
  try {
    // 检查用户设备表
    const devicesTable = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'ow_user_devices'
    `;

    // 检查认证令牌表
    const tokensTable = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'ow_auth_tokens'
    `;

    // 检查配置项
    const configEntries = await prisma.ow_config.findMany({
      where: {
        key: {
          in: ['security.accessTokenExpiry', 'security.refreshTokenExpiry']
        }
      }
    });

    console.log('验证结果:');
    console.log(`- 用户设备表: ${devicesTable[0].count > 0 ? '已创建' : '未创建'}`);
    console.log(`- 认证令牌表: ${tokensTable[0].count > 0 ? '已创建' : '未创建'}`);
    console.log(`- 配置项: 已添加 ${configEntries.length} 个`);

  } catch (error) {
    console.error('验证迁移失败:', error);
  }
}

// 执行迁移
runMigration();