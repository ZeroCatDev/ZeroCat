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
    p.star_count,
    p.time,
    (
        SELECT GROUP_CONCAT(pt.name SEPARATOR ', ')
        FROM ow_projects_tags pt
        WHERE pt.projectid = p.id
        GROUP BY pt.projectid
    ) as tags,
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
    ) as latest_comment,
    (
        SELECT GROUP_CONCAT(c.text ORDER BY c.insertedAt DESC SEPARATOR '|||')
        FROM ow_comment c
        WHERE c.page_type = 'project'
        AND c.page_id = p.id
        LIMIT 10
    ) as recent_comments,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', pc.id,
                'message', pc.commit_message,
                'description', pc.commit_description,
                'date', pc.commit_date
            )
        )
        FROM ow_projects_commits pc
        WHERE pc.project_id = p.id
        ORDER BY pc.commit_date DESC
        LIMIT 5
    ) as recent_commits,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', pb.id,
                'name', pb.name,
                'description', pb.description
            )
        )
        FROM ow_projects_branch pb
        WHERE pb.projectid = p.id
    ) as branches
FROM ow_projects p
LEFT JOIN ow_users u ON p.authorid = u.id
WHERE p.state = 'public';