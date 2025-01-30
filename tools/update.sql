ALTER TABLE ow_projects_branch
ADD UNIQUE KEY unique_project_branch (projectid, name);
SELECT * FROM zerocat_develop.ow_projects_branch;