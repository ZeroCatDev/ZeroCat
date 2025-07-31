/*
  Warnings:

  - You are about to drop the column `teacherid` on the `ow_projects` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `idx_project_teacher` ON `ow_projects`;

-- AlterTable
ALTER TABLE `ow_projects` DROP COLUMN `teacherid`;
