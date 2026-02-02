-- CreateEnum
CREATE TYPE "ow_config_type" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'ENUM');

-- CreateEnum
CREATE TYPE "ow_users_contacts_contact_type" AS ENUM ('email', 'phone', 'qq', 'other', 'oauth_google', 'oauth_github', 'oauth_microsoft', 'oauth_40code', 'oauth_linuxdo', 'totp', 'passkey');

-- CreateEnum
CREATE TYPE "ow_user_relationship_type" AS ENUM ('follow', 'block', 'mute', 'favorite');

-- CreateTable
CREATE TABLE "ow_comment" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "type" VARCHAR(64) DEFAULT 'comment',
    "text" TEXT,
    "insertedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "user_ip" VARCHAR(100) DEFAULT '',
    "link" VARCHAR(128),
    "pid" INTEGER,
    "rid" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT '',
    "user_ua" TEXT,
    "url" VARCHAR(255),
    "page_type" VARCHAR(32),
    "page_id" VARCHAR(32),
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "page_key" VARCHAR(128),

    CONSTRAINT "ow_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "default_branch" VARCHAR(128),
    "type" VARCHAR(32) DEFAULT 'text',
    "license" VARCHAR(32),
    "authorid" INTEGER,
    "thumbnail" VARCHAR(37) NOT NULL DEFAULT '',
    "state" VARCHAR(32) NOT NULL DEFAULT 'private',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favo_count" INTEGER NOT NULL DEFAULT 0,
    "time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(1000) NOT NULL DEFAULT 'ZeroCat新项目',
    "description" VARCHAR(1000) NOT NULL DEFAULT 'ZeroCat上的项目',
    "history" BOOLEAN NOT NULL DEFAULT true,
    "devenv" BOOLEAN NOT NULL DEFAULT true,
    "tags" VARCHAR(100) NOT NULL DEFAULT '',
    "fork" INTEGER,
    "star_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ow_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "email" VARCHAR(100),
    "password" VARCHAR(255),
    "display_name" VARCHAR(20) NOT NULL DEFAULT 'ZeroCat创作者',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "motto" TEXT,
    "bio" TEXT,
    "location" VARCHAR(100),
    "region" VARCHAR(100),
    "birthday" TIMESTAMP(6) DEFAULT '2000-03-31 00:00:00 +00:00',
    "sex" VARCHAR(16) NOT NULL DEFAULT '0',
    "url" VARCHAR(255),
    "custom_status" JSONB,
    "featured_projects" INTEGER,
    "images" VARCHAR(255) NOT NULL DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7',
    "avatar" VARCHAR(255) NOT NULL DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7',
    "type" VARCHAR(50) NOT NULL DEFAULT 'guest',
    "label" VARCHAR(255),
    "loginTime" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "regTime" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_file" (
    "sha256" VARCHAR(64) NOT NULL,
    "source" TEXT,
    "create_time" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "create_userid" INTEGER,

    CONSTRAINT "ow_projects_file_pkey" PRIMARY KEY ("sha256")
);

