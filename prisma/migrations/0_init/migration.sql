-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ow_config_type" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'ENUM');

-- CreateEnum
CREATE TYPE "ow_user_relationships_relationship_type" AS ENUM ('follow', 'block', 'mute', 'favorite');

-- CreateEnum
CREATE TYPE "ow_users_contacts_contact_type" AS ENUM ('email', 'phone', 'qq', 'other', 'oauth_google', 'oauth_github', 'oauth_microsoft', 'oauth_40code', 'oauth_linuxdo', 'totp', 'passkey');

-- CreateTable
CREATE TABLE "oauth_applications" (
    "id" INTEGER NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" VARCHAR(191),
    "homepage_url" VARCHAR(191),
    "client_id" VARCHAR(191) NOT NULL,
    "client_secret" VARCHAR(191) NOT NULL,
    "redirect_uris" JSON NOT NULL,
    "type" VARCHAR(191) NOT NULL DEFAULT 'oauth',
    "client_type" VARCHAR(191) NOT NULL DEFAULT 'confidential',
    "scopes" JSON NOT NULL,
    "webhook_url" VARCHAR(191),
    "logo_url" VARCHAR(191),
    "terms_url" VARCHAR(191),
    "privacy_url" VARCHAR(191),
    "status" VARCHAR(191) NOT NULL DEFAULT 'active',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19042_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_account_tokens" (
    "id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "last_used_ip" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19053_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_analytics_device" (
    "id" INTEGER NOT NULL,
    "fingerprint" VARCHAR(191) NOT NULL,
    "user_id" INTEGER,
    "hostname" VARCHAR(191),
    "screen" VARCHAR(191),
    "language" VARCHAR(191),
    "browser" VARCHAR(191),
    "browser_version" VARCHAR(191),
    "os" VARCHAR(191),
    "os_version" VARCHAR(191),
    "device_type" VARCHAR(191),
    "device_vendor" VARCHAR(191),
    "user_agent" TEXT,
    "first_seen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19060_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_analytics_event" (
    "id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "url" VARCHAR(191) NOT NULL,
    "url_path" VARCHAR(191) NOT NULL,
    "url_query" VARCHAR(191),
    "referrer" VARCHAR(191),
    "referrer_domain" VARCHAR(191),
    "referrer_path" VARCHAR(191),
    "referrer_query" VARCHAR(191),
    "page_title" VARCHAR(191),
    "target_type" VARCHAR(191) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(191),
    "country" VARCHAR(191),
    "region" VARCHAR(191),
    "city" VARCHAR(191),
    "timezone" VARCHAR(191),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19067_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_assets" (
    "id" INTEGER NOT NULL,
    "md5" VARCHAR(32) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploader_id" INTEGER NOT NULL,
    "uploader_ip" VARCHAR(100),
    "uploader_ua" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMPTZ(6),
    "banned_by" INTEGER,
    "ban_reason" VARCHAR(500),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(6),
    "metadata" JSON,
    "tags" VARCHAR(500),
    "category" VARCHAR(50),

    CONSTRAINT "idx_19073_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_auth_tokens" (
    "id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "last_used_ip" VARCHAR(255),
    "activity_count" INTEGER NOT NULL DEFAULT 0,
    "extended_at" TIMESTAMPTZ(6),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "device_info" TEXT,

    CONSTRAINT "idx_19081_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_cache_kv" (
    "user_id" BIGINT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" JSON NOT NULL,
    "creator_ip" VARCHAR(100) DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19090_PRIMARY" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "ow_coderun_devices" (
    "id" VARCHAR(191) NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "runner_token" VARCHAR(255) NOT NULL,
    "request_url" VARCHAR(1024),
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "device_config" JSON,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19097_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_comment" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "type" VARCHAR(64) DEFAULT 'comment',
    "text" TEXT,
    "insertedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_ip" VARCHAR(100) DEFAULT '',
    "link" VARCHAR(128),
    "pid" INTEGER,
    "rid" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT '',
    "user_ua" TEXT,
    "url" VARCHAR(255),
    "page_type" VARCHAR(32),
    "page_id" VARCHAR(32),
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "page_key" VARCHAR(128),

    CONSTRAINT "idx_19105_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_config" (
    "id" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSON,
    "type" "ow_config_type" NOT NULL DEFAULT 'STRING',

    CONSTRAINT "idx_19117_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_events" (
    "id" BIGSERIAL NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_id" BIGINT NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" BIGINT NOT NULL,
    "event_data" JSON NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "public" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "idx_19126_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "notification_type" VARCHAR(64) NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "high_priority" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),
    "actor_id" INTEGER,
    "target_type" VARCHAR(50),
    "target_id" INTEGER,
    "data" JSON,
    "content" TEXT,
    "link" VARCHAR(255),
    "metadata" JSON,
    "title" VARCHAR(100),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "push_channels" JSON,
    "push_error" BOOLEAN NOT NULL DEFAULT false,
    "push_results" JSON,

    CONSTRAINT "idx_19135_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_oauth_access_tokens" (
    "id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "authorization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "scopes" JSON NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_token_expires_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "last_used_at" TIMESTAMPTZ(6),
    "last_used_ip" VARCHAR(100),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19146_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_oauth_authorizations" (
    "id" INTEGER NOT NULL,
    "application_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "authorized_email" VARCHAR(255) NOT NULL,
    "scopes" JSON NOT NULL,
    "code" VARCHAR(255),
    "code_challenge" VARCHAR(255),
    "code_challenge_method" VARCHAR(20),
    "code_expires_at" TIMESTAMPTZ(6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMPTZ(6),
    "metadata" JSON,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19153_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_oauth_scopes" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "requires_verification" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(50) NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19160_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "default_branch" VARCHAR(128),
    "type" VARCHAR(32) DEFAULT 'text',
    "license" VARCHAR(32),
    "authorid" INTEGER NOT NULL,
    "state" VARCHAR(32) DEFAULT 'private',
    "view_count" BIGINT DEFAULT 0,
    "like_count" INTEGER DEFAULT 0,
    "favo_count" INTEGER DEFAULT 0,
    "time" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(1000) DEFAULT 'ZeroCat新项目',
    "description" VARCHAR(1000) DEFAULT 'ZeroCat上的项目',
    "history" BOOLEAN NOT NULL DEFAULT true,
    "devenv" BOOLEAN NOT NULL DEFAULT true,
    "tags" VARCHAR(100) NOT NULL DEFAULT '',
    "fork" INTEGER,
    "star_count" INTEGER DEFAULT 0,
    "thumbnail" VARCHAR(37) DEFAULT '',

    CONSTRAINT "idx_19170_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_assets" (
    "id" INTEGER NOT NULL,
    "project_id" BIGINT NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "usage_context" VARCHAR(255),
    "usage_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19189_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_branch" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "latest_commit_hash" VARCHAR(64) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "projectid" INTEGER NOT NULL,
    "protected" VARCHAR(45) DEFAULT 'false',
    "creator" INTEGER,

    CONSTRAINT "idx_19194_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_commits" (
    "id" VARCHAR(256) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "parent_commit_id" VARCHAR(256),
    "commit_message" TEXT NOT NULL,
    "commit_date" TIMESTAMPTZ(6) NOT NULL,
    "commit_file" VARCHAR(256) NOT NULL,
    "commit_description" TEXT,
    "depth" INTEGER,

    CONSTRAINT "idx_19198_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_file" (
    "sha256" VARCHAR(64) NOT NULL,
    "source" TEXT,
    "create_time" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "create_userid" INTEGER,

    CONSTRAINT "idx_19204_PRIMARY" PRIMARY KEY ("sha256")
);

-- CreateTable
CREATE TABLE "ow_projects_history" (
    "id" BIGSERIAL NOT NULL,
    "authorid" BIGINT NOT NULL,
    "projectid" BIGINT NOT NULL,
    "type" VARCHAR(32) DEFAULT 'text',
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(50) DEFAULT 'ZeroCat新项目',
    "description" VARCHAR(1000) DEFAULT 'commit',
    "source" TEXT,
    "state" VARCHAR(32) DEFAULT 'private',
    "licence" VARCHAR(45),
    "tags" VARCHAR(100),

    CONSTRAINT "idx_19211_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_list_items" (
    "id" INTEGER NOT NULL,
    "listid" INTEGER NOT NULL,
    "projectid" INTEGER NOT NULL,
    "createTime" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19222_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_lists" (
    "id" INTEGER NOT NULL,
    "authorid" INTEGER,
    "title" VARCHAR(1024) DEFAULT '收藏夹',
    "description" VARCHAR(1024) DEFAULT '列表',
    "state" VARCHAR(32) DEFAULT 'private',
    "list" TEXT,
    "updateTime" TIMESTAMPTZ(6),
    "createTime" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19226_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_stars" (
    "id" INTEGER NOT NULL,
    "userid" INTEGER NOT NULL,
    "projectid" INTEGER NOT NULL,
    "createTime" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19235_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_tags" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(45) NOT NULL,
    "projectid" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19239_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_push_subscriptions" (
    "id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "p256dh_key" VARCHAR(255) NOT NULL,
    "auth_key" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "device_info" JSON,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19243_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_scratch_extensions" (
    "id" INTEGER NOT NULL,
    "projectid" INTEGER NOT NULL,
    "branch" VARCHAR(128) NOT NULL DEFAULT '',
    "commit" VARCHAR(64) NOT NULL DEFAULT 'latest',
    "image" VARCHAR(255) NOT NULL,
    "samples" INTEGER,
    "docs" VARCHAR(1024),
    "status" VARCHAR(32) NOT NULL DEFAULT 'developing',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "scratchCompatible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "idx_19250_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_user_relationships" (
    "id" INTEGER NOT NULL,
    "source_user_id" INTEGER NOT NULL,
    "target_user_id" INTEGER NOT NULL,
    "relationship_type" "ow_user_relationships_relationship_type" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "metadata" JSON,

    CONSTRAINT "idx_19260_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users" (
    "id" INTEGER NOT NULL,
    "username" CHAR(20) NOT NULL,
    "email" CHAR(100),
    "password" VARCHAR(255),
    "display_name" CHAR(20) NOT NULL DEFAULT 'ZeroCat创作者',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "loginTime" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "regTime" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "sex" VARCHAR(16) DEFAULT '0',
    "birthday" TIMESTAMPTZ(6) DEFAULT '2000-03-31 08:00:00+08'::timestamp with time zone,
    "motto" TEXT,
    "images" VARCHAR(255) DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7',
    "avatar" VARCHAR(255) DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7',
    "type" VARCHAR(50) DEFAULT 'guest',
    "url" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),
    "label" VARCHAR(255),
    "bio" TEXT,
    "custom_status" JSON,
    "featured_projects" INTEGER,
    "location" VARCHAR(100),
    "region" VARCHAR(100),

    CONSTRAINT "idx_19266_PRIMARY" PRIMARY KEY ("id","username")
);

-- CreateTable
CREATE TABLE "ow_users_contacts" (
    "contact_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "contact_value" VARCHAR(255) NOT NULL,
    "contact_info" VARCHAR(255),
    "contact_type" "ow_users_contacts_contact_type" NOT NULL,
    "is_primary" BOOLEAN DEFAULT false,
    "verified" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSON,

    CONSTRAINT "idx_19281_PRIMARY" PRIMARY KEY ("contact_id")
);

-- CreateTable
CREATE TABLE "ow_users_magiclink" (
    "id" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idx_19290_PRIMARY" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users_totp" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL DEFAULT '验证器',
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(45) NOT NULL DEFAULT 'totp',
    "status" VARCHAR(32) NOT NULL DEFAULT 'unverified',
    "totp_secret" VARCHAR(255),
    "totp_algorithm" VARCHAR(10) DEFAULT 'SHA256',
    "totp_digits" INTEGER DEFAULT 6,
    "totp_period" INTEGER DEFAULT 30,
    "totp_last_updated" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idx_19293_PRIMARY" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_19042_oauth_applications_client_id_key" ON "oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "idx_19042_oauth_applications_client_id_idx" ON "oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "idx_19042_oauth_applications_owner_id_idx" ON "oauth_applications"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19053_ow_account_tokens_token_key" ON "ow_account_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_19053_ow_account_tokens_expires_at_idx" ON "ow_account_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_19053_ow_account_tokens_is_revoked_idx" ON "ow_account_tokens"("is_revoked");

-- CreateIndex
CREATE INDEX "idx_19053_ow_account_tokens_token_idx" ON "ow_account_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_19053_ow_account_tokens_user_id_idx" ON "ow_account_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_19060_ow_analytics_device_first_seen_idx" ON "ow_analytics_device"("first_seen");

-- CreateIndex
CREATE INDEX "idx_19060_ow_analytics_device_last_seen_idx" ON "ow_analytics_device"("last_seen");

-- CreateIndex
CREATE INDEX "idx_19060_ow_analytics_device_user_id_idx" ON "ow_analytics_device"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19060_ow_analytics_device_fingerprint_user_id_key" ON "ow_analytics_device"("fingerprint", "user_id");

-- CreateIndex
CREATE INDEX "idx_19067_ow_analytics_event_created_at_idx" ON "ow_analytics_event"("created_at");

-- CreateIndex
CREATE INDEX "idx_19067_ow_analytics_event_device_id_idx" ON "ow_analytics_event"("device_id");

-- CreateIndex
CREATE INDEX "idx_19067_ow_analytics_event_ip_address_idx" ON "ow_analytics_event"("ip_address");

-- CreateIndex
CREATE INDEX "idx_19067_ow_analytics_event_referrer_domain_idx" ON "ow_analytics_event"("referrer_domain");

-- CreateIndex
CREATE INDEX "idx_19067_ow_analytics_event_user_id_idx" ON "ow_analytics_event"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19073_ow_assets_md5_key" ON "ow_assets"("md5");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_category_idx" ON "ow_assets"("category");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_created_at_idx" ON "ow_assets"("created_at");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_extension_idx" ON "ow_assets"("extension");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_is_banned_idx" ON "ow_assets"("is_banned");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_md5_idx" ON "ow_assets"("md5");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_uploader_id_idx" ON "ow_assets"("uploader_id");

-- CreateIndex
CREATE INDEX "idx_19073_ow_assets_usage_count_idx" ON "ow_assets"("usage_count");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19081_idx_access_token" ON "ow_auth_tokens"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19081_idx_refresh_token" ON "ow_auth_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "idx_19081_idx_tokens_last_used_at" ON "ow_auth_tokens"("last_used_at");

-- CreateIndex
CREATE INDEX "idx_19081_idx_tokens_last_used_ip" ON "ow_auth_tokens"("last_used_ip");

-- CreateIndex
CREATE INDEX "idx_19081_idx_user_id" ON "ow_auth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_19090_ow_cache_kv_key_idx" ON "ow_cache_kv"("key");

-- CreateIndex
CREATE INDEX "idx_19090_ow_cache_kv_user_id_idx" ON "ow_cache_kv"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19097_ow_coderun_devices_runner_token_key" ON "ow_coderun_devices"("runner_token");

-- CreateIndex
CREATE INDEX "idx_19097_ow_coderun_devices_runner_token_idx" ON "ow_coderun_devices"("runner_token");

-- CreateIndex
CREATE INDEX "idx_19097_ow_coderun_devices_status_idx" ON "ow_coderun_devices"("status");

-- CreateIndex
CREATE INDEX "idx_19105_idx_comment_user" ON "ow_comment"("user_id");

-- CreateIndex
CREATE INDEX "idx_19105_idx_projects_comments" ON "ow_comment"("page_type", "page_id", "insertedAt");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19117_config_key" ON "ow_config"("key");

-- CreateIndex
CREATE INDEX "idx_19126_idx_created" ON "ow_events"("created_at");

-- CreateIndex
CREATE INDEX "idx_19126_idx_target" ON "ow_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_19126_idx_type_actor" ON "ow_events"("event_type", "actor_id");

-- CreateIndex
CREATE INDEX "idx_19135_idx_notification_actor" ON "ow_notifications"("actor_id");

-- CreateIndex
CREATE INDEX "idx_19135_idx_notification_hidden" ON "ow_notifications"("hidden");

-- CreateIndex
CREATE INDEX "idx_19135_idx_user_all" ON "ow_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_19135_idx_user_unread" ON "ow_notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19146_ow_oauth_access_tokens_access_token_key" ON "ow_oauth_access_tokens"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19146_ow_oauth_access_tokens_refresh_token_key" ON "ow_oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "idx_19146_ow_oauth_access_tokens_access_token_idx" ON "ow_oauth_access_tokens"("access_token");

-- CreateIndex
CREATE INDEX "idx_19146_ow_oauth_access_tokens_application_id_idx" ON "ow_oauth_access_tokens"("application_id");

-- CreateIndex
CREATE INDEX "idx_19146_ow_oauth_access_tokens_authorization_id_idx" ON "ow_oauth_access_tokens"("authorization_id");

-- CreateIndex
CREATE INDEX "idx_19146_ow_oauth_access_tokens_refresh_token_idx" ON "ow_oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "idx_19146_ow_oauth_access_tokens_user_id_idx" ON "ow_oauth_access_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19153_ow_oauth_authorizations_code_key" ON "ow_oauth_authorizations"("code");

-- CreateIndex
CREATE INDEX "idx_19153_ow_oauth_authorizations_code_idx" ON "ow_oauth_authorizations"("code");

-- CreateIndex
CREATE INDEX "idx_19153_ow_oauth_authorizations_user_id_idx" ON "ow_oauth_authorizations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19153_ow_oauth_authorizations_application_id_user_id_key" ON "ow_oauth_authorizations"("application_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19160_ow_oauth_scopes_name_key" ON "ow_oauth_scopes"("name");

-- CreateIndex
CREATE INDEX "idx_19160_ow_oauth_scopes_category_idx" ON "ow_oauth_scopes"("category");

-- CreateIndex
CREATE INDEX "idx_19160_ow_oauth_scopes_risk_level_idx" ON "ow_oauth_scopes"("risk_level");

-- CreateIndex
CREATE INDEX "idx_19170_idx_project_author" ON "ow_projects"("authorid");

-- CreateIndex
CREATE INDEX "idx_19170_idx_projects_state" ON "ow_projects"("state");

-- CreateIndex
CREATE INDEX "idx_19189_ow_projects_assets_asset_id_idx" ON "ow_projects_assets"("asset_id");

-- CreateIndex
CREATE INDEX "idx_19189_ow_projects_assets_project_id_idx" ON "ow_projects_assets"("project_id");

-- CreateIndex
CREATE INDEX "idx_19189_ow_projects_assets_usage_context_idx" ON "ow_projects_assets"("usage_context");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19189_ow_projects_assets_project_id_asset_id_key" ON "ow_projects_assets"("project_id", "asset_id");

-- CreateIndex
CREATE INDEX "idx_19194_idx_branch_creator" ON "ow_projects_branch"("creator");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19194_unique_project_branch" ON "ow_projects_branch"("projectid", "name");

-- CreateIndex
CREATE INDEX "idx_19198_idx_parent_commit" ON "ow_projects_commits"("parent_commit_id");

-- CreateIndex
CREATE INDEX "idx_19198_idx_projects_commits_project_date" ON "ow_projects_commits"("project_id", "commit_date");

-- CreateIndex
CREATE INDEX "idx_19222_idx_list_items" ON "ow_projects_list_items"("listid");

-- CreateIndex
CREATE INDEX "idx_19222_idx_project_in_lists" ON "ow_projects_list_items"("projectid");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19222_unique_list_project" ON "ow_projects_list_items"("listid", "projectid");

-- CreateIndex
CREATE INDEX "idx_19226_idx_author_lists" ON "ow_projects_lists"("authorid");

-- CreateIndex
CREATE INDEX "idx_19235_idx_projects_stars_project" ON "ow_projects_stars"("projectid");

-- CreateIndex
CREATE INDEX "idx_19235_idx_projects_stars_user" ON "ow_projects_stars"("userid");

-- CreateIndex
CREATE INDEX "idx_19239_idx_projectid" ON "ow_projects_tags"("projectid");

-- CreateIndex
CREATE INDEX "idx_19243_ow_push_subscriptions_is_active_idx" ON "ow_push_subscriptions"("is_active");

-- CreateIndex
CREATE INDEX "idx_19243_ow_push_subscriptions_last_used_at_idx" ON "ow_push_subscriptions"("last_used_at");

-- CreateIndex
CREATE INDEX "idx_19243_ow_push_subscriptions_user_id_idx" ON "ow_push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19243_ow_push_subscriptions_user_id_endpoint_key" ON "ow_push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE INDEX "idx_19250_idx_extension_project" ON "ow_scratch_extensions"("projectid");

-- CreateIndex
CREATE INDEX "idx_19250_idx_extension_samples" ON "ow_scratch_extensions"("samples");

-- CreateIndex
CREATE INDEX "idx_19250_idx_extension_status" ON "ow_scratch_extensions"("status");

-- CreateIndex
CREATE INDEX "idx_19260_idx_source_user_relationships" ON "ow_user_relationships"("source_user_id", "relationship_type");

-- CreateIndex
CREATE INDEX "idx_19260_idx_target_user_relationships" ON "ow_user_relationships"("target_user_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19260_ow_user_relationships_source_user_id_target_user_id_r" ON "ow_user_relationships"("source_user_id", "target_user_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19266_id_UNIQUE" ON "ow_users"("id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19266_user_UNIQUE" ON "ow_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19281_contact_value_UNIQUE" ON "ow_users_contacts"("contact_value");

-- CreateIndex
CREATE INDEX "idx_19281_idx_user_contact_type" ON "ow_users_contacts"("user_id", "contact_type");

-- CreateIndex
CREATE INDEX "idx_19281_idx_user_contacts" ON "ow_users_contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_19290_token" ON "ow_users_magiclink"("token");

