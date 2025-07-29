-- CreateTable
CREATE TABLE `ow_scratch_extensions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectid` INTEGER NOT NULL,
    `branch` VARCHAR(128) NOT NULL DEFAULT '',
    `commit` VARCHAR(64) NOT NULL DEFAULT 'latest',
    `image` VARCHAR(255) NOT NULL,
    `samples` INTEGER NULL,
    `docs` VARCHAR(1024) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `idx_extension_project`(`projectid`),
    INDEX `idx_extension_status`(`status`),
    INDEX `idx_extension_samples`(`samples`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
