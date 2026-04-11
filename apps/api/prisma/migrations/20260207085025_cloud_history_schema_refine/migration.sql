-- DropIndex
DROP INDEX "idx_ow_posts_content_trgm";

-- DropIndex
DROP INDEX "idx_ow_projects_description_trgm";

-- DropIndex
DROP INDEX "idx_ow_projects_name_trgm";

-- DropIndex
DROP INDEX "idx_ow_projects_title_trgm";

-- DropIndex
DROP INDEX "idx_ow_projects_file_create_time";

-- DropIndex
DROP INDEX "idx_ow_projects_file_create_userid";

-- DropIndex
DROP INDEX "idx_ow_users_bio_trgm";

-- DropIndex
DROP INDEX "idx_ow_users_display_name_trgm";

-- DropIndex
DROP INDEX "idx_ow_users_location_trgm";

-- DropIndex
DROP INDEX "idx_ow_users_motto_trgm";

-- DropIndex
DROP INDEX "idx_ow_users_region_trgm";

-- DropIndex
DROP INDEX "idx_ow_users_username_trgm";

-- CreateTable
CREATE TABLE "project_config" (
    "id" SERIAL NOT NULL,
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "project_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_clouddata_history" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "method" VARCHAR(32) NOT NULL,
    "name" VARCHAR(1024) NOT NULL,
    "value" TEXT,
    "actor_id" INTEGER,
    "actor_name" VARCHAR(255),
    "ip" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_clouddata_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_config_target_type_target_id_idx" ON "project_config"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "project_config_key_idx" ON "project_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "project_config_target_type_target_id_key_key" ON "project_config"("target_type", "target_id", "key");

-- CreateIndex
CREATE INDEX "project_clouddata_history_project_id_created_at_idx" ON "project_clouddata_history"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "project_clouddata_history_method_idx" ON "project_clouddata_history"("method");

-- CreateIndex
CREATE INDEX "project_clouddata_history_actor_id_idx" ON "project_clouddata_history"("actor_id");
