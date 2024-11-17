SELECT
  `project`.`id` AS `id`,
  `project`.`type` AS `type`,
  `project`.`licence` AS `licence`,
  `project`.`authorid` AS `authorid`,
  `project`.`state` AS `state`,
  `project`.`view_count` AS `view_count`,
  `project`.`time` AS `time`,
  `project`.`title` AS `title`,
  `project`.`description` AS `description`,
  `project`.`source` AS `source`,
  `project`.`tags` AS `tags`,
  `author`.`id` AS `author_id`,
  `author`.`display_name` AS `author_display_name`,
  `author`.`motto` AS `author_motto`,
  `author`.`images` AS `author_images`
FROM
  (
    `zerocat_develop`.`ow_projects` `project`
    JOIN `zerocat_develop`.`ow_users` `author` ON((`project`.`authorid` = `author`.`id`))
  )
WHERE
  (`project`.`state` = 'public')