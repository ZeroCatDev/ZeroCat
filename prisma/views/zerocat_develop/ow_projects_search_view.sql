SELECT
  `p`.`id` AS `id`,
  `p`.`name` AS `name`,
  `p`.`title` AS `title`,
  `p`.`description` AS `description`,
  `p`.`authorid` AS `authorid`,
  `p`.`state` AS `state`,
  `p`.`type` AS `type`,
  `p`.`license` AS `license`,
  `p`.`star_count` AS `star_count`,
  `p`.`time` AS `time`,
  coalesce(
    (
      SELECT
        GROUP_CONCAT(`pt`.`name` SEPARATOR ', ')
      FROM
        `zerocat_develop`.`ow_projects_tags` `pt`
      WHERE
        (`pt`.`projectid` = `p`.`id`)
      GROUP BY
        `pt`.`projectid`
    ),
    ''
  ) AS `tags`,
  `u`.`display_name` AS `author_display_name`,
  `u`.`username` AS `author_username`,
  `u`.`motto` AS `author_motto`,
  `u`.`images` AS `author_images`,
  `u`.`type` AS `author_type`,
  coalesce(
    (
      SELECT
        `pf`.`source`
      FROM
        (
          `zerocat_develop`.`ow_projects_file` `pf`
          LEFT JOIN `zerocat_develop`.`ow_projects_commits` `pc` ON((`pc`.`commit_file` = `pf`.`sha256`))
        )
      WHERE
        (
          (`pc`.`project_id` = `p`.`id`)
          AND (`p`.`state` = 'public')
        )
      ORDER BY
        `pc`.`commit_date` DESC
      LIMIT
        1
    ), NULL
  ) AS `latest_source`,
  coalesce(
    (
      SELECT
        count(0)
      FROM
        `zerocat_develop`.`ow_comment` `c`
      WHERE
        (
          (`c`.`page_type` = 'project')
          AND (`c`.`page_id` = `p`.`id`)
        )
    ),
    0
  ) AS `comment_count`,
  coalesce(
    (
      SELECT
        `c`.`text`
      FROM
        `zerocat_develop`.`ow_comment` `c`
      WHERE
        (
          (`c`.`page_type` = 'project')
          AND (`c`.`page_id` = `p`.`id`)
        )
      ORDER BY
        `c`.`insertedAt` DESC
      LIMIT
        1
    ), NULL
  ) AS `latest_comment`,
  coalesce(
    (
      SELECT
        GROUP_CONCAT(
          `c`.`text`
          ORDER BY
            `c`.`insertedAt` DESC SEPARATOR ','
        )
      FROM
        `zerocat_develop`.`ow_comment` `c`
      WHERE
        (
          (`c`.`page_type` = 'project')
          AND (`c`.`page_id` = `p`.`id`)
        )
      LIMIT
        10
    ), NULL
  ) AS `recent_comments`,
  coalesce(
    (
      SELECT
        json_arrayagg(
          json_object(
            'id',
            `pc`.`id`,
            'message',
            `pc`.`commit_message`,
            'description',
            `pc`.`commit_description`,
            'date',
            `pc`.`commit_date`
          )
        )
      FROM
        `zerocat_develop`.`ow_projects_commits` `pc`
      WHERE
        (`pc`.`project_id` = `p`.`id`)
      LIMIT
        5
    ), json_array()
  ) AS `recent_commits`,
  coalesce(
    (
      SELECT
        json_arrayagg(
          json_object(
            'id',
            `pb`.`id`,
            'name',
            `pb`.`name`,
            'description',
            `pb`.`description`
          )
        )
      FROM
        `zerocat_develop`.`ow_projects_branch` `pb`
      WHERE
        (`pb`.`projectid` = `p`.`id`)
    ),
    json_array()
  ) AS `branches`
FROM
  (
    `zerocat_develop`.`ow_projects` `p`
    LEFT JOIN `zerocat_develop`.`ow_users` `u` ON((`p`.`authorid` = `u`.`id`))
  )
WHERE
  (`p`.`state` = 'public')