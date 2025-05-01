# 用户状态迁移逐步执行指南

本文档提供了逐步执行的迁移指南，避免备份表冲突问题。每一步都独立执行，观察结果后再执行下一步。

## 问题分析

您遇到的错误 `Error Code: 1062. Duplicate entry '1' for key 'ow_users_backup.id_UNIQUE'` 表明备份表已存在并且有主键冲突。由于自动清理备份表的命令可能因权限或其他原因执行失败，我们采用不使用备份表的方式进行迁移。

## 前期准备

请先连接到您的数据库：

```bash
mysql -u 用户名 -p 数据库名
```

## 逐步迁移指南

### 第1步：检查当前表结构

执行以下命令查看当前表结构：

```sql
DESCRIBE ow_users;
```

检查 `status` 字段的类型，如果已经是 VARCHAR 类型，说明迁移已完成，无需继续。

### 第2步：清理可能存在的临时列

如果您之前尝试过迁移，可能有残留的临时列。执行：

```sql
-- 检查是否存在status_text或status_string列
SHOW COLUMNS FROM `ow_users` LIKE 'status_text';
SHOW COLUMNS FROM `ow_users` LIKE 'status_string';

-- 如果存在，请删除它们
ALTER TABLE `ow_users` DROP COLUMN `status_text`;
-- 或
ALTER TABLE `ow_users` DROP COLUMN `status_string`;
```

### 第3步：添加新列

添加一个新的字符串类型列（使用与原列不同的名称）：

```sql
ALTER TABLE `ow_users` ADD COLUMN `status_new` VARCHAR(20) NOT NULL DEFAULT 'pending';
```

### 第4步：迁移数据

将数字状态值转换为字符串：

```sql
UPDATE `ow_users` SET `status_new` = 'pending' WHERE `status` = 0;
UPDATE `ow_users` SET `status_new` = 'active' WHERE `status` = 1;
UPDATE `ow_users` SET `status_new` = 'suspended' WHERE `status` = 2;
UPDATE `ow_users` SET `status_new` = 'banned' WHERE `status` = 3;
```

### 第5步：验证数据转换

检查数据是否正确转换：

```sql
SELECT id, username, status, status_new FROM `ow_users` LIMIT 10;
```

确认所有用户都有正确的 status_new 值。

### 第6步：删除旧列

删除旧的数字类型列：

```sql
ALTER TABLE `ow_users` DROP COLUMN `status`;
```

### 第7步：重命名新列

将新列重命名为原始列名：

```sql
ALTER TABLE `ow_users` CHANGE COLUMN `status_new` `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
```

### 第8步（可选）：添加索引

```sql
CREATE INDEX `idx_user_status` ON `ow_users` (`status`);
```

### 第9步：验证最终结构

确认迁移完成：

```sql
DESCRIBE ow_users;
SELECT id, username, status FROM `ow_users` LIMIT 10;
```

### 第10步：更新 Prisma 架构

在终端中执行：

```bash
npx prisma db pull
npx prisma generate
```

## 清理备份表（如果存在）

如果不再需要备份表，可以删除它：

```sql
DROP TABLE IF EXISTS `ow_users_backup`;
```

## 遇到问题？

如果上述步骤中的任何一步失败，请记录错误消息，并采取以下措施：

1. 不要继续执行下一步
2. 如果涉及ALTER TABLE操作失败，检查数据库权限
3. 检查列名是否正确
4. 检查MySQL版本兼容性