-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('USER', 'PROJECT');

-- CreateEnum
CREATE TYPE "NotificationLevel" AS ENUM ('DEFAULT', 'ALL', 'NONE');

-- AlterTable
ALTER TABLE "ow_post_url_previews" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ow_notification_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "target_type" "NotificationTargetType" NOT NULL,
    "level" "NotificationLevel" NOT NULL DEFAULT 'DEFAULT',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ow_notification_settings_user_id_idx" ON "ow_notification_settings"("user_id");

-- CreateIndex
CREATE INDEX "ow_notification_settings_target_type_target_id_idx" ON "ow_notification_settings"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_notification_settings_user_id_target_type_target_id_key" ON "ow_notification_settings"("user_id", "target_type", "target_id");
