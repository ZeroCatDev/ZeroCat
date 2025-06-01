
-- CreateView
CREATE OR REPLACE VIEW `ow_projects_search` AS
SELECT
    p.*,
    (
        SELECT pf.source
        FROM ow_projects_file pf
        INNER JOIN ow_projects_commits pc ON pc.commit_file = pf.sha256
        WHERE pc.project_id = p.id
        ORDER BY pc.commit_date DESC
        LIMIT 1
    ) as latest_source,
    (
        SELECT GROUP_CONCAT(pt.name SEPARATOR ', ')
        FROM ow_projects_tags pt
        WHERE pt.projectid = p.id
        GROUP BY pt.projectid
    ) as tag_list,
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
FROM ow_projects p;