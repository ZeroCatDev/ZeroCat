-- CreateTable
CREATE TABLE `AnalyticsEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `website_id` INTEGER NOT NULL,
    `visitor_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NULL,
    `url_path` VARCHAR(191) NOT NULL,
    `url_query` VARCHAR(191) NULL,
    `referrer_path` VARCHAR(191) NULL,
    `referrer_query` VARCHAR(191) NULL,
    `referrer_domain` VARCHAR(191) NULL,
    `page_title` VARCHAR(191) NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsEvent_website_id_idx`(`website_id`),
    INDEX `AnalyticsEvent_visitor_id_idx`(`visitor_id`),
    INDEX `AnalyticsEvent_user_id_idx`(`user_id`),
    INDEX `AnalyticsEvent_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalyticsDevice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitor_id` VARCHAR(191) NOT NULL,
    `website_id` INTEGER NOT NULL,
    `hostname` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `device` VARCHAR(191) NULL,
    `screen` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `subdivision1` VARCHAR(191) NULL,
    `subdivision2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsDevice_visitor_id_idx`(`visitor_id`),
    INDEX `AnalyticsDevice_website_id_idx`(`website_id`),
    INDEX `AnalyticsDevice_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
