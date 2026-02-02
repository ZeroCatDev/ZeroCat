/*
  Warnings:

  - The primary key for the `ow_comment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_comment` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `ow_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `target_id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `ow_notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_notifications` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `ow_projects` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_projects` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `view_count` on the `ow_projects` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `project_id` on the `ow_projects_assets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_projects_branch` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `ow_projects_history` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_projects_history` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `authorid` on the `ow_projects_history` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_projects_history` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_projects_list_items` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_projects_stars` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_projects_tags` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `projectid` on the `ow_scratch_extensions` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "ow_comment" DROP CONSTRAINT "idx_19105_PRIMARY",
ALTER COLUMN "id" SET DATA TYPE INTEGER,
ADD CONSTRAINT "idx_19105_PRIMARY" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ow_events" DROP CONSTRAINT "idx_19126_PRIMARY",
ALTER COLUMN "id" SET DATA TYPE INTEGER,
ALTER COLUMN "target_id" SET DATA TYPE INTEGER,
ADD CONSTRAINT "idx_19126_PRIMARY" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ow_notifications" DROP CONSTRAINT "idx_19135_PRIMARY",
ALTER COLUMN "id" SET DATA TYPE INTEGER,
ADD CONSTRAINT "idx_19135_PRIMARY" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ow_projects" DROP CONSTRAINT "idx_19170_PRIMARY",
ALTER COLUMN "id" SET DATA TYPE INTEGER,
ALTER COLUMN "view_count" SET DATA TYPE INTEGER,
ADD CONSTRAINT "idx_19170_PRIMARY" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ow_projects_assets" ALTER COLUMN "project_id" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_projects_branch" ALTER COLUMN "projectid" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_projects_history" DROP CONSTRAINT "idx_19211_PRIMARY",
ALTER COLUMN "id" SET DATA TYPE INTEGER,
ALTER COLUMN "authorid" SET DATA TYPE INTEGER,
ALTER COLUMN "projectid" SET DATA TYPE INTEGER,
ADD CONSTRAINT "idx_19211_PRIMARY" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ow_projects_list_items" ALTER COLUMN "projectid" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_projects_stars" ALTER COLUMN "projectid" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_projects_tags" ALTER COLUMN "projectid" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ow_scratch_extensions" ALTER COLUMN "projectid" SET DATA TYPE INTEGER;
