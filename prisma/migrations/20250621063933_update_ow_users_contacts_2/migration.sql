-- DropIndex
DROP INDEX `unique_primary_contact` ON `ow_users_contacts`;

-- AlterTable
ALTER TABLE `ow_users_contacts` ADD COLUMN `metadata` JSON NULL;

-- CreateIndex
CREATE INDEX `idx_user_contacts` ON `ow_users_contacts`(`user_id`);

-- CreateIndex
CREATE INDEX `idx_user_contact_type` ON `ow_users_contacts`(`user_id`, `contact_type`);
