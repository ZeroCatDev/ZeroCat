/*
  Warnings:

  - You are about to drop the `ow_account_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ow_auth_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ow_users" ALTER COLUMN "images" SET DEFAULT '870582712ab041107f1571285bc95a83',
ALTER COLUMN "avatar" SET DEFAULT '870582712ab041107f1571285bc95a83';

-- DropTable
DROP TABLE "ow_account_tokens";

-- DropTable
DROP TABLE "ow_auth_tokens";

-- CreateTable
CREATE TABLE "ow_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "type" VARCHAR(20) NOT NULL DEFAULT 'session',
    "name" VARCHAR(255),
    "token_hash" VARCHAR(64) NOT NULL,
    "token_prefix" VARCHAR(32),
    "refresh_token_hash" VARCHAR(64),
    "scopes" JSONB NOT NULL,
    "application_id" INTEGER,
    "authorization_id" INTEGER,
    "expires_at" TIMESTAMP(6),
    "refresh_expires_at" TIMESTAMP(6),
    "last_used_at" TIMESTAMP(6),
    "last_used_ip" VARCHAR(100),
    "activity_count" INTEGER NOT NULL DEFAULT 0,
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "device_info" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ow_tokens_token_hash_key" ON "ow_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "ow_tokens_refresh_token_hash_key" ON "ow_tokens"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "ow_tokens_token_hash_idx" ON "ow_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "ow_tokens_refresh_token_hash_idx" ON "ow_tokens"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "ow_tokens_user_id_idx" ON "ow_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ow_tokens_type_idx" ON "ow_tokens"("type");

-- CreateIndex
CREATE INDEX "ow_tokens_application_id_idx" ON "ow_tokens"("application_id");

-- CreateIndex
CREATE INDEX "ow_tokens_authorization_id_idx" ON "ow_tokens"("authorization_id");

-- CreateIndex
CREATE INDEX "ow_tokens_expires_at_idx" ON "ow_tokens"("expires_at");
