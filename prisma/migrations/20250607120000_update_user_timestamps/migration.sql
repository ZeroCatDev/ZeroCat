-- Update default values for timestamp columns in ow_users table
ALTER TABLE `ow_users`
    MODIFY COLUMN `birthday` timestamp(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY COLUMN `createdAt` timestamp(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY COLUMN `updatedAt` timestamp(0) NULL DEFAULT CURRENT_TIMESTAMP(0);