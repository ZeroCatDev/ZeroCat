-- CreateIndex
CREATE INDEX `idx_projects_comments` ON `ow_comment`(`page_type`, `page_id`, `insertedAt`);

-- CreateIndex
CREATE INDEX `idx_projects_state` ON `ow_projects`(`state`);

-- CreateIndex
CREATE INDEX `idx_projects_commits_project_date` ON `ow_projects_commits`(`project_id`, `commit_date`);

-- CreateIndex
CREATE INDEX `idx_projects_stars_project` ON `ow_projects_stars`(`projectid`);
