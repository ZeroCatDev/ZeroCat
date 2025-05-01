-- 用户状态迁移SQL脚本
-- 将用户状态从数字类型转换为字符串类型

-- 检查status列是否存在（如果不存在则可能已经迁移过）
-- 执行以下查询可验证:
-- SHOW COLUMNS FROM `ow_users` LIKE 'status';

-- 添加临时列
ALTER TABLE `ow_users` ADD COLUMN `status_text` VARCHAR(20) NOT NULL DEFAULT 'active';

-- 临时禁用安全更新模式
SET SQL_SAFE_UPDATES = 0;

-- 填充数据
UPDATE `ow_users` SET `status_text` = 'active';

-- 恢复安全更新模式
SET SQL_SAFE_UPDATES = 1;

-- 重命名新列前先显式转换数据类型
ALTER TABLE `ow_users` MODIFY COLUMN `status` INT;

-- 重命名新列
ALTER TABLE `ow_users` CHANGE COLUMN `status_text` `status` VARCHAR(20) NOT NULL DEFAULT 'active';

-- 添加索引 (简单创建，如果已存在会报错，可以忽略)
CREATE INDEX `idx_user_status` ON `ow_users` (`status`);

-- 修复events表索引
-- 尝试创建索引，如果已存在可能会报错，可以忽略错误
CREATE INDEX `idx_events_actor_id` ON `events` (`actor_id`);
CREATE INDEX `idx_events_type_target` ON `events` (`event_type`, `target_id`);
CREATE INDEX `idx_events_public` ON `events` (`public`);

-- 迁移完成后，请执行:
-- npx prisma db pull
-- npx prisma generate