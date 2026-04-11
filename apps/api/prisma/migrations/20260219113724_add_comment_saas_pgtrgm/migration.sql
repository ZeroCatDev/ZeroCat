-- CreateIndex
CREATE INDEX "idx_ow_comment_service_comment_trgm" ON "ow_comment_service" USING GIN ("comment" gin_trgm_ops);
