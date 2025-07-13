/*
  Warnings:

  - You are about to drop the column `auth_token` on the `ow_coderun_devices` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `ow_coderun_devices_auth_token_idx` ON `ow_coderun_devices`;

-- DropIndex
DROP INDEX `ow_coderun_devices_auth_token_key` ON `ow_coderun_devices`;

-- AlterTable
ALTER TABLE `ow_coderun_devices` DROP COLUMN `auth_token`;
