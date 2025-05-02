# 用户状态迁移指南

本文档详细说明了如何将用户状态(`status`)字段从数字类型转换为描述性字符串类型，使代码更加直观和易于维护。

## 迁移概述

当前数据库中用户状态使用数字编码:
- `0` = 待激活（新注册账户）
- `1` = 正常（正常活跃账户）
- `2` = 已暂停（临时禁用）
- `3` = 已封禁（永久禁用）

迁移后，状态将使用更直观的字符串:
- `pending` = 待激活
- `active` = 正常
- `suspended` = 已暂停
- `banned` = 已封禁

## 迁移SQL脚本

下面是完整的SQL脚本，您可以直接在MySQL命令行或管理工具中执行。您也可以在项目根目录下找到此脚本`prisma/user_status_migration.sql`。

```sql
-- 删除可能已存在的备份表
DROP TABLE IF EXISTS `ow_users_backup`;

-- 创建备份表
CREATE TABLE `ow_users_backup` LIKE `ow_users`;
INSERT INTO `ow_users_backup` SELECT * FROM `ow_users`;

-- 添加临时列（如果原status列存在且为INT类型）
ALTER TABLE `ow_users` ADD COLUMN IF NOT EXISTS `status_text` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 填充数据（仅当status为INT类型且status_text存在时需要）
UPDATE `ow_users` SET `status_text` = 'pending' WHERE `status` = 0;
UPDATE `ow_users` SET `status_text` = 'active' WHERE `status` = 1;
UPDATE `ow_users` SET `status_text` = 'suspended' WHERE `status` = 2;
UPDATE `ow_users` SET `status_text` = 'banned' WHERE `status` = 3;

-- 删除旧列
ALTER TABLE `ow_users` DROP COLUMN IF EXISTS `status`;

-- 重命名新列
ALTER TABLE `ow_users` CHANGE COLUMN `status_text` `status` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 添加索引（可选）
DROP INDEX IF EXISTS `idx_user_status` ON `ow_users`;
CREATE INDEX `idx_user_status` ON `ow_users` (`status`);
```

## 执行步骤

1. **备份数据库**
   在执行任何迁移操作前，务必先备份整个数据库

2. **连接到数据库**
   ```bash
   mysql -u 用户名 -p 数据库名
   ```

3. **执行迁移脚本**
   有两种方式：
   - 直接复制上述SQL语句到MySQL命令行中执行
   - 使用文件执行：
     ```bash
     mysql -u 用户名 -p 数据库名 < prisma/user_status_migration.sql
     ```

4. **验证迁移**
   ```sql
   DESCRIBE ow_users;
   SELECT id, username, status FROM ow_users LIMIT 10;
   ```

5. **更新Prisma模型**
   ```bash
   npx prisma db pull
   npx prisma generate
   ```

## 常见错误及解决方案

### 错误：Duplicate entry for key 'id_UNIQUE'

**错误消息**：
```
Error Code: 1062. Duplicate entry '1' for key 'ow_users_backup.id_UNIQUE'
```

**原因**：备份表已存在且包含数据，主键冲突。

**解决方案**：
1. 确保在创建备份表前先删除已存在的备份表：
   ```sql
   DROP TABLE IF EXISTS `ow_users_backup`;
   ```

### 错误：Column 'status_text' already exists

**原因**：临时列已经存在，可能是之前迁移中断。

**解决方案**：
1. 检查临时列是否存在：
   ```sql
   SHOW COLUMNS FROM `ow_users` LIKE 'status_text';
   ```

2. 如果存在，可以继续执行后续步骤，或先删除该列：
   ```sql
   ALTER TABLE `ow_users` DROP COLUMN `status_text`;
   ```

### 错误：Unknown column 'status' in 'ow_users'

**原因**：原始的status列可能已经被删除或已迁移完成。

**解决方案**：
1. 检查当前表结构：
   ```sql
   DESCRIBE ow_users;
   ```

2. 如果status列已是VARCHAR类型，说明迁移可能已完成，可以跳过这次迁移。

## 修复已知问题

如果您遇到事件表(`events`)索引相关的错误，可以执行以下SQL来修复:

```sql
-- 删除可能存在的索引
DROP INDEX IF EXISTS `idx_events_actor_id` ON `events`;
DROP INDEX IF EXISTS `idx_events_type_target` ON `events`;
DROP INDEX IF EXISTS `idx_events_public` ON `events`;

-- 重新创建索引
CREATE INDEX `idx_events_actor_id` ON `events` (`actor_id`);
CREATE INDEX `idx_events_type_target` ON `events` (`event_type`, `target_id`);
CREATE INDEX `idx_events_public` ON `events` (`public`);
```

## 回滚方案

如果迁移出现问题，您可以使用备份表恢复数据:

```sql
-- 删除修改后的表
DROP TABLE `ow_users`;

-- 从备份表恢复
CREATE TABLE `ow_users` LIKE `ow_users_backup`;
INSERT INTO `ow_users` SELECT * FROM `ow_users_backup`;

-- 可选：删除备份表
-- DROP TABLE `ow_users_backup`;
```

## 代码适配

迁移数据库后，请确保更新相关代码，使用新的字符串状态值。特别是以下文件:

1. `src/middleware/auth.middleware.js` - 使用 `isActive()` 函数检查状态
2. `utils/userStatus.js` - 包含状态值常量和辅助函数

## 注意事项

- 此迁移不支持自动回滚，请确保先备份数据库
- 如迁移过程中断，可能需要手动清理临时列
- 生产环境中请在低峰期执行迁移
- 使用新字符串值的代码不应在迁移完成前部署
- 如果您的MySQL版本不支持`IF EXISTS`或`IF NOT EXISTS`语法，请删除这些修饰符