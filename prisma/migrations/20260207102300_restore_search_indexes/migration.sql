-- CreateIndex
CREATE INDEX "idx_ow_posts_content_trgm" ON "ow_posts" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_projects_name_trgm" ON "ow_projects" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_projects_title_trgm" ON "ow_projects" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_projects_description_trgm" ON "ow_projects" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_projects_file_create_time" ON "ow_projects_file"("create_time");

-- CreateIndex
CREATE INDEX "idx_ow_projects_file_create_userid" ON "ow_projects_file"("create_userid");

-- CreateIndex
CREATE INDEX "idx_ow_users_username_trgm" ON "ow_users" USING GIN ("username" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_users_display_name_trgm" ON "ow_users" USING GIN ("display_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_users_bio_trgm" ON "ow_users" USING GIN ("bio" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_users_motto_trgm" ON "ow_users" USING GIN ("motto" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_users_location_trgm" ON "ow_users" USING GIN ("location" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_ow_users_region_trgm" ON "ow_users" USING GIN ("region" gin_trgm_ops);
