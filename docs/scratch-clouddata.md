# Scratch 云变量同步文档

## 概述

本次改造目标：

- 云变量连接遵守 Scratch 云变量协议进行实时同步。
- WebSocket 端支持登录用户与匿名用户（按项目配置放行）。
- 提供项目级配置项控制匿名写入。
- 记录每次云变量变更历史，便于审计和排查。
- 前端云变量工具支持自动连接、自动重试、`ws/wss` 处理、实时显示与编辑。

## 数据库设计

### 1) 项目通用配置表 `project_config`

Prisma 模型：`ow_target_configs`（映射 `@@map("project_config")`）

字段：

- `id`
- `target_type`
- `target_id`
- `key`
- `value`
- `created_at`
- `updated_at`

约束：

- 唯一键：`(target_type, target_id, key)`
- 索引：`(target_type, target_id)`、`(key)`

用于存储项目云变量配置键：

- `scratch.clouddata.anonymouswrite`

### 2) 云变量历史表 `project_clouddata_history`

字段：

- `id`
- `project_id`
- `method`（`set/create/rename/delete`）
- `name`（变量名）
- `value`（变量值，重命名时记录重命名后的值）
- `actor_id`（登录用户 ID；匿名为 `null`）
- `actor_name`（操作人展示名）
- `ip`
- `created_at`

索引：

- `(project_id, created_at desc)`
- `(method)`
- `(actor_id)`

## 项目配置接口（`router_project`）

### 获取配置

- `GET /project/id/:id/cloudconfig`
- 权限：有项目读权限即可
- 返回键：`scratch.clouddata.anonymouswrite`

### 更新配置

- `PUT /project/id/:id/cloudconfig`
- 权限：登录且项目作者
- 入参支持：
  - `anonymouswrite`
  - 或 `scratch.clouddata.anonymouswrite`
- 值支持布尔及常见布尔字符串（`true/false/1/0/yes/no/on/off` 等）

## 云变量接口（`router_scratch`）

### 写入消息（HTTP）

- `POST /scratch/cloud/:projectid/message`
- 权限：`needLogin`
- 支持 `method`：`handshake/set/create/rename/delete`
- 非作者写入策略：
  - 若配置 `scratch.clouddata.anonymouswrite=true`，允许非作者写入
  - 否则仅项目作者可写

### 读取变量

- `GET /scratch/cloud/:projectid/variables`
- 返回当前项目全部云变量快照（`set` 结构数组）

### 读取更新流

- `GET /scratch/cloud/:projectid/updates?since=&limit=`
- 数据来自 `ow_events` 的 `scratch_cloud` 事件

### 读取历史（倒序）

- `GET /scratch/cloud/:projectid/history?since=&limit=`
- 返回顺序：`id` 倒序（最新在前）
- 分页语义：传 `since=<上一页最后一条的 id>`，后端使用 `id < since` 拉更旧数据
- 数据来自 `project_clouddata_history`
- 返回字段：`method/name/value/actor_id/actor_name/ip/created_at`

## WebSocket 端点（`scratchCloudWs`）

端点：

- `/scratch/cloud/ws`

### 认证来源优先级

- `Authorization: Bearer <token>` 或 `Authorization: <token>`
- Query 参数 `token`
- Cookie `token`

### 握手规则

- 有 token：
  - 使用 token 解析出的用户名作为 `user`。
  - 私有项目仅作者可进入房间。
- 无 token：
  - 仅公开项目可尝试匿名接入。
  - 需 `scratch.clouddata.anonymouswrite=true` 才允许匿名进入。
  - 匿名用户名格式：`[匿名]传入名称`

### 消息处理

- `handshake`：返回当前全部变量（多行 `set` JSON 帧）
- `set/create`：校验变量名和值，保存状态，写事件，写历史，广播给同房间其他客户端
- `rename`：重命名后广播新变量值（`set`）
- `delete`：删除后不广播值（仅落库）

### 状态存储

- 优先 Redis 哈希：`scratch:cloud:{projectId}:vars`
- 冷启动/回填使用 `ow_cache_kv` 快照：`scratch:cloud:{projectId}:vars`

## 历史记录规则

每次云变量变更（HTTP 与 WS 路径）都会写入 `project_clouddata_history`：

- `actor_name`：
  - 登录用户：用户名
  - 匿名用户：`[匿名]传入名称`
- `actor_id`：
  - 登录用户：用户 ID
  - 匿名用户：`null`

## 前端云变量工具（`scratchtool.ejs`）

已实现：

- 自动连接 WebSocket
- 连接失败自动重试（指数退避 + 抖动）
- 自动尝试 `ws/wss` 候选地址
- 默认连接地址：`zcconfig.api + /scratch/cloud/ws`
- token 读取顺序：
  - `localstrongs.token` / `localstrongs.getItem("token")`
  - `localStorage.token`
- 无 token 时不拦截，允许尝试匿名握手（最终由后端按配置判定）
- 实时显示当前云变量列表
- 支持手动编辑单个变量并提交

## 迁移说明

本次涉及迁移目录（已应用）：

- `prisma/migrations/20260207085025_cloud_history_schema_refine`
- `prisma/migrations/20260207102300_restore_search_indexes`

## 最小联调清单

1. 作者登录，连接 `/scratch/cloud/ws`，确认 `handshake` 后收到当前变量。
2. 作者修改变量，确认 Scratch 端与云变量工具同步，且 `/history` 有新记录。
3. 关闭 token，设置 `scratch.clouddata.anonymouswrite=true`，匿名连接成功并可写入。
4. 关闭 `scratch.clouddata.anonymouswrite`，匿名连接应被拒绝。
5. 私有项目下，非作者 token 连接应被拒绝。
