/*
  Warnings:

  - You are about to drop the column `visitor_id` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fingerprint,user_id]` on the table `AnalyticsDevice` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `AnalyticsDevice_fingerprint_key` ON `AnalyticsDevice`;

-- DropIndex
DROP INDEX `AnalyticsDevice_visitor_id_idx` ON `AnalyticsDevice`;

-- AlterTable
ALTER TABLE `AnalyticsDevice` DROP COLUMN `visitor_id`,
    ADD COLUMN `user_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `AnalyticsDevice_user_id_idx` ON `AnalyticsDevice`(`user_id`);

-- CreateIndex
CREATE UNIQUE INDEX `AnalyticsDevice_fingerprint_user_id_key` ON `AnalyticsDevice`(`fingerprint`, `user_id`);
