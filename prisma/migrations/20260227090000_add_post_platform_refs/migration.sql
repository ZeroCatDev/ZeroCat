ALTER TABLE "ow_posts"
ADD COLUMN IF NOT EXISTS "platform_refs" JSONB;

UPDATE "ow_posts"
SET "platform_refs" = '{}'::jsonb
WHERE "platform_refs" IS NULL;
