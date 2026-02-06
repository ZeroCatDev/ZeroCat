# Search API 文档

## 接口地址

- `GET /searchapi`

## 功能概述

统一搜索接口，支持以下类型：

- 项目（`projects`）
- 用户（`users`）
- 帖子（`posts`）
- 项目文件（`project_files`）
- 列表（`lists`）
- 标签（`tags`，来自 `ow_projects_tags` 关联表）

关键字匹配规则：

- `projects/users/posts` 使用 `pg_trgm` 相似度匹配（容错拼写）
- `lists/tags` 使用子串匹配
- `project_files` 使用全文检索（仅当前用户可搜索）

## Query 参数

- `keyword`: 通用关键字（推荐，兼容 `q`）
- `scope`: 搜索范围（推荐），支持 `projects|users|posts|project_files|lists|tags`（兼容 `search_scope` 和 `list|tag`）
- `userId`: 用户 ID 过滤（推荐，兼容 `search_userid`）
- `tags`: 项目标签过滤（推荐，兼容 `search_tag`）
- `type`: 项目类型过滤（兼容 `search_type`）
- `orderBy`: 项目排序（推荐），支持 `view_up/down`、`time_up/down`、`id_up/down`、`star_up/down`（兼容 `search_orderby`）
- `state`: 项目/列表状态过滤（兼容 `search_state`）
- `postType`: 帖子类型过滤（兼容 `search_post_type`）
- `userStatus`: 用户状态过滤（兼容 `search_user_status`）
- `page`: 页码，默认 `1`（兼容 `curr`）
- `perPage`: 每页数量，默认 `10`，最大 `50`（兼容 `limit`）

`userId` 和 `tags` 传值方式：

- 逗号分隔：`userId=1,2,3&tags=scratch,game`
- 重复参数：`userId=1&userId=2&tags=scratch&tags=game`

## 返回结构

```json
{
  "scope": "projects",
  "query": "scratch",
  "page": 1,
  "limit": 10,
  "projects": [],
  "users": [],
  "posts": [],
  "projectFiles": [],
  "lists": [],
  "tags": [
    { "name": "scratch", "count": 12 }
  ],
  "totals": {
    "projects": 0,
    "users": 0,
    "posts": 0,
    "projectFiles": 0,
    "lists": 0,
    "tags": 1
  },
  "totalCount": 0,
  "fileSearchStrategy": "fulltext"
}
```

字段说明：

- `scope`: 实际生效的范围
- `query`: 实际关键字（优先 `q`）
- `tags`: 标签聚合结果，`count` 表示匹配到该标签的记录数
- `totals`: 各类型总数
- `totalCount`: 当前 `scope` 总数
- `fileSearchStrategy`: 文件搜索策略（`disabled|owner_filtered|fulltext`）

## 兼容行为

当 `search_scope=projects` 且没有 `q` 时，保持旧结构：

```json
{
  "projects": [],
  "totalCount": 0
}
```

## 示例

1. 仅标签模糊搜索

`GET /searchapi?keyword=scr&scope=tags&page=1&perPage=20`

2. 搜索公开列表

`GET /searchapi?keyword=教程&scope=lists&state=public`
