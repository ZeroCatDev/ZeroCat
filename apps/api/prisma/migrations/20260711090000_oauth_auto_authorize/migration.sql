-- AlterTable
ALTER TABLE "oauth_applications" ADD COLUMN IF NOT EXISTS "auto_authorize" BOOLEAN NOT NULL DEFAULT false;
