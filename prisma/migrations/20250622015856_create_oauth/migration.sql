-- CreateTable
CREATE TABLE `ow_oauth_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `homepage_url` VARCHAR(255) NULL,
    `client_id` VARCHAR(255) NOT NULL,
    `client_secret` VARCHAR(255) NOT NULL,
    `redirect_uris` JSON NOT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'oauth',
    `scopes` JSON NOT NULL,
    `webhook_url` VARCHAR(255) NULL,
    `webhook_secret` VARCHAR(255) NULL,
    `logo_url` VARCHAR(255) NULL,
    `terms_url` VARCHAR(255) NULL,
    `privacy_url` VARCHAR(255) NULL,
    `setup_url` VARCHAR(255) NULL,
    `setup_on_update` BOOLEAN NOT NULL DEFAULT false,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `rate_limit` INTEGER NOT NULL DEFAULT 5000,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ow_oauth_applications_client_id_key`(`client_id`),
    INDEX `ow_oauth_applications_owner_id_idx`(`owner_id`),
    INDEX `ow_oauth_applications_client_id_idx`(`client_id`),
    INDEX `ow_oauth_applications_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_oauth_authorizations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `authorized_email` VARCHAR(255) NOT NULL,
    `scopes` JSON NOT NULL,
    `code` VARCHAR(255) NULL,
    `code_challenge` VARCHAR(255) NULL,
    `code_challenge_method` VARCHAR(20) NULL,
    `code_expires_at` DATETIME(3) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `last_used_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ow_oauth_authorizations_code_key`(`code`),
    INDEX `ow_oauth_authorizations_code_idx`(`code`),
    INDEX `ow_oauth_authorizations_user_id_idx`(`user_id`),
    UNIQUE INDEX `ow_oauth_authorizations_application_id_user_id_key`(`application_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_oauth_access_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER NOT NULL,
    `authorization_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `access_token` VARCHAR(255) NOT NULL,
    `refresh_token` VARCHAR(255) NULL,
    `scopes` JSON NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `refresh_token_expires_at` DATETIME(3) NULL,
    `ip_address` VARCHAR(100) NULL,
    `user_agent` TEXT NULL,
    `last_used_at` DATETIME(3) NULL,
    `last_used_ip` VARCHAR(100) NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ow_oauth_access_tokens_access_token_key`(`access_token`),
    UNIQUE INDEX `ow_oauth_access_tokens_refresh_token_key`(`refresh_token`),
    INDEX `ow_oauth_access_tokens_access_token_idx`(`access_token`),
    INDEX `ow_oauth_access_tokens_refresh_token_idx`(`refresh_token`),
    INDEX `ow_oauth_access_tokens_user_id_idx`(`user_id`),
    INDEX `ow_oauth_access_tokens_application_id_idx`(`application_id`),
    INDEX `ow_oauth_access_tokens_authorization_id_idx`(`authorization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_oauth_scopes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `requires_verification` BOOLEAN NOT NULL DEFAULT false,
    `category` VARCHAR(50) NOT NULL,
    `risk_level` VARCHAR(20) NOT NULL DEFAULT 'low',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ow_oauth_scopes_name_key`(`name`),
    INDEX `ow_oauth_scopes_category_idx`(`category`),
    INDEX `ow_oauth_scopes_risk_level_idx`(`risk_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
