/*
  Warnings:

  - You are about to drop the `ow_user_kv_store` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `ow_user_kv_store`;

-- CreateTable
CREATE TABLE `ow_cache_kv` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` JSON NOT NULL,
    `creator_ip` VARCHAR(100) NULL DEFAULT '',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `ow_cache_kv_user_id_idx`(`user_id`),
    INDEX `ow_cache_kv_key_idx`(`key`),
    PRIMARY KEY (`user_id`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
