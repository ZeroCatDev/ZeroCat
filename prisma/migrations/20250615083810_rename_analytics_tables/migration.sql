/*
  Warnings:

  - You are about to drop the `AnalyticsDevice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AnalyticsEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `AnalyticsDevice`;

-- DropTable
DROP TABLE `AnalyticsEvent`;

-- CreateTable
CREATE TABLE `ow_analytics_device` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fingerprint` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `hostname` VARCHAR(191) NULL,
    `screen` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `browser_version` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `os_version` VARCHAR(191) NULL,
    `device_type` VARCHAR(191) NULL,
    `device_vendor` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `first_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ow_analytics_device_user_id_idx`(`user_id`),
    INDEX `ow_analytics_device_first_seen_idx`(`first_seen`),
    INDEX `ow_analytics_device_last_seen_idx`(`last_seen`),
    UNIQUE INDEX `ow_analytics_device_fingerprint_user_id_key`(`fingerprint`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_analytics_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `url` VARCHAR(191) NOT NULL,
    `url_path` VARCHAR(191) NOT NULL,
    `url_query` VARCHAR(191) NULL,
    `referrer` VARCHAR(191) NULL,
    `referrer_domain` VARCHAR(191) NULL,
    `referrer_path` VARCHAR(191) NULL,
    `referrer_query` VARCHAR(191) NULL,
    `page_title` VARCHAR(191) NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` INTEGER NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ow_analytics_event_device_id_idx`(`device_id`),
    INDEX `ow_analytics_event_user_id_idx`(`user_id`),
    INDEX `ow_analytics_event_created_at_idx`(`created_at`),
    INDEX `ow_analytics_event_referrer_domain_idx`(`referrer_domain`),
    INDEX `ow_analytics_event_ip_address_idx`(`ip_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
