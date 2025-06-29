/*
  Warnings:

  - You are about to drop the `ow_oauth_applications` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `ow_oauth_applications`;

-- CreateTable
CREATE TABLE `oauth_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `homepage_url` VARCHAR(191) NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `client_secret` VARCHAR(191) NOT NULL,
    `redirect_uris` JSON NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'oauth',
    `client_type` VARCHAR(191) NOT NULL DEFAULT 'confidential',
    `scopes` JSON NOT NULL,
    `webhook_url` VARCHAR(191) NULL,
    `logo_url` VARCHAR(191) NULL,
    `terms_url` VARCHAR(191) NULL,
    `privacy_url` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `oauth_applications_client_id_key`(`client_id`),
    INDEX `oauth_applications_owner_id_idx`(`owner_id`),
    INDEX `oauth_applications_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
