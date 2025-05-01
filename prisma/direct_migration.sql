-- 用户状态迁移SQL脚本 - 直接修改方式
-- 将用户状态从数字类型转换为字符串类型，不创建备份表

-- 方法1: 直接修改方式（跳过备份表）

-- 第1步：添加新列
ALTER TABLE `ow_users` ADD COLUMN `status_string` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 第2步：更新数据
UPDATE `ow_users` SET `status_string` = 'pending' WHERE `status` = 0;
UPDATE `ow_users` SET `status_string` = 'active' WHERE `status` = 1;
UPDATE `ow_users` SET `status_string` = 'suspended' WHERE `status` = 2;
UPDATE `ow_users` SET `status_string` = 'banned' WHERE `status` = 3;

-- 第3步：删除旧列
ALTER TABLE `ow_users` DROP COLUMN `status`;

-- 第4步：重命名新列
ALTER TABLE `ow_users` CHANGE COLUMN `status_string` `status` VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 第5步（可选）：添加索引
CREATE INDEX `idx_user_status` ON `ow_users` (`status`);

-- 验证迁移
-- SELECT id, username, status FROM `ow_users` LIMIT 10;

-- 方法2: 如果方法1出错，可以尝试手动分步骤执行以下检查和清理命令

-- 检查列信息
-- DESCRIBE `ow_users`;

-- 如果status_text或status_string列已存在
-- ALTER TABLE `ow_users` DROP COLUMN `status_text`;
-- ALTER TABLE `ow_users` DROP COLUMN `status_string`;

-- 如果原status列是VARCHAR类型，说明迁移已完成
-- 如果ow_users_backup表存在且有冲突，清理它
-- DROP TABLE IF EXISTS `ow_users_backup`;

-- 迁移完成后，请执行:
-- npx prisma db pull
-- npx prisma generate