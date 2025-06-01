-- DropIndex
DROP INDEX `idx_projects_comments` ON `ow_comment`;

-- DropIndex
DROP INDEX `idx_projects_state` ON `ow_projects`;

-- DropIndex
DROP INDEX `idx_projects_commits_project_date` ON `ow_projects_commits`;

-- DropIndex
DROP INDEX `idx_projects_stars_project` ON `ow_projects_stars`;
