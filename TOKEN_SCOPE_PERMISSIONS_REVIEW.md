# Token Scope 权限类型评审稿

本文档列出当前 Token/OAuth scope 设计，供评审是否拆分过细、哪些权限需要合并或改名。

## 当前角色策略

权限系统已改为 RBAC 策略引擎：scope 字符串继续作为“权限名称”兼容现有 API/OAuth，但账号本身的权限上限来自数据库角色。

角色权限清单单独记录在 `apps/api/src/services/auth/rolePermissions.js`。系统角色同步时会按该文件逐条写入 `ow_role_permissions`，不会为角色写入 `*`、`admin:*` 或其他通配权限。

默认本地用户不是获得一个“大用户角色”，而是批量获得多个功能角色。管理员只是在这些默认功能角色之外，额外获得 `admin` 管理页角色。

| 角色 | 权限范围 | 默认授予 |
| --- | --- | --- |
| `user` | `user:read/update/delete` | 是 |
| `project` | 作品读取、创建、编辑、互动、删除、管理 | 是 |
| `asset` | 素材读取、上传、删除 | 是 |
| `post` | 帖子读取、发布、同步、互动、删除 | 是 |
| `comment` | 评论读取、发表、修改、删除、空间管理 | 是 |
| `notification` | 通知读取、状态更新 | 是 |
| `list` | 作品列表读取、创建、修改、删除 | 是 |
| `follow` | 关注关系读取和互动 | 是 |
| `blog` | 博客草稿/文章读取、创建、修改、删除 | 是 |
| `cachekv` | 键值存储读取、写入、删除 | 是 |
| `oauth_app` | OAuth 应用读取、管理 | 是 |
| `token` | 个人令牌读取、管理 | 是 |
| `git_sync` | Git 同步读取、管理 | 是 |
| `analytics` | 分析数据读取 | 是 |
| `event` | 事件读取、写入 | 是 |
| `extension` | 扩展读取、管理 | 是 |
| `admin` | `admin:manage` 管理页权限 | 仅管理员 |

数据库表：

| 表 | 用途 |
| --- | --- |
| `ow_roles` | 定义角色，如 `user`、`admin` |
| `ow_role_permissions` | 定义角色拥有的 permission/scope，支持 `allow`/`deny` 和未来条件字段 |
| `ow_user_roles` | 记录用户被授予的角色、授予人、原因和过期时间 |

运行时判断顺序：

1. 当前 token/OAuth scope 必须覆盖接口要求，避免子 token 超过调用 token。
2. 当前用户的 DB 角色策略必须覆盖接口要求，避免 token 超过账号本身权限。
3. 实例级资源必须通过归属/公开边界检查，例如 `project:1134:update` 只能修改自己的项目。

注册、OAuth 首次创建/绑定本地账户、管理后台创建用户时会批量授予所有默认功能角色；启动同步会为已有 active 本地用户补齐这些角色。配置项 `security.adminusers` 和用户 `type=admin/administrator` 会同步为 `admin` 管理页角色。

## Scope 语法

| 类型 | 格式 | 示例 | 用途 |
| --- | --- | --- | --- |
| 公开接口 | 无 scope | 公开项目详情、公开文章列表 | 不需要登录或令牌权限 |
| 当前用户接口 | `resource:action` | `user:read`, `token:read` | 只操作当前登录用户上下文 |
| 实例级接口 | `resource:id:action` | `project:1134:write` | 操作指定资源实例 |
| 资源通配 | `resource:*` | `project:*` | 指定资源的全部动作 |
| 实例通配 | `resource:id:*` | `project:1134:*` | 指定资源实例的全部动作 |
| 全局通配 | `*` | `*` | 全部非管理员权限 |

匹配规则：

| 已授予 scope | 可通过的要求 | 说明 |
| --- | --- | --- |
| `project:write` | `project:1134:update`, `project:1134:delete`, `project:1134:interact` | 类型级权限覆盖该资源下的实例级要求 |
| `project:1134:write` | `project:1134:update` | 同实例内动作覆盖 |
| `project:1134:write` | 不通过 `project:5678:update` | 实例 ID 必须一致 |
| `project:manage` | `project:1134:*` 的所有非 admin 动作 | `manage` 覆盖资源内所有动作 |
| `*` | 所有非 `admin` 资源 | 管理员权限必须显式授予 |
| `admin:manage` | 管理员接口 | 仅管理员账号可授予 |

资源边界规则：

- 令牌不能超过当前调用令牌本身的权限。
- 实例级 scope 还必须落在当前用户可访问的资源边界内。
- 写入类操作只能管理自己的资源，除非对应资源显式定义为互动类。
- 公开读取接口不要求 scope；需要登录但只访问当前用户自己的数据时使用类型级 scope。

