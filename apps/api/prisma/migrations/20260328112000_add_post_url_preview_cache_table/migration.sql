-- CreateTable
CREATE TABLE "ow_post_url_previews" (
    "cache_key" VARCHAR(96) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_post_url_previews_pkey" PRIMARY KEY ("cache_key")
);

-- CreateIndex
CREATE INDEX "idx_ow_post_url_previews_expires_at"
ON "ow_post_url_previews"("expires_at");
