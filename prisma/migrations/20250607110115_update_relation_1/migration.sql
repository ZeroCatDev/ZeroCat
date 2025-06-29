-- DropForeignKey
ALTER TABLE `ow_auth_tokens` DROP FOREIGN KEY `fk_tokens_users`;

-- CreateIndex
CREATE INDEX `idx_project_author` ON `ow_projects`(`authorid`);

-- CreateIndex
CREATE INDEX `idx_project_teacher` ON `ow_projects`(`teacherid`);

-- CreateIndex
CREATE INDEX `idx_branch_creator` ON `ow_projects_branch`(`creator`);

-- CreateIndex
CREATE INDEX `idx_projects_stars_user` ON `ow_projects_stars`(`userid`);
