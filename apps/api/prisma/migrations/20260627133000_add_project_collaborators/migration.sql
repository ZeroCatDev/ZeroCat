-- Add special role assignment markers.
ALTER TABLE "ow_user_roles"
ADD COLUMN IF NOT EXISTS "grant_type" VARCHAR(64) NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "target_type" VARCHAR(64),
ADD COLUMN IF NOT EXISTS "target_id" VARCHAR(64),
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "ow_user_roles_grant_type_idx" ON "ow_user_roles"("grant_type");
CREATE INDEX IF NOT EXISTS "ow_user_roles_target_type_target_id_idx" ON "ow_user_roles"("target_type", "target_id");

-- Project collaboration invitations.
CREATE TABLE IF NOT EXISTS "ow_project_collaboration_invitations" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "inviter_id" INTEGER NOT NULL,
    "invitee_id" INTEGER NOT NULL,
    "role_key" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "message" VARCHAR(500),
    "responded_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ow_project_collaboration_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_project_id_invitee_id_role_key_status_key"
ON "ow_project_collaboration_invitations"("project_id", "invitee_id", "role_key", "status");

CREATE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_project_id_idx" ON "ow_project_collaboration_invitations"("project_id");
CREATE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_inviter_id_idx" ON "ow_project_collaboration_invitations"("inviter_id");
CREATE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_invitee_id_idx" ON "ow_project_collaboration_invitations"("invitee_id");
CREATE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_status_idx" ON "ow_project_collaboration_invitations"("status");
CREATE INDEX IF NOT EXISTS "ow_project_collaboration_invitations_expires_at_idx" ON "ow_project_collaboration_invitations"("expires_at");
