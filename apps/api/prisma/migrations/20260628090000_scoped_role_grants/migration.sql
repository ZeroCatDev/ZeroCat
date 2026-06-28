-- Scoped (instance-level) role grants.
-- Account-wide grants use sentinel target ('global','global); resource-scoped grants
-- (e.g. project collaboration) carry target_type/target_id. The unique constraint becomes a
-- 4-tuple so the same role can be granted on multiple targets.

-- Backfill any existing NULL targets to the sentinel so the columns can be made NOT NULL.
UPDATE "ow_user_roles" SET "target_type" = 'global' WHERE "target_type" IS NULL;
UPDATE "ow_user_roles" SET "target_id" = 'global' WHERE "target_id" IS NULL;

ALTER TABLE "ow_user_roles"
    ALTER COLUMN "target_type" SET NOT NULL,
    ALTER COLUMN "target_type" SET DEFAULT 'global',
    ALTER COLUMN "target_id" SET NOT NULL,
    ALTER COLUMN "target_id" SET DEFAULT 'global';

-- Swap (user_id, role_id) unique for the target-aware 4-tuple.
DROP INDEX IF EXISTS "ow_user_roles_user_id_role_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ow_user_roles_user_id_role_id_target_type_target_id_key"
    ON "ow_user_roles"("user_id", "role_id", "target_type", "target_id");
