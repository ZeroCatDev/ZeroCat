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
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', c.id,
                'text', c.text,
                'insertedAt', c.insertedAt,
                'user', (
                    SELECT JSON_OBJECT(
                        'id', u.id,
                        'username', u.username,
                        'display_name', u.display_name,
                        'avatar', u.avatar,
                        'type', u.type
                    )
                    FROM ow_users u
                    WHERE u.id = c.user_id
                )
            )
        )
        FROM (
            SELECT * FROM ow_comment c
            WHERE c.page_type = 'project'
            AND c.page_id = p.id
            ORDER BY c.insertedAt DESC
            LIMIT 10
        ) c
    ) as recent_comments_full,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', ps.id,
                'createTime', ps.createTime,
                'user', (
                    SELECT JSON_OBJECT(
                        'id', u.id,
                        'username', u.username,
                        'display_name', u.display_name,
                        'avatar', u.avatar,
                        'type', u.type,
                        'motto', u.motto
                    )
                    FROM ow_users u
                    WHERE u.id = ps.userid
                )
            )
        )
        FROM ow_projects_stars ps
        WHERE ps.projectid = p.id
    ) as star_users_full,
    (
        SELECT GROUP_CONCAT(DISTINCT u.display_name SEPARATOR ', ')
        FROM ow_projects_stars ps
        INNER JOIN ow_users u ON ps.userid = u.id
        WHERE ps.projectid = p.id
    ) as star_users_names,
    (
        SELECT JSON_OBJECT(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar', u.avatar,
            'type', u.type,
            'motto', u.motto,
            'github', u.github,
            'twitter', u.twitter,
            'url', u.url
        )
        FROM ow_users u
        WHERE u.id = p.authorid
    ) as author_info,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', pc.id,
                'commit_message', pc.commit_message,
                'commit_date', pc.commit_date,
                'commit_description', pc.commit_description,
                'branch', pc.branch,
                'author', (
                    SELECT JSON_OBJECT(
                        'id', u.id,
                        'username', u.username,
                        'display_name', u.display_name,
                        'avatar', u.avatar
                    )
                    FROM ow_users u
                    WHERE u.id = pc.author_id
                )
            )
        )
        FROM (
            SELECT * FROM ow_projects_commits pc
            WHERE pc.project_id = p.id
            ORDER BY pc.commit_date DESC
            LIMIT 5
        ) pc
    ) as recent_commits,
    (
        SELECT COUNT(DISTINCT pc.id)
        FROM ow_projects_commits pc
        WHERE pc.project_id = p.id
    ) as commit_count,
    (
        SELECT JSON_OBJECT(
            'fork_count', (
                SELECT COUNT(*)
                FROM ow_projects
                WHERE fork = p.id
            ),
            'fork_info', CASE
                WHEN p.fork IS NOT NULL THEN (
                    SELECT JSON_OBJECT(
                        'id', op.id,
                        'name', op.name,
                        'author', (
                            SELECT JSON_OBJECT(
                                'id', u.id,
                                'username', u.username,
                                'display_name', u.display_name
                            )
                            FROM ow_users u
                            WHERE u.id = op.authorid
                        )
                    )
                    FROM ow_projects op
                    WHERE op.id = p.fork
                )
                ELSE NULL
            END
        )
    ) as fork_details,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', pl.id,
                'title', pl.title,
                'description', pl.description,
                'author', (
                    SELECT JSON_OBJECT(
                        'id', u.id,
                        'username', u.username,
                        'display_name', u.display_name
                    )
                    FROM ow_users u
                    WHERE u.id = pl.authorid
                )
            )
        )
        FROM ow_projects_list_items pli
        INNER JOIN ow_projects_lists pl ON pli.listid = pl.id
        WHERE pli.projectid = p.id
        AND pl.state = 'public'
    ) as included_in_lists
FROM ow_projects p;