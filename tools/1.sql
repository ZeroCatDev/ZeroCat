CREATE VIEW
    ow_public_projects AS
SELECT
    project.id,
    project.type,
    project.license,
    project.authorid,
    project.state,
    project.view_count,
    project.time,
    project.title,
    project.description,
    project.source,
    project.tags,
    author.id AS author_id,
    author.display_name AS author_display_name,
    author.motto AS author_motto,
    author.images AS author_images
FROM
    ow_projects project
    JOIN ow_users author ON project.authorid = author.id
WHERE
    project.state = 'public';