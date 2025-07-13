-- CreateTable
CREATE TABLE `ow_coderun_devices` (
    `id` VARCHAR(191) NOT NULL,
    `device_name` VARCHAR(255) NOT NULL,
    `auth_token` VARCHAR(255) NOT NULL,
    `runner_token` VARCHAR(255) NOT NULL,
    `request_url` VARCHAR(1024) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `device_config` JSON NULL,
    `last_report` DATETIME(0) NULL,
    `last_config_fetch` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `docker_info` JSON NULL,
    `system_info` JSON NULL,
    `coderun_info` JSON NULL,

    UNIQUE INDEX `ow_coderun_devices_auth_token_key`(`auth_token`),
    UNIQUE INDEX `ow_coderun_devices_runner_token_key`(`runner_token`),
    INDEX `ow_coderun_devices_status_idx`(`status`),
    INDEX `ow_coderun_devices_auth_token_idx`(`auth_token`),
    INDEX `ow_coderun_devices_runner_token_idx`(`runner_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
