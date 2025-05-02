-- 创建用户状态枚举类型
CREATE TYPE user_status_type AS ENUM ('pending', 'active', 'suspended', 'banned');

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

-- 添加注释
-- 用户账户状态: pending = 新注册, active = 正常账户, suspended = 临时禁用, banned = 永久禁用