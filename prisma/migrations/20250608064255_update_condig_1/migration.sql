/*
  Warnings:

  - You are about to drop the column `is_public` on the `ow_config` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `ow_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ow_config` DROP COLUMN `is_public`,
    DROP COLUMN `user_id`,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'ARRAY', 'ENUM') NOT NULL DEFAULT 'STRING';

-- AlterTable
ALTER TABLE `ow_users` ALTER COLUMN `regTime` DROP DEFAULT,
    MODIFY `birthday` TIMESTAMP(0) NULL DEFAULT '2000-03-31 08:00:00',
    ALTER COLUMN `createdAt` DROP DEFAULT,
    ALTER COLUMN `updatedAt` DROP DEFAULT;
