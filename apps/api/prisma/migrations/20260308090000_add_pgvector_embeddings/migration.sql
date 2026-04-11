-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "ow_embeddings" (
    "id"          SERIAL       PRIMARY KEY,
    "entity_type" VARCHAR(32)  NOT NULL,
    "entity_id"   INTEGER      NOT NULL,
    "embedding"   vector(1536),
    "text_hash"   VARCHAR(64),
    "model"       VARCHAR(128),
    "created_at"  TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

-- Unique constraint
ALTER TABLE "ow_embeddings" ADD CONSTRAINT "ow_embeddings_entity_type_entity_id_key"
    UNIQUE ("entity_type", "entity_id");

-- B-Tree index for entity lookups
CREATE INDEX "ow_embeddings_entity_type_entity_id_idx"
    ON "ow_embeddings" ("entity_type", "entity_id");

-- HNSW vector cosine index for similarity search
CREATE INDEX "idx_ow_embeddings_vector"
    ON "ow_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- Add embedding_at column to ow_posts (tracks last embedding generation time)
ALTER TABLE "ow_posts" ADD COLUMN "embedding_at" TIMESTAMP(6);
CREATE INDEX "ow_posts_embedding_at_idx" ON "ow_posts" ("embedding_at");

-- Add embedding_at column to ow_users (tracks last embedding generation time)
ALTER TABLE "ow_users" ADD COLUMN "embedding_at" TIMESTAMP(6);
CREATE INDEX "ow_users_embedding_at_idx" ON "ow_users" ("embedding_at");
