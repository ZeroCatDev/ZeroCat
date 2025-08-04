/*
  Warnings:

  - You are about to drop the column `related_id` on the `ow_notifications` table. All the data in the column will be lost.
  - You are about to drop the column `related_type` on the `ow_notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ow_notifications` DROP COLUMN `related_id`,
    DROP COLUMN `related_type`,
    ADD COLUMN `content` TEXT NULL,
    ADD COLUMN `link` VARCHAR(255) NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `title` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `ow_push_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh_key` VARCHAR(255) NOT NULL,
    `auth_key` VARCHAR(255) NOT NULL,
    `user_agent` TEXT NULL,
    `device_info` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_used_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `ow_push_subscriptions_user_id_idx`(`user_id`),
    INDEX `ow_push_subscriptions_is_active_idx`(`is_active`),
    INDEX `ow_push_subscriptions_last_used_at_idx`(`last_used_at`),
    UNIQUE INDEX `ow_push_subscriptions_user_id_endpoint_key`(`user_id`, `endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
