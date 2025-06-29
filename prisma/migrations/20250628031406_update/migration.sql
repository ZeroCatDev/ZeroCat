/*
  Warnings:

  - You are about to alter the column `actor_id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `UnsignedBigInt` to `UnsignedInt`.
  - You are about to alter the column `target_id` on the `ow_events` table. The data in that column could be lost. The data in that column will be cast from `UnsignedBigInt` to `UnsignedInt`.
  - The primary key for the `ow_notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ow_notifications` table. The data in that column could be lost. The data in that column will be cast from `UnsignedInt` to `UnsignedBigInt`.

*/
-- AlterTable
ALTER TABLE `ow_events` MODIFY `actor_id` INTEGER UNSIGNED NOT NULL,
    MODIFY `target_id` INTEGER UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `ow_notifications` DROP PRIMARY KEY,
    MODIFY `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE INDEX `idx_notification_actor` ON `ow_notifications`(`actor_id`);