## 动作类型

| 动作 | 含义 | 覆盖关系 | 建议风险 |
| --- | --- | --- | --- |
| `read` | 读取私有或登录态数据 | 仅读取 | 低 |
| `create` | 创建新资源 | 仅创建 | 中 |
| `update` | 修改已有资源 | 仅修改 | 中 |
| `delete` | 删除已有资源 | 仅删除 | 高 |
| `interact` | 点赞、收藏、关注、转发等互动 | 仅互动 | 中 |
| `manage` | 管理高风险设置 | 覆盖 `read/create/update/delete/interact/write` | 高 |
| `write` | 兼容旧令牌的写入动作 | 覆盖 `read/create/update/delete/interact/write` | 中到高 |

评审点：如果觉得权限太散，可以考虑只保留 `read / write / manage`，把 `create/update/delete/interact` 作为后端内部动作，不暴露给用户选择。

## 资源类型与边界

| 资源 | 当前边界 | 实例示例 | 备注 |
| --- | --- | --- | --- |
| `user` | 只能访问自己的用户 ID | `user:12:update` | 管理员另走 `admin` |
| `project` | 公开可读；写入/删除/管理只允许作者 | `project:1134:write` | 项目文件、分支、云变量、可见性 |
| `blog` | 仅 article 类型项目；公开可读；写入只允许作者 | `blog:1134:update` | 本质上是文章项目 |
| `post` | 公开可读；互动可作用于目标帖；写入/删除只允许作者 | `post:42:interact` | 发布新帖用类型级 `post:create` |
| `comment` | 空间 owner 可管理；评论作者/空间 owner 可改删；公开活跃空间可读 | `comment:space_cuid:manage` | 支持空间 CUID 或评论 ID |
| `notification` | 只能访问当前用户自己的通知 | `notification:99:update` | 批量已读可逐条校验 |
| `asset` | 未封禁素材可读；写入/删除只允许上传者 | `asset:123:read` | 也支持 md5 |
| `list` | 公开可读；写入/删除只允许列表作者 | `list:8:update` | 项目列表 |
| `follow` | 当前用户对目标用户的关系 | `follow:12:interact` | 目标 ID 是用户 ID |
| `event` | 公开事件可读；私有事件只允许 actor | `event:77:read` | 创建一般为当前用户上下文 |
| `analytics` | 当前用户上下文 | `analytics:read` | 可考虑并入对应资源的 read |
| `cachekv` | 当前用户上下文 | `cachekv:update` | key 不作为 scope ID |
| `oauth_app` | owner 可读/管理；公开应用可读 | `oauth_app:client_id:manage` | 支持应用 ID 或 client_id |
| `token` | 只能访问当前用户自己的 token | `token:5:manage` | 创建/吊销仍要求 Sudo |
| `git_sync` | 当前用户上下文 | `git_sync:manage` | 与项目实例权限组合使用 |
| `extension` | 公开/审核通过可读；管理只允许项目作者 | `extension:3:manage` | 创建时同时要求项目可写 |
| `admin` | 仅管理员账号 | `admin:manage` | `*` 不覆盖 admin |

## 当前暴露 Scope 目录

### 账户

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `*` | 完全访问 | 账户全部非管理员权限 | 高 |
| `user:read` | 查看账户资料 | 读取用户名、显示名、头像、已验证邮箱等 | 低 |
| `user:update` | 修改账户资料 | 修改资料、用户名、密码；敏感操作仍需 Sudo | 中 |
| `user:delete` | 删除账户 | 删除或停用账户；仍需 Sudo | 高 |
| `notification:read` | 查看通知 | 读取私有通知和未读数量 | 低 |
| `notification:update` | 更新通知状态 | 标记已读、批量已读或更新通知状态 | 低 |
| `cachekv:read` | 查看键值存储 | 读取私有键值存储 | 低 |
| `cachekv:update` | 写入键值存储 | 新增或修改键值存储 | 中 |
| `cachekv:delete` | 删除键值存储 | 删除键值存储条目 | 高 |

### 项目与创作

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `project:read` | 查看私有项目 | 读取有权访问的私有项目和项目分析 | 低 |
| `project:create` | 创建项目 | 创建项目、Fork 项目或创建分支 | 中 |
| `project:update` | 修改项目 | 保存文件、提交代码、修改标题/描述/标签 | 中 |
| `project:interact` | 项目互动 | 收藏、取消收藏或记录项目互动 | 中 |
| `project:delete` | 删除项目 | 删除拥有的项目；可能要求 Sudo | 高 |
| `project:manage` | 管理项目设置 | 修改可见性等高风险设置 | 高 |
| `list:read` | 查看项目列表 | 读取私有项目列表 | 低 |
| `list:create` | 创建项目列表 | 创建新的项目列表 | 中 |
| `list:update` | 修改项目列表 | 修改列表信息或列表项 | 中 |
| `list:delete` | 删除项目列表 | 删除项目列表 | 高 |

