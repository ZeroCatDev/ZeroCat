-- CreateView
CREATE OR REPLACE VIEW `ow_projects_search` AS
SELECT
    p.id,
    p.name,
    p.title,
    p.description,
    p.authorid,
    p.state,
    p.type,
    p.license,
    p.view_count,
    p.like_count,
    p.favo_count,
    p.star_count,
    p.time,
    p.tags,
    u.display_name as author_display_name,
    u.username as author_username,
    u.motto as author_motto,
    u.images as author_images,
    u.type as author_type,
    (
        SELECT pf.source
        FROM ow_projects_file pf
        INNER JOIN ow_projects_commits pc ON pc.commit_file = pf.sha256
        WHERE pc.project_id = p.id
        AND p.state = 'public'
        ORDER BY pc.commit_date DESC
        LIMIT 1
    ) as latest_source,
    (
        SELECT COUNT(*)
        FROM ow_comment c
        WHERE c.page_type = 'project'
        AND c.page_id = p.id
    ) as comment_count,
    (
        SELECT c.text
        FROM ow_comment c
        WHERE c.page_type = 'project'
        AND c.page_id = p.id
        ORDER BY c.insertedAt DESC
        LIMIT 1
    ) as latest_comment
FROM ow_projects p
LEFT JOIN ow_users u ON p.authorid = u.id
WHERE p.state = 'public';