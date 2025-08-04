-- AlterTable
ALTER TABLE `ow_notifications` ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `push_channels` JSON NULL,
    ADD COLUMN `push_error` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `push_results` JSON NULL;

-- CreateIndex
CREATE INDEX `idx_notification_hidden` ON `ow_notifications`(`hidden`);
