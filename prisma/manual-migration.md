# 手动数据库迁移指南

由于自动迁移脚本遇到了语法错误问题（与先前的迁移文件冲突），您可以按照以下步骤手动执行迁移：

## MySQL 命令行执行迁移

1. 连接到您的数据库：
```sql
mysql -u 用户名 -p 数据库名
```

2. 执行以下 SQL 命令来将用户状态从数字转换为字符串：
```sql
-- 添加临时列
ALTER TABLE `ow_users` ADD COLUMN `status_text` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 填充数据
UPDATE `ow_users` SET `status_text` = 'pending' WHERE `status` = 0;
UPDATE `ow_users` SET `status_text` = 'active' WHERE `status` = 1;
UPDATE `ow_users` SET `status_text` = 'suspended' WHERE `status` = 2;
UPDATE `ow_users` SET `status_text` = 'banned' WHERE `status` = 3;

-- 删除旧列
ALTER TABLE `ow_users` DROP COLUMN `status`;

-- 重命名新列
ALTER TABLE `ow_users` CHANGE COLUMN `status_text` `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
```

3. 手动修复现有迁移文件

打开文件 `prisma/migrations/20240705000000_enhance_event_model/migration.sql`，找到包含以下语法的行：
```sql
CREATE INDEX IF NOT EXISTS `idx_events_actor_id` ON `events` (`actor_id`);
```

将其修改为 MySQL 兼容的语法：
```sql
CREATE INDEX `idx_events_actor_id` ON `events` (`actor_id`);
```

或者，如果索引可能已存在：
```sql
DROP INDEX IF EXISTS `idx_events_actor_id` ON `events`;
CREATE INDEX `idx_events_actor_id` ON `events` (`actor_id`);
```

4. 解决迁移问题后，重新同步 Prisma 架构：
```bash
npx prisma db pull
npx prisma generate
```

## 验证迁移

执行以下 SQL 查询确认字段类型已更改：
```sql
DESCRIBE ow_users;
```

## 注意事项

- 手动迁移不会记录在 Prisma 迁移历史中，可能需要额外的步骤来保持同步
- 确保在执行更改前备份数据库
- 如果您在生产环境中遇到迁移问题，请参考 Prisma 的迁移解决文档：https://pris.ly/d/migrate-resolve