-- CreateTable
CREATE TABLE `ow_projects_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER UNSIGNED NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `usage_context` VARCHAR(255) NULL,
    `usage_order` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `ow_projects_assets_project_id_idx`(`project_id`),
    INDEX `ow_projects_assets_asset_id_idx`(`asset_id`),
    INDEX `ow_projects_assets_usage_context_idx`(`usage_context`),
    UNIQUE INDEX `ow_projects_assets_project_id_asset_id_key`(`project_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `md5` VARCHAR(32) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `extension` VARCHAR(20) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `uploader_id` INTEGER NOT NULL,
    `uploader_ip` VARCHAR(100) NULL,
    `uploader_ua` MEDIUMTEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,
    `is_banned` BOOLEAN NOT NULL DEFAULT false,
    `banned_at` TIMESTAMP(0) NULL,
    `banned_by` INTEGER NULL,
    `ban_reason` VARCHAR(500) NULL,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `last_used_at` TIMESTAMP(0) NULL,
    `metadata` JSON NULL,
    `tags` VARCHAR(500) NULL,
    `category` VARCHAR(50) NULL,

    UNIQUE INDEX `ow_assets_md5_key`(`md5`),
    INDEX `ow_assets_md5_idx`(`md5`),
    INDEX `ow_assets_uploader_id_idx`(`uploader_id`),
    INDEX `ow_assets_created_at_idx`(`created_at`),
    INDEX `ow_assets_is_banned_idx`(`is_banned`),
    INDEX `ow_assets_extension_idx`(`extension`),
    INDEX `ow_assets_category_idx`(`category`),
    INDEX `ow_assets_usage_count_idx`(`usage_count`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
