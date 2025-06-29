/*
  Warnings:

  - You are about to drop the column `2fa` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `facebook` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `github` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `google` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `qq` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `twitter` on the `ow_users` table. All the data in the column will be lost.
  - You are about to drop the column `weibo` on the `ow_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ow_users` DROP COLUMN `2fa`,
    DROP COLUMN `facebook`,
    DROP COLUMN `github`,
    DROP COLUMN `google`,
    DROP COLUMN `qq`,
    DROP COLUMN `twitter`,
    DROP COLUMN `weibo`,
    MODIFY `avatar` VARCHAR(255) NULL DEFAULT 'fcd939e653195bb6d057e8c2519f5cc7';
