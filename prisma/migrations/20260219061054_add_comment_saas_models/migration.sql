/*
  Warnings:

  - A unique constraint covering the columns `[projectid]` on the table `ow_scratch_extensions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "ow_comment_spaces" (
    "id" SERIAL NOT NULL,
    "cuid" VARCHAR(32) NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "domain" VARCHAR(255),
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "jwt_secret" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_comment_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_comment_service" (
    "id" SERIAL NOT NULL,
    "space_id" INTEGER NOT NULL,
    "user_id" VARCHAR(64),
    "nick" VARCHAR(128),
    "mail" VARCHAR(255),
    "link" VARCHAR(255),
    "comment" TEXT NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "ua" TEXT,
    "ip" VARCHAR(100),
    "status" VARCHAR(32) NOT NULL DEFAULT 'approved',
    "pid" VARCHAR(64),
    "rid" VARCHAR(64),
    "like" INTEGER NOT NULL DEFAULT 0,
    "sticky" BOOLEAN NOT NULL DEFAULT false,
    "insertedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_comment_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_comment_service_users" (
    "id" SERIAL NOT NULL,
    "space_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(32) NOT NULL DEFAULT 'guest',
    "display_name" VARCHAR(128),
    "email" VARCHAR(255),
    "url" VARCHAR(255),
    "avatar" VARCHAR(255),
    "label" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_comment_service_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_comment_service_counter" (
    "id" SERIAL NOT NULL,
    "space_id" INTEGER NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "time" INTEGER NOT NULL DEFAULT 0,
    "reaction0" INTEGER NOT NULL DEFAULT 0,
    "reaction1" INTEGER NOT NULL DEFAULT 0,
    "reaction2" INTEGER NOT NULL DEFAULT 0,
    "reaction3" INTEGER NOT NULL DEFAULT 0,
    "reaction4" INTEGER NOT NULL DEFAULT 0,
    "reaction5" INTEGER NOT NULL DEFAULT 0,
    "reaction6" INTEGER NOT NULL DEFAULT 0,
    "reaction7" INTEGER NOT NULL DEFAULT 0,
    "reaction8" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ow_comment_service_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ow_comment_spaces_cuid_key" ON "ow_comment_spaces"("cuid");

-- CreateIndex
CREATE INDEX "ow_comment_spaces_owner_id_idx" ON "ow_comment_spaces"("owner_id");

-- CreateIndex
CREATE INDEX "ow_comment_spaces_status_idx" ON "ow_comment_spaces"("status");

-- CreateIndex
CREATE INDEX "ow_comment_service_space_id_url_status_idx" ON "ow_comment_service"("space_id", "url", "status");

-- CreateIndex
CREATE INDEX "ow_comment_service_space_id_insertedAt_idx" ON "ow_comment_service"("space_id", "insertedAt" DESC);

-- CreateIndex
CREATE INDEX "ow_comment_service_space_id_rid_idx" ON "ow_comment_service"("space_id", "rid");

-- CreateIndex
CREATE INDEX "ow_comment_service_space_id_user_id_idx" ON "ow_comment_service"("space_id", "user_id");

-- CreateIndex
CREATE INDEX "ow_comment_service_space_id_ip_idx" ON "ow_comment_service"("space_id", "ip");

-- CreateIndex
CREATE INDEX "ow_comment_service_users_space_id_idx" ON "ow_comment_service_users"("space_id");

-- CreateIndex
CREATE INDEX "ow_comment_service_users_user_id_idx" ON "ow_comment_service_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_comment_service_users_space_id_user_id_key" ON "ow_comment_service_users"("space_id", "user_id");

-- CreateIndex
CREATE INDEX "ow_comment_service_counter_space_id_idx" ON "ow_comment_service_counter"("space_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_comment_service_counter_space_id_url_key" ON "ow_comment_service_counter"("space_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ow_scratch_extensions_projectid_key" ON "ow_scratch_extensions"("projectid");
