-- Update avatar field with images field value
UPDATE ow_users SET avatar = images WHERE avatar != images;