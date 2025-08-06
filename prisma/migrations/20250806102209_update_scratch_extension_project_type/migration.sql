-- Update project type to 'scratch-extension' for all projects that have scratch extensions
UPDATE `ow_projects` 
SET `type` = 'scratch-extension' 
WHERE `id` IN (
  SELECT DISTINCT `projectid` 
  FROM `ow_scratch_extensions`
);