-- CreateTable
CREATE TABLE "ow_projects_history" (
    "id" SERIAL NOT NULL,
    "authorid" INTEGER NOT NULL,
    "projectid" INTEGER NOT NULL,
    "type" VARCHAR(32) DEFAULT 'text',
    "time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(50) NOT NULL DEFAULT 'ZeroCat新项目',
    "description" VARCHAR(1000) NOT NULL DEFAULT 'commit',
    "source" TEXT,
    "state" VARCHAR(32) NOT NULL DEFAULT 'private',
    "licence" VARCHAR(45),
    "tags" VARCHAR(100),

    CONSTRAINT "ow_projects_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_config" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "type" "ow_config_type" NOT NULL DEFAULT 'STRING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users_totp" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL DEFAULT '验证器',
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(45) NOT NULL DEFAULT 'totp',
    "status" VARCHAR(32) NOT NULL DEFAULT 'unverified',
    "totp_secret" VARCHAR(255),
    "totp_algorithm" VARCHAR(10) NOT NULL DEFAULT 'SHA256',
    "totp_digits" INTEGER NOT NULL DEFAULT 6,
    "totp_period" INTEGER NOT NULL DEFAULT 30,
    "totp_last_updated" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_users_totp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(45) NOT NULL,
    "projectid" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_projects_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_stars" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER,
    "projectid" INTEGER,
    "createTime" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_projects_stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_lists" (
    "id" SERIAL NOT NULL,
    "authorid" INTEGER,
    "title" VARCHAR(1024) NOT NULL DEFAULT '收藏夹',
    "description" VARCHAR(1024) NOT NULL DEFAULT '列表',
    "state" VARCHAR(32) NOT NULL DEFAULT 'private',
    "list" TEXT,
    "updateTime" TIMESTAMP(6),
    "createTime" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_projects_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_commits" (
    "id" VARCHAR(256) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "parent_commit_id" VARCHAR(256),
    "commit_message" TEXT NOT NULL,
    "commit_date" TIMESTAMP(6) NOT NULL,
    "commit_file" VARCHAR(256) NOT NULL,
    "commit_description" TEXT,
    "depth" INTEGER,

    CONSTRAINT "ow_projects_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users_magiclink" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_users_magiclink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_branch" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "latest_commit_hash" VARCHAR(64) NOT NULL,
    "description" VARCHAR(128) NOT NULL,
    "projectid" INTEGER,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "creator" INTEGER,

    CONSTRAINT "ow_projects_branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_users_contacts" (
    "contact_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "contact_value" VARCHAR(255) NOT NULL,
    "contact_info" VARCHAR(255),
    "contact_type" "ow_users_contacts_contact_type" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_users_contacts_pkey" PRIMARY KEY ("contact_id")
);

-- CreateTable
CREATE TABLE "ow_events" (
    "id" SERIAL NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_id" INTEGER,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "event_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "public" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_list_items" (
    "id" SERIAL NOT NULL,
    "listid" INTEGER,
    "projectid" INTEGER,
    "createTime" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_projects_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_auth_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "refresh_expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "last_used_at" TIMESTAMP(6),
    "last_used_ip" VARCHAR(255),
    "activity_count" INTEGER NOT NULL DEFAULT 0,
    "extended_at" TIMESTAMP(6),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(6),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "device_info" TEXT,

    CONSTRAINT "ow_auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(100),
    "content" TEXT,
    "link" VARCHAR(255),
    "metadata" JSONB,
    "notification_type" VARCHAR(64) NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "high_priority" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "push_channels" JSONB,
    "push_results" JSONB,
    "push_error" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),
    "actor_id" INTEGER,
    "target_type" VARCHAR(50),
    "target_id" INTEGER,
    "data" JSONB,

    CONSTRAINT "ow_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_user_relationships" (
    "id" SERIAL NOT NULL,
    "source_user_id" INTEGER,
    "target_user_id" INTEGER,
    "relationship_type" "ow_user_relationship_type" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ow_user_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_analytics_device" (
    "id" SERIAL NOT NULL,
    "fingerprint" VARCHAR(255) NOT NULL,
    "user_id" INTEGER,
    "hostname" VARCHAR(255),
    "screen" VARCHAR(50),
    "language" VARCHAR(20),
    "browser" VARCHAR(100),
    "browser_version" VARCHAR(50),
    "os" VARCHAR(100),
    "os_version" VARCHAR(50),
    "device_type" VARCHAR(20),
    "device_vendor" VARCHAR(100),
    "user_agent" TEXT,
    "first_seen" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_analytics_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_analytics_event" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER,
    "user_id" INTEGER,
    "url" VARCHAR(2048) NOT NULL,
    "url_path" VARCHAR(1024) NOT NULL,
    "url_query" VARCHAR(1024),
    "referrer" VARCHAR(2048),
    "referrer_domain" VARCHAR(255),
    "referrer_path" VARCHAR(1024),
    "referrer_query" VARCHAR(1024),
    "page_title" VARCHAR(500),
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(100),
    "country" VARCHAR(100),
    "region" VARCHAR(100),
    "city" VARCHAR(100),
    "timezone" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_applications" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "homepage_url" VARCHAR(500),
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" VARCHAR(255) NOT NULL,
    "redirect_uris" JSONB NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'oauth',
    "client_type" VARCHAR(50) NOT NULL DEFAULT 'confidential',
    "scopes" JSONB NOT NULL,
    "webhook_url" VARCHAR(500),
    "logo_url" VARCHAR(500),
    "terms_url" VARCHAR(500),
    "privacy_url" VARCHAR(500),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oauth_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorizations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER,
    "user_id" INTEGER,
    "authorized_email" VARCHAR(255) NOT NULL,
    "scopes" JSONB NOT NULL,
    "code" VARCHAR(255),
    "code_challenge" VARCHAR(255),
    "code_challenge_method" VARCHAR(20),
    "code_expires_at" TIMESTAMP(6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMP(6),
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER,
    "authorization_id" INTEGER,
    "user_id" INTEGER,
    "access_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "scopes" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(6),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "last_used_at" TIMESTAMP(6),
    "last_used_ip" VARCHAR(100),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_scopes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "requires_verification" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(50) NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oauth_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_cache_kv" (
    "user_id" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" JSONB NOT NULL,
    "creator_ip" VARCHAR(100) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_cache_kv_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "ow_coderun_devices" (
    "id" UUID NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "runner_token" VARCHAR(255) NOT NULL,
    "request_url" VARCHAR(1024),
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "device_config" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_coderun_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_scratch_extensions" (
    "id" SERIAL NOT NULL,
    "projectid" INTEGER,
    "branch" VARCHAR(128) NOT NULL DEFAULT '',
    "commit" VARCHAR(64) NOT NULL DEFAULT 'latest',
    "image" VARCHAR(255) NOT NULL,
    "samples" INTEGER,
    "docs" VARCHAR(1024),
    "scratchCompatible" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(32) NOT NULL DEFAULT 'developing',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_scratch_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_account_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(6),
    "last_used_at" TIMESTAMP(6),
    "last_used_ip" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_projects_assets" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "asset_id" INTEGER,
    "usage_context" VARCHAR(255),
    "usage_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_projects_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_assets" (
    "id" SERIAL NOT NULL,
    "md5" VARCHAR(32) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploader_id" INTEGER,
    "uploader_ip" VARCHAR(100),
    "uploader_ua" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMP(6),
    "banned_by" INTEGER,
    "ban_reason" VARCHAR(500),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(6),
    "metadata" JSONB,
    "tags" VARCHAR(500),
    "category" VARCHAR(50),

    CONSTRAINT "ow_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "endpoint" VARCHAR(500) NOT NULL,
    "p256dh_key" VARCHAR(255) NOT NULL,
    "auth_key" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "device_info" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ow_comment_page_type_page_id_insertedAt_idx" ON "ow_comment"("page_type", "page_id", "insertedAt");

-- CreateIndex
CREATE INDEX "ow_comment_user_id_idx" ON "ow_comment"("user_id");

-- CreateIndex
CREATE INDEX "ow_projects_state_idx" ON "ow_projects"("state");

-- CreateIndex
CREATE INDEX "ow_projects_authorid_idx" ON "ow_projects"("authorid");

-- CreateIndex
CREATE INDEX "ow_projects_time_idx" ON "ow_projects"("time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ow_users_username_key" ON "ow_users"("username");

-- CreateIndex
CREATE INDEX "ow_users_email_idx" ON "ow_users"("email");

-- CreateIndex
CREATE INDEX "ow_users_status_idx" ON "ow_users"("status");

-- CreateIndex
CREATE INDEX "ow_projects_history_projectid_idx" ON "ow_projects_history"("projectid");

-- CreateIndex
CREATE INDEX "ow_projects_history_authorid_idx" ON "ow_projects_history"("authorid");

-- CreateIndex
CREATE UNIQUE INDEX "ow_config_key_key" ON "ow_config"("key");

-- CreateIndex
CREATE INDEX "ow_users_totp_user_id_idx" ON "ow_users_totp"("user_id");

-- CreateIndex
CREATE INDEX "ow_projects_tags_projectid_idx" ON "ow_projects_tags"("projectid");

-- CreateIndex
CREATE INDEX "ow_projects_tags_name_idx" ON "ow_projects_tags"("name");

-- CreateIndex
CREATE INDEX "ow_projects_stars_projectid_idx" ON "ow_projects_stars"("projectid");

-- CreateIndex
CREATE INDEX "ow_projects_stars_userid_idx" ON "ow_projects_stars"("userid");

-- CreateIndex
CREATE UNIQUE INDEX "ow_projects_stars_userid_projectid_key" ON "ow_projects_stars"("userid", "projectid");

-- CreateIndex
CREATE INDEX "ow_projects_lists_authorid_idx" ON "ow_projects_lists"("authorid");

-- CreateIndex
CREATE INDEX "ow_projects_commits_project_id_commit_date_idx" ON "ow_projects_commits"("project_id", "commit_date" DESC);

-- CreateIndex
CREATE INDEX "ow_projects_commits_parent_commit_id_idx" ON "ow_projects_commits"("parent_commit_id");

-- CreateIndex
CREATE INDEX "ow_projects_commits_author_id_idx" ON "ow_projects_commits"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_users_magiclink_token_key" ON "ow_users_magiclink"("token");

-- CreateIndex
CREATE INDEX "ow_users_magiclink_expiresAt_idx" ON "ow_users_magiclink"("expiresAt");

-- CreateIndex
CREATE INDEX "ow_projects_branch_creator_idx" ON "ow_projects_branch"("creator");

-- CreateIndex
CREATE UNIQUE INDEX "ow_projects_branch_projectid_name_key" ON "ow_projects_branch"("projectid", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ow_users_contacts_contact_value_key" ON "ow_users_contacts"("contact_value");

-- CreateIndex
CREATE INDEX "ow_users_contacts_user_id_idx" ON "ow_users_contacts"("user_id");

-- CreateIndex
CREATE INDEX "ow_users_contacts_user_id_contact_type_idx" ON "ow_users_contacts"("user_id", "contact_type");

-- CreateIndex
CREATE INDEX "ow_events_created_at_idx" ON "ow_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_events_target_type_target_id_idx" ON "ow_events"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "ow_events_event_type_actor_id_idx" ON "ow_events"("event_type", "actor_id");

-- CreateIndex
CREATE INDEX "ow_projects_list_items_listid_idx" ON "ow_projects_list_items"("listid");

-- CreateIndex
CREATE INDEX "ow_projects_list_items_projectid_idx" ON "ow_projects_list_items"("projectid");

-- CreateIndex
CREATE UNIQUE INDEX "ow_projects_list_items_listid_projectid_key" ON "ow_projects_list_items"("listid", "projectid");

-- CreateIndex
CREATE UNIQUE INDEX "ow_auth_tokens_access_token_key" ON "ow_auth_tokens"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "ow_auth_tokens_refresh_token_key" ON "ow_auth_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "ow_auth_tokens_user_id_idx" ON "ow_auth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ow_auth_tokens_last_used_at_idx" ON "ow_auth_tokens"("last_used_at");

-- CreateIndex
CREATE INDEX "ow_auth_tokens_last_used_ip_idx" ON "ow_auth_tokens"("last_used_ip");

-- CreateIndex
CREATE INDEX "ow_auth_tokens_expires_at_idx" ON "ow_auth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "ow_notifications_user_id_read_created_at_idx" ON "ow_notifications"("user_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_notifications_user_id_created_at_idx" ON "ow_notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_notifications_actor_id_idx" ON "ow_notifications"("actor_id");

-- CreateIndex
CREATE INDEX "ow_notifications_hidden_idx" ON "ow_notifications"("hidden");

-- CreateIndex
CREATE INDEX "ow_user_relationships_source_user_id_relationship_type_idx" ON "ow_user_relationships"("source_user_id", "relationship_type");

-- CreateIndex
CREATE INDEX "ow_user_relationships_target_user_id_relationship_type_idx" ON "ow_user_relationships"("target_user_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "ow_user_relationships_source_user_id_target_user_id_relatio_key" ON "ow_user_relationships"("source_user_id", "target_user_id", "relationship_type");

-- CreateIndex
CREATE INDEX "ow_analytics_device_user_id_idx" ON "ow_analytics_device"("user_id");

-- CreateIndex
CREATE INDEX "ow_analytics_device_first_seen_idx" ON "ow_analytics_device"("first_seen");

-- CreateIndex
CREATE INDEX "ow_analytics_device_last_seen_idx" ON "ow_analytics_device"("last_seen");

-- CreateIndex
CREATE UNIQUE INDEX "ow_analytics_device_fingerprint_user_id_key" ON "ow_analytics_device"("fingerprint", "user_id");

-- CreateIndex
CREATE INDEX "ow_analytics_event_device_id_idx" ON "ow_analytics_event"("device_id");

-- CreateIndex
CREATE INDEX "ow_analytics_event_user_id_idx" ON "ow_analytics_event"("user_id");

-- CreateIndex
CREATE INDEX "ow_analytics_event_created_at_idx" ON "ow_analytics_event"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_analytics_event_referrer_domain_idx" ON "ow_analytics_event"("referrer_domain");

-- CreateIndex
CREATE INDEX "ow_analytics_event_ip_address_idx" ON "ow_analytics_event"("ip_address");

-- CreateIndex
CREATE INDEX "ow_analytics_event_target_type_target_id_idx" ON "ow_analytics_event"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_applications_client_id_key" ON "oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "oauth_applications_owner_id_idx" ON "oauth_applications"("owner_id");

-- CreateIndex
CREATE INDEX "oauth_applications_client_id_idx" ON "oauth_applications"("client_id");

-- CreateIndex
CREATE INDEX "oauth_applications_status_idx" ON "oauth_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorizations_code_key" ON "oauth_authorizations"("code");

-- CreateIndex
CREATE INDEX "oauth_authorizations_code_idx" ON "oauth_authorizations"("code");

-- CreateIndex
CREATE INDEX "oauth_authorizations_user_id_idx" ON "oauth_authorizations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorizations_application_id_user_id_key" ON "oauth_authorizations"("application_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_access_token_key" ON "oauth_access_tokens"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_refresh_token_key" ON "oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_access_token_idx" ON "oauth_access_tokens"("access_token");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_application_id_idx" ON "oauth_access_tokens"("application_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_authorization_id_idx" ON "oauth_access_tokens"("authorization_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_expires_at_idx" ON "oauth_access_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_scopes_name_key" ON "oauth_scopes"("name");

-- CreateIndex
CREATE INDEX "oauth_scopes_category_idx" ON "oauth_scopes"("category");

-- CreateIndex
CREATE INDEX "oauth_scopes_risk_level_idx" ON "oauth_scopes"("risk_level");

-- CreateIndex
CREATE INDEX "ow_cache_kv_user_id_idx" ON "ow_cache_kv"("user_id");

-- CreateIndex
CREATE INDEX "ow_cache_kv_key_idx" ON "ow_cache_kv"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ow_coderun_devices_runner_token_key" ON "ow_coderun_devices"("runner_token");

-- CreateIndex
CREATE INDEX "ow_coderun_devices_status_idx" ON "ow_coderun_devices"("status");

-- CreateIndex
CREATE INDEX "ow_coderun_devices_runner_token_idx" ON "ow_coderun_devices"("runner_token");

-- CreateIndex
CREATE INDEX "ow_scratch_extensions_projectid_idx" ON "ow_scratch_extensions"("projectid");

-- CreateIndex
CREATE INDEX "ow_scratch_extensions_status_idx" ON "ow_scratch_extensions"("status");

-- CreateIndex
CREATE INDEX "ow_scratch_extensions_samples_idx" ON "ow_scratch_extensions"("samples");

-- CreateIndex
CREATE UNIQUE INDEX "ow_account_tokens_token_key" ON "ow_account_tokens"("token");

-- CreateIndex
CREATE INDEX "ow_account_tokens_user_id_idx" ON "ow_account_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ow_account_tokens_token_idx" ON "ow_account_tokens"("token");

-- CreateIndex
CREATE INDEX "ow_account_tokens_is_revoked_idx" ON "ow_account_tokens"("is_revoked");

-- CreateIndex
CREATE INDEX "ow_account_tokens_expires_at_idx" ON "ow_account_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "ow_projects_assets_project_id_idx" ON "ow_projects_assets"("project_id");

-- CreateIndex
CREATE INDEX "ow_projects_assets_asset_id_idx" ON "ow_projects_assets"("asset_id");

-- CreateIndex
CREATE INDEX "ow_projects_assets_usage_context_idx" ON "ow_projects_assets"("usage_context");

-- CreateIndex
CREATE UNIQUE INDEX "ow_projects_assets_project_id_asset_id_key" ON "ow_projects_assets"("project_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_assets_md5_key" ON "ow_assets"("md5");

-- CreateIndex
CREATE INDEX "ow_assets_md5_idx" ON "ow_assets"("md5");

-- CreateIndex
CREATE INDEX "ow_assets_uploader_id_idx" ON "ow_assets"("uploader_id");

-- CreateIndex
CREATE INDEX "ow_assets_created_at_idx" ON "ow_assets"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_assets_is_banned_idx" ON "ow_assets"("is_banned");

-- CreateIndex
CREATE INDEX "ow_assets_extension_idx" ON "ow_assets"("extension");

-- CreateIndex
CREATE INDEX "ow_assets_category_idx" ON "ow_assets"("category");

-- CreateIndex
CREATE INDEX "ow_assets_usage_count_idx" ON "ow_assets"("usage_count");

-- CreateIndex
CREATE INDEX "ow_push_subscriptions_user_id_idx" ON "ow_push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "ow_push_subscriptions_is_active_idx" ON "ow_push_subscriptions"("is_active");

-- CreateIndex
CREATE INDEX "ow_push_subscriptions_last_used_at_idx" ON "ow_push_subscriptions"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "ow_push_subscriptions_user_id_endpoint_key" ON "ow_push_subscriptions"("user_id", "endpoint");
