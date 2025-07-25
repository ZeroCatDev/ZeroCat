/*
  Warnings:

  - The primary key for the `ow_projects_commits` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `ow_projects_commits` DROP PRIMARY KEY,
    ADD COLUMN `depth` INTEGER NULL,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE INDEX `idx_parent_commit` ON `ow_projects_commits`(`parent_commit_id`);
