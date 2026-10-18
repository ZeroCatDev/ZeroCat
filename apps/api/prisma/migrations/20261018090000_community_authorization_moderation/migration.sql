ALTER TABLE "ow_projects"
  ADD COLUMN "deleted_at" TIMESTAMP(6),
  ADD COLUMN "deleted_by" INTEGER,
  ADD COLUMN "deletion_source" VARCHAR(32),
  ADD COLUMN "deletion_reason" VARCHAR(1000),
  ADD COLUMN "is_shadowbanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shadowban_expires_at" TIMESTAMP(6),
  ADD COLUMN "shadowban_by" INTEGER,
  ADD COLUMN "shadowban_reason" VARCHAR(1000);

ALTER TABLE "ow_posts"
  ADD COLUMN "deleted_at" TIMESTAMP(6),
  ADD COLUMN "deleted_by" INTEGER,
  ADD COLUMN "deletion_source" VARCHAR(32),
  ADD COLUMN "deletion_reason" VARCHAR(1000),
  ADD COLUMN "is_shadowbanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shadowban_expires_at" TIMESTAMP(6),
  ADD COLUMN "shadowban_by" INTEGER,
  ADD COLUMN "shadowban_reason" VARCHAR(1000);

UPDATE "ow_posts" SET "deleted_at" = "updated_at", "deletion_source" = 'legacy'
WHERE "is_deleted" = true;

CREATE TABLE "ow_role_inheritance" (
  "role_id" INTEGER NOT NULL,
  "parent_role_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_role_inheritance_pkey" PRIMARY KEY ("role_id", "parent_role_id"),
  CONSTRAINT "ow_role_inheritance_no_self" CHECK ("role_id" <> "parent_role_id")
);
CREATE INDEX "ow_role_inheritance_parent_role_id_idx" ON "ow_role_inheritance"("parent_role_id");

CREATE TABLE "ow_user_permissions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "scope" VARCHAR(160) NOT NULL,
  "effect" VARCHAR(16) NOT NULL DEFAULT 'allow',
  "target_type" VARCHAR(64) NOT NULL DEFAULT 'global',
  "target_id" VARCHAR(64) NOT NULL DEFAULT 'global',
  "assigned_by" INTEGER,
  "reason" VARCHAR(1000),
  "expires_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_user_permissions_effect_check" CHECK ("effect" IN ('allow', 'deny')),
  CONSTRAINT "ow_user_permissions_target_check" CHECK (("target_type" = 'global') = ("target_id" = 'global'))
);
CREATE UNIQUE INDEX "ow_user_permissions_user_id_scope_effect_target_type_target_id_key"
  ON "ow_user_permissions"("user_id", "scope", "effect", "target_type", "target_id");
CREATE INDEX "ow_user_permissions_user_id_target_type_target_id_idx" ON "ow_user_permissions"("user_id", "target_type", "target_id");
CREATE INDEX "ow_user_permissions_expires_at_idx" ON "ow_user_permissions"("expires_at");
CREATE INDEX "ow_user_permissions_assigned_by_idx" ON "ow_user_permissions"("assigned_by");

CREATE TABLE "ow_permission_delegations" (
  "id" SERIAL PRIMARY KEY,
  "grantor_id" INTEGER NOT NULL,
  "delegate_id" INTEGER NOT NULL,
  "target_type" VARCHAR(64) NOT NULL,
  "target_id" VARCHAR(64) NOT NULL,
  "scopes" JSONB NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "reason" VARCHAR(1000),
  "expires_at" TIMESTAMP(6),
  "accepted_at" TIMESTAMP(6),
  "revoked_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_permission_delegations_subject_check" CHECK ("grantor_id" <> "delegate_id"),
  CONSTRAINT "ow_permission_delegations_status_check" CHECK ("status" IN ('pending', 'accepted', 'declined', 'revoked')),
  CONSTRAINT "ow_permission_delegations_scopes_check" CHECK (jsonb_typeof("scopes") = 'array')
);
CREATE INDEX "ow_permission_delegations_grantor_id_status_idx" ON "ow_permission_delegations"("grantor_id", "status");
CREATE INDEX "ow_permission_delegations_delegate_id_status_idx" ON "ow_permission_delegations"("delegate_id", "status");
CREATE INDEX "ow_permission_delegations_target_type_target_id_idx" ON "ow_permission_delegations"("target_type", "target_id");
CREATE INDEX "ow_permission_delegations_expires_at_idx" ON "ow_permission_delegations"("expires_at");

CREATE TABLE "ow_user_restrictions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" VARCHAR(16) NOT NULL,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
  "reason" VARCHAR(1000),
  "starts_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(6),
  "created_by" INTEGER,
  "revoked_at" TIMESTAMP(6),
  "revoked_by" INTEGER,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ow_user_restrictions_type_check" CHECK ("type" IN ('readonly', 'shadowban')),
  CONSTRAINT "ow_user_restrictions_dates_check" CHECK ("expires_at" IS NULL OR "expires_at" > "starts_at"),
  CONSTRAINT "ow_user_restrictions_categories_check" CHECK (cardinality("categories") > 0)
);
CREATE INDEX "ow_user_restrictions_user_id_type_revoked_at_expires_at_idx" ON "ow_user_restrictions"("user_id", "type", "revoked_at", "expires_at");
CREATE INDEX "ow_user_restrictions_type_starts_at_expires_at_idx" ON "ow_user_restrictions"("type", "starts_at", "expires_at");
CREATE INDEX "ow_user_restrictions_created_by_idx" ON "ow_user_restrictions"("created_by");
CREATE INDEX "ow_user_restrictions_revoked_by_idx" ON "ow_user_restrictions"("revoked_by");
CREATE INDEX "ow_user_restrictions_categories_idx" ON "ow_user_restrictions" USING GIN("categories");

ALTER TABLE "ow_comment_service" ADD COLUMN "account_user_id" INTEGER;
CREATE INDEX "ow_comment_service_account_user_id_idx" ON "ow_comment_service"("account_user_id");
CREATE INDEX "ow_projects_deleted_at_state_time_idx" ON "ow_projects"("deleted_at", "state", "time" DESC);
CREATE INDEX "ow_projects_authorid_deleted_at_idx" ON "ow_projects"("authorid", "deleted_at");
CREATE INDEX "ow_projects_is_shadowbanned_shadowban_expires_at_idx" ON "ow_projects"("is_shadowbanned", "shadowban_expires_at");
CREATE INDEX "ow_posts_author_id_is_deleted_created_at_idx" ON "ow_posts"("author_id", "is_deleted", "created_at" DESC);
CREATE INDEX "ow_posts_is_shadowbanned_shadowban_expires_at_idx" ON "ow_posts"("is_shadowbanned", "shadowban_expires_at");
