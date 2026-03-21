-- Alter ow_embeddings.embedding from vector(1536) to vector(2560)
-- Prisma currently cannot safely express this change for pgvector dimensions.
-- NOTE: Existing vectors are set to NULL and should be regenerated after migration.

-- Drop old vector index first (dimension-specific operator class metadata)
DROP INDEX IF EXISTS "idx_ow_embeddings_vector";

-- Reset old vectors to avoid cast/dimension mismatch failures
UPDATE "ow_embeddings"
SET "embedding" = NULL
WHERE "embedding" IS NOT NULL;

-- Alter vector dimension
ALTER TABLE "ow_embeddings"
ALTER COLUMN "embedding" TYPE vector(2560);

-- Recreate vector cosine index for the new dimension.
-- pgvector (current version) limits HNSW index on vector dimensions to <= 2000.
-- For higher dimensions (e.g. 2560), we keep the column and skip vector index creation.
DO $$
BEGIN
	EXECUTE 'CREATE INDEX IF NOT EXISTS "idx_ow_embeddings_vector" ON "ow_embeddings" USING hnsw ("embedding" vector_cosine_ops)';
EXCEPTION
	WHEN SQLSTATE '54000' THEN
		RAISE NOTICE 'Skip creating idx_ow_embeddings_vector: HNSW does not support current embedding dimension in this pgvector version.';
END
$$;
