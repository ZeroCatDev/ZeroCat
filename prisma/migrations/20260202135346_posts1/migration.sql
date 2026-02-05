-- CreateEnum
CREATE TYPE "ow_post_type" AS ENUM ('normal', 'reply', 'retweet', 'quote');

-- CreateTable
CREATE TABLE "ow_posts" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "post_type" "ow_post_type" NOT NULL DEFAULT 'normal',
    "content" TEXT,
    "character_count" INTEGER NOT NULL DEFAULT 0,
    "in_reply_to_id" INTEGER,
    "thread_root_id" INTEGER,
    "quoted_post_id" INTEGER,
    "retweet_post_id" INTEGER,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "retweet_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "bookmark_count" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ow_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_posts_mention" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ow_posts_mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_posts_like" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_posts_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_posts_bookmark" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_posts_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ow_posts_media" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "asset_id" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_posts_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ow_posts_author_id_created_at_idx" ON "ow_posts"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_created_at_idx" ON "ow_posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_in_reply_to_id_idx" ON "ow_posts"("in_reply_to_id");

-- CreateIndex
CREATE INDEX "ow_posts_thread_root_id_idx" ON "ow_posts"("thread_root_id");

-- CreateIndex
CREATE INDEX "ow_posts_quoted_post_id_idx" ON "ow_posts"("quoted_post_id");

-- CreateIndex
CREATE INDEX "ow_posts_retweet_post_id_idx" ON "ow_posts"("retweet_post_id");

-- CreateIndex
CREATE INDEX "ow_posts_post_type_idx" ON "ow_posts"("post_type");

-- CreateIndex
CREATE INDEX "ow_posts_is_deleted_idx" ON "ow_posts"("is_deleted");

-- CreateIndex
CREATE INDEX "ow_posts_is_deleted_created_at_idx" ON "ow_posts"("is_deleted", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_thread_root_id_created_at_idx" ON "ow_posts"("thread_root_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "ow_posts_mention_user_id_created_at_idx" ON "ow_posts_mention"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_mention_post_id_idx" ON "ow_posts_mention"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_posts_mention_post_id_user_id_key" ON "ow_posts_mention"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "ow_posts_like_user_id_created_at_idx" ON "ow_posts_like"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_like_post_id_idx" ON "ow_posts_like"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_posts_like_user_id_post_id_key" ON "ow_posts_like"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "ow_posts_bookmark_user_id_created_at_idx" ON "ow_posts_bookmark"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ow_posts_bookmark_post_id_idx" ON "ow_posts_bookmark"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_posts_bookmark_user_id_post_id_key" ON "ow_posts_bookmark"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "ow_posts_media_post_id_idx" ON "ow_posts_media"("post_id");

-- CreateIndex
CREATE INDEX "ow_posts_media_asset_id_idx" ON "ow_posts_media"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_posts_media_post_id_asset_id_key" ON "ow_posts_media"("post_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ow_posts_media_post_id_order_key" ON "ow_posts_media"("post_id", "order");
