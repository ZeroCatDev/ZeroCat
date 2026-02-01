-- AlterTable
ALTER TABLE "oauth_applications" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_account_tokens" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_analytics_device" ALTER COLUMN "first_seen" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "last_seen" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_analytics_event" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_assets" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_auth_tokens" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "updated_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_cache_kv" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_coderun_devices" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_comment" ALTER COLUMN "insertedat" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "createdat" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "updatedat" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_config" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "updated_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_events" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_notifications" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_oauth_access_tokens" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_oauth_authorizations" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_oauth_scopes" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects" ALTER COLUMN "time" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_assets" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_file" ALTER COLUMN "create_time" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_history" ALTER COLUMN "time" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_list_items" ALTER COLUMN "createtime" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_lists" ALTER COLUMN "createtime" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_stars" ALTER COLUMN "createtime" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_projects_tags" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_user_relationships" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_users" ALTER COLUMN "logintime" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "regtime" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "createdat" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_users_contacts" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "updated_at" SET DEFAULT timezone('Asia/Shanghai', now());

-- AlterTable
ALTER TABLE "ow_users_totp" ALTER COLUMN "created_at" SET DEFAULT timezone('Asia/Shanghai', now()),
ALTER COLUMN "updated_at" SET DEFAULT timezone('Asia/Shanghai', now());
