/*
  Warnings:

  - The primary key for the `ow_cache_kv` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `user_id` on the `ow_cache_kv` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `actor_id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "oauth_applications" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_account_tokens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_assets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_cache_kv" DROP CONSTRAINT "idx_19090_PRIMARY",
ALTER COLUMN "user_id" SET DATA TYPE INTEGER,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "idx_19090_PRIMARY" PRIMARY KEY ("user_id", "key");

-- AlterTable
ALTER TABLE "ow_coderun_devices" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_events" ALTER COLUMN "actor_id" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_oauth_access_tokens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_oauth_authorizations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_oauth_scopes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_projects_assets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_projects_branch" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_list_items" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_stars" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_projects_tags" ALTER COLUMN "projectid" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ow_push_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "projectid" SET DATA TYPE BIGINT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_user_relationships" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ow_users" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
