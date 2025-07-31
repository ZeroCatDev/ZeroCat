-- AlterTable
ALTER TABLE `ow_projects` ADD COLUMN `thumbnail` VARCHAR(32) NULL DEFAULT '',
    MODIFY `title` VARCHAR(1000) NULL DEFAULT 'ZeroCat新项目',
    MODIFY `description` VARCHAR(1000) NULL DEFAULT 'ZeroCat上的项目';

-- AlterTable
ALTER TABLE `ow_users` MODIFY `display_name` CHAR(20) NOT NULL DEFAULT 'ZeroCat创作者';
