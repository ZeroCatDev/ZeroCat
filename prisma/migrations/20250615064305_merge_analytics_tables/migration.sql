/*
  Warnings:

  - You are about to drop the column `city` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `device` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `subdivision1` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `subdivision2` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `website_id` on the `AnalyticsDevice` table. All the data in the column will be lost.
  - You are about to drop the column `visitor_id` on the `AnalyticsEvent` table. All the data in the column will be lost.
  - You are about to drop the column `website_id` on the `AnalyticsEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fingerprint]` on the table `AnalyticsDevice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fingerprint` to the `AnalyticsDevice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `device_id` to the `AnalyticsEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `AnalyticsEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `AnalyticsDevice_created_at_idx` ON `AnalyticsDevice`;

-- DropIndex
DROP INDEX `AnalyticsDevice_website_id_idx` ON `AnalyticsDevice`;

-- DropIndex
DROP INDEX `AnalyticsEvent_visitor_id_idx` ON `AnalyticsEvent`;

-- DropIndex
DROP INDEX `AnalyticsEvent_website_id_idx` ON `AnalyticsEvent`;

-- AlterTable
ALTER TABLE `AnalyticsDevice` DROP COLUMN `city`,
    DROP COLUMN `country`,
    DROP COLUMN `created_at`,
    DROP COLUMN `device`,
    DROP COLUMN `ip_address`,
    DROP COLUMN `subdivision1`,
    DROP COLUMN `subdivision2`,
    DROP COLUMN `website_id`,
    ADD COLUMN `browser_version` VARCHAR(191) NULL,
    ADD COLUMN `device_type` VARCHAR(191) NULL,
    ADD COLUMN `device_vendor` VARCHAR(191) NULL,
    ADD COLUMN `fingerprint` VARCHAR(191) NOT NULL,
    ADD COLUMN `first_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `last_seen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `os_version` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AnalyticsEvent` DROP COLUMN `visitor_id`,
    DROP COLUMN `website_id`,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `device_id` INTEGER NOT NULL,
    ADD COLUMN `ip_address` VARCHAR(191) NULL,
    ADD COLUMN `referrer` VARCHAR(191) NULL,
    ADD COLUMN `region` VARCHAR(191) NULL,
    ADD COLUMN `timezone` VARCHAR(191) NULL,
    ADD COLUMN `url` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `AnalyticsDevice_first_seen_idx` ON `AnalyticsDevice`(`first_seen`);

-- CreateIndex
CREATE INDEX `AnalyticsDevice_last_seen_idx` ON `AnalyticsDevice`(`last_seen`);

-- CreateIndex
CREATE UNIQUE INDEX `AnalyticsDevice_fingerprint_key` ON `AnalyticsDevice`(`fingerprint`);

-- CreateIndex
CREATE INDEX `AnalyticsEvent_device_id_idx` ON `AnalyticsEvent`(`device_id`);

-- CreateIndex
CREATE INDEX `AnalyticsEvent_referrer_domain_idx` ON `AnalyticsEvent`(`referrer_domain`);

-- CreateIndex
CREATE INDEX `AnalyticsEvent_ip_address_idx` ON `AnalyticsEvent`(`ip_address`);
