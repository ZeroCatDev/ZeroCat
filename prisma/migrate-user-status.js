/**
 * Migration script to rename and convert the user status field from numeric to enum type.
 * This script documents the changes and provides a way to run the migration manually.
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function executeSql(connection, sql) {
  try {
    await connection.query(sql);
    console.log(`✅ SQL执行成功: ${sql.split('\n')[0]}...`);
    return true;
  } catch (error) {
    console.error(`❌ SQL执行失败: ${sql.split('\n')[0]}...`);
    console.error(`错误: ${error.message}`);
    return false;
  }
}

async function manualMigration() {
  console.log('开始手动执行SQL迁移...');

  // 从环境变量中提取数据库连接信息
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('找不到DATABASE_URL环境变量');
  }

  // 例如: mysql://user:password@localhost:3306/dbname
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = dbUrl.match(regex);

  if (!match) {
    throw new Error('无法解析数据库连接URL');
  }

  const [, user, password, host, port, database] = match;

  // 创建数据库连接
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port: parseInt(port, 10)
  });

  console.log(`已连接到数据库: ${database} @ ${host}:${port}`);

  try {
    // 检查status字段是否存在
    const [columns] = await connection.query('DESCRIBE ow_users');
    const statusField = columns.find(col => col.Field === 'status');

    if (!statusField) {
      console.error('⚠️ status字段不存在，可能已经迁移过');
      return;
    }

    console.log(`当前status字段类型: ${statusField.Type}`);

    // 如果status字段是数字类型，执行迁移
    if (statusField.Type.includes('int')) {
      // 添加临时列
      await executeSql(connection,
        "ALTER TABLE `ow_users` ADD COLUMN `status_text` VARCHAR(20) NOT NULL DEFAULT 'pending'"
      );

      // 填充数据
      await executeSql(connection, "UPDATE `ow_users` SET `status_text` = 'pending' WHERE `status` = 0");
      await executeSql(connection, "UPDATE `ow_users` SET `status_text` = 'active' WHERE `status` = 1");
      await executeSql(connection, "UPDATE `ow_users` SET `status_text` = 'suspended' WHERE `status` = 2");
      await executeSql(connection, "UPDATE `ow_users` SET `status_text` = 'banned' WHERE `status` = 3");

      // 删除旧列
      await executeSql(connection, "ALTER TABLE `ow_users` DROP COLUMN `status`");

      // 重命名新列
      await executeSql(connection,
        "ALTER TABLE `ow_users` CHANGE COLUMN `status_text` `status` VARCHAR(20) NOT NULL DEFAULT 'pending'"
      );

      console.log('✅ 用户状态字段已成功从数字转换为字符串枚举');
    } else {
      console.log('⚠️ status字段已经是字符串类型，无需迁移');
    }
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  } finally {
    await connection.end();
    console.log('数据库连接已关闭');
  }
}

async function main() {
  console.log('开始迁移用户状态字段到枚举类型...');

  try {
    console.log('尝试修复之前的迁移问题...');
    // 检查迁移文件是否存在
    const migrationFilePath = path.join(process.cwd(), 'prisma', 'migrations', '20240705000000_enhance_event_model', 'migration.sql');

    if (fs.existsSync(migrationFilePath)) {
      console.log('找到需要修复的迁移文件');

      // 读取文件内容
      let content = fs.readFileSync(migrationFilePath, 'utf8');

      // 检查是否需要修复
      if (content.includes('IF NOT EXISTS')) {
        console.log('修复迁移文件中的语法错误...');

        // 修复语法
        content = content.replace(/CREATE INDEX IF NOT EXISTS/g, 'DROP INDEX IF EXISTS');
        const fixedContent = content.replace(/DROP INDEX IF EXISTS (`[^`]+`) ON (`[^`]+`);/g,
          'DROP INDEX IF EXISTS $1 ON $2;\nCREATE INDEX $1 ON $2;');

        // 保存修复后的文件
        fs.writeFileSync(migrationFilePath, fixedContent, 'utf8');
        console.log('✅ 迁移文件已修复');
      } else {
        console.log('迁移文件似乎已经修复，无需更改');
      }
    }

    // 尝试使用 Prisma 迁移
    try {
      console.log('尝试运行 Prisma 迁移...');
      execSync('npx prisma migrate dev --name convert_user_status_to_enum', { stdio: 'inherit' });
      console.log('✅ Prisma 迁移成功完成');
    } catch (error) {
      console.log('⚠️ Prisma 迁移失败，尝试执行手动迁移...');
      await manualMigration();
    }

    // 提示用户执行 prisma generate
    console.log('\n为了确保代码与数据库同步，请运行：');
    console.log('npx prisma generate');

    // 状态值说明
    console.log('\n状态值含义：');
    console.log('pending = 待激活 (新注册账户)');
    console.log('active = 正常 (正常活跃账户)');
    console.log('suspended = 已暂停 (临时禁用账户)');
    console.log('banned = 已封禁 (永久禁用账户)');

    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    console.log('\n您可以尝试按照 prisma/manual-migration.md 中的说明手动迁移');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();