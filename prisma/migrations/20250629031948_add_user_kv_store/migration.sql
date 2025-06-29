-- CreateTable
CREATE TABLE `ow_user_kv_store` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` JSON NOT NULL,
    `creator_ip` VARCHAR(100) NULL DEFAULT '',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    INDEX `ow_user_kv_store_user_id_idx`(`user_id`),
    INDEX `ow_user_kv_store_key_idx`(`key`),
    PRIMARY KEY (`user_id`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
