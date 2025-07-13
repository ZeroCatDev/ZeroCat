/*
  Warnings:

  - You are about to drop the column `coderun_info` on the `ow_coderun_devices` table. All the data in the column will be lost.
  - You are about to drop the column `docker_info` on the `ow_coderun_devices` table. All the data in the column will be lost.
  - You are about to drop the column `last_config_fetch` on the `ow_coderun_devices` table. All the data in the column will be lost.
  - You are about to drop the column `last_report` on the `ow_coderun_devices` table. All the data in the column will be lost.
  - You are about to drop the column `system_info` on the `ow_coderun_devices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ow_coderun_devices` DROP COLUMN `coderun_info`,
    DROP COLUMN `docker_info`,
    DROP COLUMN `last_config_fetch`,
    DROP COLUMN `last_report`,
    DROP COLUMN `system_info`;
