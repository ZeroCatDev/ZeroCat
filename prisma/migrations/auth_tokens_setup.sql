-- 创建用户设备表
CREATE TABLE IF NOT EXISTS `ow_user_devices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `device_name` VARCHAR(255) NULL,
  `device_type` VARCHAR(50) NULL,
  `os` VARCHAR(100) NULL,
  `browser` VARCHAR(100) NULL,
  `last_login_at` DATETIME NOT NULL,
  `last_login_ip` VARCHAR(100) NULL,
  `is_trusted` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  CONSTRAINT `fk_devices_users` FOREIGN KEY (`user_id`) REFERENCES `ow_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建用户认证令牌表
CREATE TABLE IF NOT EXISTS `ow_auth_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `access_token` VARCHAR(255) NOT NULL,
  `refresh_token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `refresh_expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `revoked` BOOLEAN NOT NULL DEFAULT FALSE,
  `revoked_at` DATETIME NULL,
  `device_id` INT NULL,
  `ip_address` VARCHAR(100) NULL,
  `user_agent` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_access_token` (`access_token`),
  UNIQUE INDEX `idx_refresh_token` (`refresh_token`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_device_id` (`device_id`),
  CONSTRAINT `fk_tokens_users` FOREIGN KEY (`user_id`) REFERENCES `ow_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tokens_devices` FOREIGN KEY (`device_id`) REFERENCES `ow_user_devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 添加配置项到 ow_config 表
INSERT INTO `ow_config` (`key`, `value`, `is_public`) VALUES
('security.accessTokenExpiry', '3600', 0),
('security.refreshTokenExpiry', '604800', 0);