-- DropIndex
DROP INDEX "idx_ow_embeddings_vector";

-- CreateTable
CREATE TABLE "ow_user_embedding_updates" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "trigger_type" VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    "algorithm" VARCHAR(64) NOT NULL DEFAULT 'interest_decay_v1',
    "profile_text_hash" VARCHAR(64),
    "interaction_hash" VARCHAR(64),
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "base_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interaction_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hot_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "decay_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_user_embedding_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ow_user_embedding_updates_user_created" ON "ow_user_embedding_updates"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ow_user_embedding_updates_trigger" ON "ow_user_embedding_updates"("trigger_type", "created_at" DESC);
