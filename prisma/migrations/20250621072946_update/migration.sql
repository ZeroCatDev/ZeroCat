-- AlterTable
ALTER TABLE `ow_users` ADD COLUMN `bio` LONGTEXT NULL,
    ADD COLUMN `custom_status` JSON NULL,
    ADD COLUMN `featured_projects` INTEGER NULL,
    ADD COLUMN `location` VARCHAR(100) NULL,
    ADD COLUMN `region` VARCHAR(100) NULL;
