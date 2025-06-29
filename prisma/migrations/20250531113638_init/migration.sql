-- CreateTable
CREATE TABLE `ow_comment` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `type` VARCHAR(64) NULL DEFAULT 'comment',
    `text` MEDIUMTEXT NULL,
    `insertedAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_ip` VARCHAR(100) NULL DEFAULT '',
    `link` VARCHAR(128) NULL,
    `pid` INTEGER NULL,
    `rid` INTEGER NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT '',
    `user_ua` MEDIUMTEXT NULL,
    `url` VARCHAR(255) NULL,
    `page_type` VARCHAR(32) NULL,
    `page_id` INTEGER NULL,
    `createdAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `page_key` VARCHAR(128) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `default_branch` VARCHAR(128) NULL,
    `type` VARCHAR(32) NULL DEFAULT 'text',
    `license` VARCHAR(32) NULL,
    `authorid` INTEGER NOT NULL,
    `teacherid` INTEGER UNSIGNED NULL DEFAULT 0,
    `state` VARCHAR(32) NULL DEFAULT 'private',
    `view_count` INTEGER UNSIGNED NULL DEFAULT 0,
    `like_count` INTEGER NULL DEFAULT 0,
    `favo_count` INTEGER NULL DEFAULT 0,
    `time` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `title` VARCHAR(1000) NULL DEFAULT 'Scratch新项目',
    `description` VARCHAR(1000) NULL DEFAULT 'OurWorld上的Scratch项目',
    `history` BOOLEAN NOT NULL DEFAULT true,
    `devenv` BOOLEAN NOT NULL DEFAULT true,
    `tags` VARCHAR(100) NOT NULL DEFAULT '',
    `fork` INTEGER NULL,
    `star_count` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` CHAR(20) NOT NULL,
    `email` CHAR(100) NULL,
    `password` VARCHAR(255) NULL,
    `display_name` CHAR(20) NOT NULL DEFAULT 'OurWorld创作者',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `loginTime` TIMESTAMP(0) NULL,
    `regTime` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `sex` VARCHAR(16) NULL DEFAULT '0',
    `birthday` TIMESTAMP(0) NULL DEFAULT '2000-03-31 16:00:00',
    `motto` LONGTEXT NULL,
    `images` VARCHAR(255) NULL DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7',
    `avatar` VARCHAR(255) NULL DEFAULT 'https://owcdn.190823.xyz/user/fcd939e653195bb6d057e8c2519f5cc7',
    `type` VARCHAR(50) NULL DEFAULT 'guest',
    `url` VARCHAR(255) NULL,
    `github` VARCHAR(255) NULL,
    `twitter` VARCHAR(255) NULL,
    `facebook` VARCHAR(255) NULL,
    `google` VARCHAR(255) NULL,
    `weibo` VARCHAR(255) NULL,
    `qq` VARCHAR(255) NULL,
    `2fa` VARCHAR(255) NULL,
    `createdAt` TIMESTAMP(0) NULL DEFAULT '2000-03-31 16:00:00',
    `updatedAt` TIMESTAMP(0) NULL DEFAULT '2000-03-31 16:00:00',
    `label` VARCHAR(255) NULL,

    UNIQUE INDEX `id_UNIQUE`(`id`),
    UNIQUE INDEX `user_UNIQUE`(`username`),
    PRIMARY KEY (`id`, `username`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_file` (
    `sha256` VARCHAR(64) NOT NULL,
    `source` MEDIUMTEXT NULL,
    `create_time` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `create_userid` INTEGER NULL,

    PRIMARY KEY (`sha256`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_history` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `authorid` INTEGER UNSIGNED NOT NULL,
    `projectid` INTEGER UNSIGNED NOT NULL,
    `type` VARCHAR(32) NULL DEFAULT 'text',
    `time` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `title` VARCHAR(50) NULL DEFAULT 'ZeroCat新项目',
    `description` VARCHAR(1000) NULL DEFAULT 'commit',
    `source` MEDIUMTEXT NULL,
    `state` VARCHAR(32) NULL DEFAULT 'private',
    `licence` VARCHAR(45) NULL,
    `tags` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `user_id` INTEGER NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_public` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `config_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_users_totp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL DEFAULT '验证器',
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(45) NOT NULL DEFAULT 'totp',
    `status` VARCHAR(32) NOT NULL DEFAULT 'unverified',
    `totp_secret` VARCHAR(255) NULL,
    `totp_algorithm` VARCHAR(10) NULL DEFAULT 'SHA256',
    `totp_digits` INTEGER NULL DEFAULT 6,
    `totp_period` INTEGER NULL DEFAULT 30,
    `totp_last_updated` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(45) NOT NULL,
    `projectid` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_projectid`(`projectid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_stars` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userid` INTEGER NOT NULL,
    `projectid` INTEGER NOT NULL,
    `createTime` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorid` INTEGER NULL,
    `title` VARCHAR(1024) NULL DEFAULT '收藏夹',
    `description` VARCHAR(1024) NULL DEFAULT '列表',
    `state` VARCHAR(32) NULL DEFAULT 'private',
    `list` MEDIUMTEXT NULL,
    `updateTime` TIMESTAMP(0) NULL,
    `createTime` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_author_lists`(`authorid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_commits` (
    `id` VARCHAR(256) NOT NULL,
    `project_id` INTEGER NOT NULL,
    `author_id` INTEGER NOT NULL,
    `branch` VARCHAR(255) NOT NULL DEFAULT 'main',
    `parent_commit_id` VARCHAR(256) NULL,
    `commit_message` TEXT NOT NULL,
    `commit_date` DATETIME(0) NOT NULL,
    `commit_file` VARCHAR(256) NOT NULL,
    `commit_description` TEXT NULL,

    PRIMARY KEY (`id`, `project_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_users_magiclink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(0) NOT NULL,

    UNIQUE INDEX `token`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_branch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `latest_commit_hash` VARCHAR(64) NOT NULL,
    `description` VARCHAR(128) NOT NULL,
    `projectid` INTEGER NOT NULL,
    `protected` VARCHAR(45) NULL DEFAULT 'false',
    `creator` INTEGER NULL,

    UNIQUE INDEX `unique_project_branch`(`projectid`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_users_contacts` (
    `contact_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `contact_value` VARCHAR(255) NOT NULL,
    `contact_info` VARCHAR(255) NULL,
    `contact_type` ENUM('email', 'phone', 'qq', 'other', 'oauth_google', 'oauth_github', 'oauth_microsoft') NOT NULL,
    `is_primary` BOOLEAN NULL DEFAULT false,
    `verified` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `contact_value_UNIQUE`(`contact_value`),
    UNIQUE INDEX `unique_primary_contact`(`user_id`, `is_primary`, `contact_type`),
    PRIMARY KEY (`contact_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `event_type` VARCHAR(50) NOT NULL,
    `actor_id` BIGINT UNSIGNED NOT NULL,
    `target_type` VARCHAR(50) NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `event_data` JSON NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `public` TINYINT NOT NULL DEFAULT 0,

    INDEX `idx_created`(`created_at`),
    INDEX `idx_target`(`target_type`, `target_id`),
    INDEX `idx_type_actor`(`event_type`, `actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_projects_list_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listid` INTEGER NOT NULL,
    `projectid` INTEGER NOT NULL,
    `createTime` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_list_items`(`listid`),
    INDEX `idx_project_in_lists`(`projectid`),
    UNIQUE INDEX `unique_list_project`(`listid`, `projectid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_auth_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `access_token` VARCHAR(255) NOT NULL,
    `refresh_token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `refresh_expires_at` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_used_at` DATETIME(0) NULL,
    `last_used_ip` VARCHAR(255) NULL,
    `activity_count` INTEGER NOT NULL DEFAULT 0,
    `extended_at` DATETIME(0) NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `revoked_at` DATETIME(0) NULL,
    `ip_address` VARCHAR(100) NULL,
    `user_agent` TEXT NULL,
    `device_info` TEXT NULL,

    UNIQUE INDEX `idx_access_token`(`access_token`),
    UNIQUE INDEX `idx_refresh_token`(`refresh_token`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_tokens_last_used_at`(`last_used_at`),
    INDEX `idx_tokens_last_used_ip`(`last_used_ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_notifications` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `notification_type` VARCHAR(64) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `high_priority` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `read_at` TIMESTAMP(0) NULL,
    `actor_id` INTEGER NULL,
    `target_type` VARCHAR(50) NULL,
    `target_id` INTEGER NULL,
    `related_type` VARCHAR(50) NULL,
    `related_id` INTEGER NULL,
    `data` JSON NULL,

    INDEX `idx_user_unread`(`user_id`, `read`, `created_at`),
    INDEX `idx_user_all`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ow_user_relationships` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_user_id` INTEGER NOT NULL,
    `target_user_id` INTEGER NOT NULL,
    `relationship_type` ENUM('follow', 'block', 'mute', 'favorite') NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL,
    `metadata` JSON NULL,

    INDEX `idx_source_user_relationships`(`source_user_id`, `relationship_type`),
    INDEX `idx_target_user_relationships`(`target_user_id`, `relationship_type`),
    UNIQUE INDEX `ow_user_relationships_source_user_id_target_user_id_relation_key`(`source_user_id`, `target_user_id`, `relationship_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ow_auth_tokens` ADD CONSTRAINT `fk_tokens_users` FOREIGN KEY (`user_id`) REFERENCES `ow_users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
