/*
  Warnings:

  - The primary key for the `ow_cache_kv` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `user_id` on the `ow_cache_kv` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `actor_id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/

BEGIN;
-- AlterTable
ALTER TABLE "oauth_applications" RENAME CONSTRAINT "idx_20872_PRIMARY" TO "idx_19042_PRIMARY";
ALTER TABLE "oauth_applications" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_account_tokens" RENAME CONSTRAINT "idx_20883_PRIMARY" TO "idx_19053_PRIMARY";
ALTER TABLE "ow_account_tokens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_analytics_device" RENAME CONSTRAINT "idx_20890_PRIMARY" TO "idx_19060_PRIMARY";

-- AlterTable
ALTER TABLE "ow_analytics_event" RENAME CONSTRAINT "idx_20897_PRIMARY" TO "idx_19067_PRIMARY";

-- AlterTable
ALTER TABLE "ow_assets" RENAME CONSTRAINT "idx_20903_PRIMARY" TO "idx_19073_PRIMARY";
ALTER TABLE "ow_assets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_auth_tokens" RENAME CONSTRAINT "idx_20911_PRIMARY" TO "idx_19081_PRIMARY";

-- AlterTable
ALTER TABLE "ow_cache_kv" DROP CONSTRAINT "idx_20920_PRIMARY";
ALTER TABLE "ow_cache_kv" ALTER COLUMN "user_id" SET DATA TYPE INTEGER;
ALTER TABLE "ow_cache_kv" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ow_cache_kv" ADD CONSTRAINT "ow_cache_kv_pkey" PRIMARY KEY ("user_id", "key");

-- AlterTable
ALTER TABLE "ow_coderun_devices" RENAME CONSTRAINT "idx_20927_PRIMARY" TO "idx_19097_PRIMARY";
ALTER TABLE "ow_coderun_devices" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_comment" RENAME CONSTRAINT "idx_20935_PRIMARY" TO "idx_19105_PRIMARY";

-- AlterTable
ALTER TABLE "ow_config" RENAME CONSTRAINT "idx_20947_PRIMARY" TO "idx_19117_PRIMARY";

-- AlterTable
ALTER TABLE "ow_events" RENAME CONSTRAINT "idx_20956_PRIMARY" TO "idx_19126_PRIMARY";
ALTER TABLE "ow_events" ALTER COLUMN "actor_id" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_notifications" RENAME CONSTRAINT "idx_20965_PRIMARY" TO "idx_19135_PRIMARY";

-- AlterTable
ALTER TABLE "ow_oauth_access_tokens" RENAME CONSTRAINT "idx_20976_PRIMARY" TO "idx_19146_PRIMARY";
ALTER TABLE "ow_oauth_access_tokens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_oauth_authorizations" RENAME CONSTRAINT "idx_20983_PRIMARY" TO "idx_19153_PRIMARY";
ALTER TABLE "ow_oauth_authorizations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_oauth_scopes" RENAME CONSTRAINT "idx_20990_PRIMARY" TO "idx_19160_PRIMARY";
ALTER TABLE "ow_oauth_scopes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_projects" RENAME CONSTRAINT "idx_21000_PRIMARY" TO "idx_19170_PRIMARY";

-- AlterTable
ALTER TABLE "ow_projects_assets" RENAME CONSTRAINT "idx_21019_PRIMARY" TO "idx_19189_PRIMARY";
ALTER TABLE "ow_projects_assets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_projects_branch" RENAME CONSTRAINT "idx_21024_PRIMARY" TO "idx_19194_PRIMARY";
ALTER TABLE "ow_projects_branch" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_commits" RENAME CONSTRAINT "idx_21028_PRIMARY" TO "idx_19198_PRIMARY";

-- AlterTable
ALTER TABLE "ow_projects_file" RENAME CONSTRAINT "idx_21034_PRIMARY" TO "idx_19204_PRIMARY";

-- AlterTable
ALTER TABLE "ow_projects_history" RENAME CONSTRAINT "idx_21041_PRIMARY" TO "idx_19211_PRIMARY";

-- AlterTable
ALTER TABLE "ow_projects_list_items" RENAME CONSTRAINT "idx_21052_PRIMARY" TO "idx_19222_PRIMARY";
ALTER TABLE "ow_projects_list_items" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_lists" RENAME CONSTRAINT "idx_21056_PRIMARY" TO "idx_19226_PRIMARY";

-- AlterTable
ALTER TABLE "ow_projects_stars" RENAME CONSTRAINT "idx_21065_PRIMARY" TO "idx_19235_PRIMARY";
ALTER TABLE "ow_projects_stars" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_tags" RENAME CONSTRAINT "idx_21069_PRIMARY" TO "idx_19239_PRIMARY";
ALTER TABLE "ow_projects_tags" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_push_subscriptions" RENAME CONSTRAINT "idx_21073_PRIMARY" TO "idx_19243_PRIMARY";
ALTER TABLE "ow_push_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_scratch_extensions" RENAME CONSTRAINT "idx_21080_PRIMARY" TO "idx_19250_PRIMARY";
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_user_relationships" RENAME CONSTRAINT "idx_21090_PRIMARY" TO "idx_19260_PRIMARY";
ALTER TABLE "ow_user_relationships" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_users" RENAME CONSTRAINT "idx_21096_PRIMARY" TO "idx_19266_PRIMARY";
ALTER TABLE "ow_users" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_users_contacts" RENAME CONSTRAINT "idx_21111_PRIMARY" TO "idx_19281_PRIMARY";

-- AlterTable
ALTER TABLE "ow_users_magiclink" RENAME CONSTRAINT "idx_21120_PRIMARY" TO "idx_19290_PRIMARY";

-- AlterTable
ALTER TABLE "ow_users_totp" RENAME CONSTRAINT "idx_21123_PRIMARY" TO "idx_19293_PRIMARY";

-- RenameIndex
ALTER INDEX "idx_20872_oauth_applications_client_id_idx" RENAME TO "idx_19042_oauth_applications_client_id_idx";

-- RenameIndex
ALTER INDEX "idx_20872_oauth_applications_client_id_key" RENAME TO "idx_19042_oauth_applications_client_id_key";

-- RenameIndex
ALTER INDEX "idx_20872_oauth_applications_owner_id_idx" RENAME TO "idx_19042_oauth_applications_owner_id_idx";

-- RenameIndex
ALTER INDEX "idx_20883_ow_account_tokens_expires_at_idx" RENAME TO "idx_19053_ow_account_tokens_expires_at_idx";

-- RenameIndex
ALTER INDEX "idx_20883_ow_account_tokens_is_revoked_idx" RENAME TO "idx_19053_ow_account_tokens_is_revoked_idx";

-- RenameIndex
ALTER INDEX "idx_20883_ow_account_tokens_token_idx" RENAME TO "idx_19053_ow_account_tokens_token_idx";

-- RenameIndex
ALTER INDEX "idx_20883_ow_account_tokens_token_key" RENAME TO "idx_19053_ow_account_tokens_token_key";

-- RenameIndex
ALTER INDEX "idx_20883_ow_account_tokens_user_id_idx" RENAME TO "idx_19053_ow_account_tokens_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20890_ow_analytics_device_fingerprint_user_id_key" RENAME TO "idx_19060_ow_analytics_device_fingerprint_user_id_key";

-- RenameIndex
ALTER INDEX "idx_20890_ow_analytics_device_first_seen_idx" RENAME TO "idx_19060_ow_analytics_device_first_seen_idx";

-- RenameIndex
ALTER INDEX "idx_20890_ow_analytics_device_last_seen_idx" RENAME TO "idx_19060_ow_analytics_device_last_seen_idx";

-- RenameIndex
ALTER INDEX "idx_20890_ow_analytics_device_user_id_idx" RENAME TO "idx_19060_ow_analytics_device_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20897_ow_analytics_event_created_at_idx" RENAME TO "idx_19067_ow_analytics_event_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_20897_ow_analytics_event_device_id_idx" RENAME TO "idx_19067_ow_analytics_event_device_id_idx";

-- RenameIndex
ALTER INDEX "idx_20897_ow_analytics_event_ip_address_idx" RENAME TO "idx_19067_ow_analytics_event_ip_address_idx";

-- RenameIndex
ALTER INDEX "idx_20897_ow_analytics_event_referrer_domain_idx" RENAME TO "idx_19067_ow_analytics_event_referrer_domain_idx";

-- RenameIndex
ALTER INDEX "idx_20897_ow_analytics_event_user_id_idx" RENAME TO "idx_19067_ow_analytics_event_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_category_idx" RENAME TO "idx_19073_ow_assets_category_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_created_at_idx" RENAME TO "idx_19073_ow_assets_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_extension_idx" RENAME TO "idx_19073_ow_assets_extension_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_is_banned_idx" RENAME TO "idx_19073_ow_assets_is_banned_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_md5_idx" RENAME TO "idx_19073_ow_assets_md5_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_md5_key" RENAME TO "idx_19073_ow_assets_md5_key";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_uploader_id_idx" RENAME TO "idx_19073_ow_assets_uploader_id_idx";

-- RenameIndex
ALTER INDEX "idx_20903_ow_assets_usage_count_idx" RENAME TO "idx_19073_ow_assets_usage_count_idx";

-- RenameIndex
ALTER INDEX "idx_20911_idx_access_token" RENAME TO "idx_19081_idx_access_token";

-- RenameIndex
ALTER INDEX "idx_20911_idx_refresh_token" RENAME TO "idx_19081_idx_refresh_token";

-- RenameIndex
ALTER INDEX "idx_20911_idx_tokens_last_used_at" RENAME TO "idx_19081_idx_tokens_last_used_at";

-- RenameIndex
ALTER INDEX "idx_20911_idx_tokens_last_used_ip" RENAME TO "idx_19081_idx_tokens_last_used_ip";

-- RenameIndex
ALTER INDEX "idx_20911_idx_user_id" RENAME TO "idx_19081_idx_user_id";

-- RenameIndex
ALTER INDEX "idx_20920_ow_cache_kv_key_idx" RENAME TO "idx_19090_ow_cache_kv_key_idx";

-- RenameIndex
ALTER INDEX "idx_20920_ow_cache_kv_user_id_idx" RENAME TO "idx_19090_ow_cache_kv_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20927_ow_coderun_devices_runner_token_idx" RENAME TO "idx_19097_ow_coderun_devices_runner_token_idx";

-- RenameIndex
ALTER INDEX "idx_20927_ow_coderun_devices_runner_token_key" RENAME TO "idx_19097_ow_coderun_devices_runner_token_key";

-- RenameIndex
ALTER INDEX "idx_20927_ow_coderun_devices_status_idx" RENAME TO "idx_19097_ow_coderun_devices_status_idx";

-- RenameIndex
ALTER INDEX "idx_20935_idx_comment_user" RENAME TO "idx_19105_idx_comment_user";

-- RenameIndex
ALTER INDEX "idx_20935_idx_projects_comments" RENAME TO "idx_19105_idx_projects_comments";

-- RenameIndex
ALTER INDEX "idx_20947_config_key" RENAME TO "idx_19117_config_key";

-- RenameIndex
ALTER INDEX "idx_20956_idx_created" RENAME TO "idx_19126_idx_created";

-- RenameIndex
ALTER INDEX "idx_20956_idx_target" RENAME TO "idx_19126_idx_target";

-- RenameIndex
ALTER INDEX "idx_20956_idx_type_actor" RENAME TO "idx_19126_idx_type_actor";

-- RenameIndex
ALTER INDEX "idx_20965_idx_notification_actor" RENAME TO "idx_19135_idx_notification_actor";

-- RenameIndex
ALTER INDEX "idx_20965_idx_notification_hidden" RENAME TO "idx_19135_idx_notification_hidden";

-- RenameIndex
ALTER INDEX "idx_20965_idx_user_all" RENAME TO "idx_19135_idx_user_all";

-- RenameIndex
ALTER INDEX "idx_20965_idx_user_unread" RENAME TO "idx_19135_idx_user_unread";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_access_token_idx" RENAME TO "idx_19146_ow_oauth_access_tokens_access_token_idx";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_access_token_key" RENAME TO "idx_19146_ow_oauth_access_tokens_access_token_key";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_application_id_idx" RENAME TO "idx_19146_ow_oauth_access_tokens_application_id_idx";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_authorization_id_idx" RENAME TO "idx_19146_ow_oauth_access_tokens_authorization_id_idx";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_refresh_token_idx" RENAME TO "idx_19146_ow_oauth_access_tokens_refresh_token_idx";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_refresh_token_key" RENAME TO "idx_19146_ow_oauth_access_tokens_refresh_token_key";

-- RenameIndex
ALTER INDEX "idx_20976_ow_oauth_access_tokens_user_id_idx" RENAME TO "idx_19146_ow_oauth_access_tokens_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20983_ow_oauth_authorizations_application_id_user_id_key" RENAME TO "idx_19153_ow_oauth_authorizations_application_id_user_id_key";

-- RenameIndex
ALTER INDEX "idx_20983_ow_oauth_authorizations_code_idx" RENAME TO "idx_19153_ow_oauth_authorizations_code_idx";

-- RenameIndex
ALTER INDEX "idx_20983_ow_oauth_authorizations_code_key" RENAME TO "idx_19153_ow_oauth_authorizations_code_key";

-- RenameIndex
ALTER INDEX "idx_20983_ow_oauth_authorizations_user_id_idx" RENAME TO "idx_19153_ow_oauth_authorizations_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_20990_ow_oauth_scopes_category_idx" RENAME TO "idx_19160_ow_oauth_scopes_category_idx";

-- RenameIndex
ALTER INDEX "idx_20990_ow_oauth_scopes_name_key" RENAME TO "idx_19160_ow_oauth_scopes_name_key";

-- RenameIndex
ALTER INDEX "idx_20990_ow_oauth_scopes_risk_level_idx" RENAME TO "idx_19160_ow_oauth_scopes_risk_level_idx";

-- RenameIndex
ALTER INDEX "idx_21000_idx_project_author" RENAME TO "idx_19170_idx_project_author";

-- RenameIndex
ALTER INDEX "idx_21000_idx_projects_state" RENAME TO "idx_19170_idx_projects_state";

-- RenameIndex
ALTER INDEX "idx_21019_ow_projects_assets_asset_id_idx" RENAME TO "idx_19189_ow_projects_assets_asset_id_idx";

-- RenameIndex
ALTER INDEX "idx_21019_ow_projects_assets_project_id_asset_id_key" RENAME TO "idx_19189_ow_projects_assets_project_id_asset_id_key";

-- RenameIndex
ALTER INDEX "idx_21019_ow_projects_assets_project_id_idx" RENAME TO "idx_19189_ow_projects_assets_project_id_idx";

-- RenameIndex
ALTER INDEX "idx_21019_ow_projects_assets_usage_context_idx" RENAME TO "idx_19189_ow_projects_assets_usage_context_idx";

-- RenameIndex
ALTER INDEX "idx_21024_idx_branch_creator" RENAME TO "idx_19194_idx_branch_creator";

-- RenameIndex
ALTER INDEX "idx_21024_unique_project_branch" RENAME TO "idx_19194_unique_project_branch";

-- RenameIndex
ALTER INDEX "idx_21028_idx_parent_commit" RENAME TO "idx_19198_idx_parent_commit";

-- RenameIndex
ALTER INDEX "idx_21028_idx_projects_commits_project_date" RENAME TO "idx_19198_idx_projects_commits_project_date";

-- RenameIndex
ALTER INDEX "idx_21052_idx_list_items" RENAME TO "idx_19222_idx_list_items";

-- RenameIndex
ALTER INDEX "idx_21052_idx_project_in_lists" RENAME TO "idx_19222_idx_project_in_lists";

-- RenameIndex
ALTER INDEX "idx_21052_unique_list_project" RENAME TO "idx_19222_unique_list_project";

-- RenameIndex
ALTER INDEX "idx_21056_idx_author_lists" RENAME TO "idx_19226_idx_author_lists";

-- RenameIndex
ALTER INDEX "idx_21065_idx_projects_stars_project" RENAME TO "idx_19235_idx_projects_stars_project";

-- RenameIndex
ALTER INDEX "idx_21065_idx_projects_stars_user" RENAME TO "idx_19235_idx_projects_stars_user";

-- RenameIndex
ALTER INDEX "idx_21069_idx_projectid" RENAME TO "idx_19239_idx_projectid";

-- RenameIndex
ALTER INDEX "idx_21073_ow_push_subscriptions_is_active_idx" RENAME TO "idx_19243_ow_push_subscriptions_is_active_idx";

-- RenameIndex
ALTER INDEX "idx_21073_ow_push_subscriptions_last_used_at_idx" RENAME TO "idx_19243_ow_push_subscriptions_last_used_at_idx";

-- RenameIndex
ALTER INDEX "idx_21073_ow_push_subscriptions_user_id_endpoint_key" RENAME TO "idx_19243_ow_push_subscriptions_user_id_endpoint_key";

-- RenameIndex
ALTER INDEX "idx_21073_ow_push_subscriptions_user_id_idx" RENAME TO "idx_19243_ow_push_subscriptions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_21080_idx_extension_project" RENAME TO "idx_19250_idx_extension_project";

-- RenameIndex
ALTER INDEX "idx_21080_idx_extension_samples" RENAME TO "idx_19250_idx_extension_samples";

-- RenameIndex
ALTER INDEX "idx_21080_idx_extension_status" RENAME TO "idx_19250_idx_extension_status";

-- RenameIndex
ALTER INDEX "idx_21090_idx_source_user_relationships" RENAME TO "idx_19260_idx_source_user_relationships";

-- RenameIndex
ALTER INDEX "idx_21090_idx_target_user_relationships" RENAME TO "idx_19260_idx_target_user_relationships";

-- RenameIndex
ALTER INDEX "idx_21090_ow_user_relationships_source_user_id_target_user_id_r" RENAME TO "idx_19260_ow_user_relationships_source_user_id_target_user_id_r";

-- RenameIndex
ALTER INDEX "idx_21096_id_UNIQUE" RENAME TO "idx_19266_id_UNIQUE";

-- RenameIndex
ALTER INDEX "idx_21096_user_UNIQUE" RENAME TO "idx_19266_user_UNIQUE";

-- RenameIndex
ALTER INDEX "idx_21111_contact_value_UNIQUE" RENAME TO "idx_19281_contact_value_UNIQUE";

-- RenameIndex
ALTER INDEX "idx_21111_idx_user_contact_type" RENAME TO "idx_19281_idx_user_contact_type";

-- RenameIndex
ALTER INDEX "idx_21111_idx_user_contacts" RENAME TO "idx_19281_idx_user_contacts";

-- RenameIndex
ALTER INDEX "idx_21120_token" RENAME TO "idx_19290_token";


COMMIT;