### 素材

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `asset:read` | 查看私有素材 | 读取上传素材列表 | 低 |
| `asset:create` | 上传素材 | 上传图片、文件或推文媒体 | 中 |
| `asset:delete` | 删除素材 | 删除或下架上传素材 | 高 |

### 社交

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `post:read` | 查看私有社交内容 | 读取登录后可见的推文、收藏、提及等 | 低 |
| `post:create` | 发布推文 | 发布推文、回复、引用或上传图片 | 中 |
| `post:update` | 同步推文 | 重新同步、推送联邦状态或更新元数据 | 中 |
| `post:interact` | 推文互动 | 点赞、收藏、转发、取消转发等 | 中 |
| `post:delete` | 删除推文 | 删除自己发布的推文 | 高 |
| `comment:read` | 查看评论 | 读取相关评论数据 | 低 |
| `comment:create` | 发表评论 | 发表或回复评论 | 中 |
| `comment:update` | 修改评论 | 修改自己发布的评论 | 中 |
| `comment:delete` | 删除评论 | 删除自己发布的评论 | 高 |
| `comment:manage` | 管理评论空间 | 管理空间、配置、用户、审核队列和导入 | 高 |
| `follow:read` | 查看关注关系 | 读取关注、粉丝、屏蔽和备注关系 | 低 |
| `follow:interact` | 关注互动 | 关注、取关、屏蔽或调整关系 | 中 |

### 内容

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `blog:read` | 查看博客草稿 | 读取私有博客草稿 | 低 |
| `blog:create` | 创建博客文章 | 创建博客草稿或文章 | 中 |
| `blog:update` | 修改博客文章 | 修改草稿、正文、封面和标签 | 中 |
| `blog:delete` | 删除博客文章 | 删除博客草稿或文章 | 高 |

### 开发者

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `oauth_app:read` | 查看 OAuth 应用 | 读取自己创建的 OAuth 应用 | 低 |
| `oauth_app:manage` | 管理 OAuth 应用 | 创建、修改或删除 OAuth 应用；仍需 Sudo | 高 |
| `token:read` | 查看令牌 | 读取个人 API 令牌列表和使用记录 | 低 |
| `token:manage` | 管理令牌 | 创建和吊销个人 API 令牌；仍需 Sudo | 高 |
| `git_sync:read` | 查看 Git 同步 | 读取 GitHub 安装、仓库列表和同步状态 | 中 |
| `git_sync:manage` | 管理 Git 同步 | 绑定/解绑 GitHub、创建仓库、配置和触发同步 | 高 |
| `analytics:read` | 查看分析数据 | 读取相关统计分析 | 中 |
| `event:read` | 查看事件记录 | 读取相关事件记录 | 中 |
| `event:create` | 写入事件记录 | 创建账户行为事件 | 中 |
| `extension:read` | 查看扩展 | 读取扩展相关信息 | 低 |
| `extension:manage` | 管理扩展 | 创建、审核或管理扩展 | 高 |

### 管理

| Scope | 名称 | 说明 | 风险 |
| --- | --- | --- | --- |
| `admin:manage` | 管理员操作 | 执行管理后台操作，仅管理员可用 | 高 |

## 当前预设

| 预设 | 包含 scope | 风险 |
| --- | --- | --- |
| 识别身份 | `user:read` | 低 |
| 查看创作数据 | `user:read`, `project:read`, `asset:read`, `notification:read` | 低 |
| 项目编辑工具 | `user:read`, `project:read`, `project:create`, `project:update`, `asset:read`, `asset:create` | 中 |
| 社交发布工具 | `user:read`, `post:create`, `post:interact`, `notification:read` | 中 |
| 开发者控制台 | `user:read`, `oauth_app:manage`, `token:read`, `token:manage` | 高 |

## 待审阅合并点

1. 是否把 `create/update/delete/interact` 合并成 `write`，只保留 `read/write/manage` 给用户选择。
2. 是否取消单独的 `analytics:read`，改为由 `project:read`、`post:read` 等资源读取权限覆盖。
3. `blog` 是否继续作为独立资源，还是视为 `project` 的 article 子类型。
4. `git_sync` 是否保留独立权限，还是只由 `project:update/manage` 控制。
5. `notification:update` 是否风险过低，批量已读、推送订阅和发送通知是否需要拆开。
6. `comment:manage` 是否过宽，是否需要拆成 `comment:moderate` 与 `comment:settings`。
7. `token:manage` 是否允许被个人 API 令牌持有，还是仅允许网页登录会话执行。
