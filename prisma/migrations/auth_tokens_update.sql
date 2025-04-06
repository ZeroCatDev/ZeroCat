-- Modify ow_auth_tokens table
ALTER TABLE `ow_auth_tokens`
  DROP FOREIGN KEY `fk_tokens_devices`,
  DROP INDEX `idx_device_id`,
  DROP COLUMN `device_id`,
  ADD COLUMN `device_info` TEXT NULL COMMENT '设备信息JSON格式' AFTER `user_agent`;

-- Add column for recording token activity for refresh token decision
ALTER TABLE `ow_auth_tokens`
  ADD COLUMN `activity_count` INT NOT NULL DEFAULT 0 COMMENT '令牌活动计数' AFTER `last_used_ip`,
  ADD COLUMN `extended_at` DATETIME NULL COMMENT '延长令牌有效期的时间' AFTER `activity_count`;

-- Update the refresh token expiry config to longer default (30 days)
UPDATE `ow_config` SET `value` = '2592000' WHERE `key` = 'security.refreshTokenExpiry';

-- Add new config for refresh token extension
INSERT INTO `ow_config` (`key`, `value`, `is_public`) VALUES
('security.refreshTokenExtensionEnabled', 'true', 0),
('security.refreshTokenMaxExtensionDays', '90', 0);

-- Drop user devices table (after dropping foreign key constraint)
DROP TABLE IF EXISTS `ow_user_devices`;