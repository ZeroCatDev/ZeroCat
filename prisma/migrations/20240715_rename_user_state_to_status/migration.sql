-- Rename the 'state' field to 'status' in the ow_users table
ALTER TABLE `ow_users` CHANGE COLUMN `state` `status` INT NOT NULL DEFAULT 0;

-- Add comment explaining status values
COMMENT ON COLUMN `ow_users`.`status` IS 'User account status: 0 = pending, 1 = active, 2 = suspended, 3 = banned';