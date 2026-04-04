# 通知与通知订阅前端 API 文档

更新时间：2026-04-04

本文档面向前端，覆盖本次通知系统改造后需要对接的全部变化，重点是：
- 获取当前对象通知等级
- 修改当前对象通知等级
- 发送通知时显式传入通知要求等级

---

## 1. 基础约定

- 路由前缀
  - 用户通知：`/notifications`
  - 管理员通知：`/admin/notifications`
- 认证
  - 所有设置类与发送类接口都需要登录（管理员接口需要 admin 权限）
- 对象类型（target_type）
  - `USER`
  - `PROJECT`
- 通知订阅等级（level）
  - `NONE`：不接收
  - `BASIC`：基础通知（默认；接收与自己直接相关的通知）
  - `ENHANCED`：增强通知（在 BASIC 基础上，增加新帖子/新项目等动态）
  - `ALL`：全部通知（在 ENHANCED 基础上，增加项目推送等高频通知）
- 通知要求等级（notification_requirement）
  - `BASIC`：一般更新
  - `ENHANCED`：增强动态
  - `ALL`：高频动态

说明：后端现在不再按 notificationType 统一硬编码等级，要求调用方在发通知时传 `notification_requirement`。

---

## 2. 核心接口（对象通知等级）

### 2.1 获取当前对象通知等级（最重要）

- 方法与路径
  - `GET /notifications/settings/:targetType/:targetId`

- 路径参数
  - `targetType`: `USER` 或 `PROJECT`
  - `targetId`: 对象 ID（数字字符串）

- 成功响应

```json
{
  "success": true,
  "setting": {
    "target_id": "123",
    "target_type": "PROJECT",
    "level": "BASIC"
  }
}
```

- 未设置时响应（返回默认基础类型）

```json
{
  "success": true,
  "setting": {
    "target_id": "123",
    "target_type": "PROJECT",
    "level": "BASIC"
  }
}
```

- 前端建议
  - 进入用户页/仓库页时立即调用该接口，初始化通知下拉菜单。

---

### 2.2 修改单个对象通知等级（最重要）

- 方法与路径
  - `PUT /notifications/settings`

- 请求体

```json
{
  "targetId": "123",
  "targetType": "PROJECT",
  "level": "ALL"
}
```

- 成功响应

```json
{
  "success": true,
  "setting": {
    "id": 88,
    "user_id": 1001,
    "target_id": "123",
    "target_type": "PROJECT",
    "level": "ALL",
    "created_at": "2026-04-04T10:00:00.000Z",
    "updated_at": "2026-04-04T10:00:00.000Z"
  }
}
```

- 校验失败示例

```json
{
  "error": "无效的通知级别: XXX"
}
```

---

### 2.3 批量修改对象通知等级

- 方法与路径
  - `PUT /notifications/settings/bulk`

- 请求体

```json
{
  "settings": [
    { "targetId": "123", "targetType": "PROJECT", "level": "ALL" },
    { "targetId": "66", "targetType": "USER", "level": "NONE" }
  ]
}
```

- 成功响应

```json
{
  "success": true,
  "settings": [
    {
      "id": 88,
      "user_id": 1001,
      "target_id": "123",
      "target_type": "PROJECT",
      "level": "ALL"
    },
    {
      "id": 89,
      "user_id": 1001,
      "target_id": "66",
      "target_type": "USER",
      "level": "NONE"
    }
  ]
}
```

---

### 2.4 查询通知设置列表

- 方法与路径
  - `GET /notifications/settings`

- 查询参数
  - `target_type`（可选）：`USER` 或 `PROJECT`
  - `target_ids`（可选）：逗号分隔，如 `1,2,3`
  - `limit`（可选，默认 50）
  - `offset`（可选，默认 0）

- 成功响应

```json
{
  "success": true,
  "settings": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

---

### 2.5 获取设置元数据

- 方法与路径
  - `GET /notifications/settings/metadata`

- 成功响应

```json
{
  "success": true,
  "metadata": {
    "target_types": ["USER", "PROJECT"],
    "levels": ["NONE", "BASIC", "ENHANCED", "ALL"]
  }
}
```

---

## 3. 发送通知接口变更（新增 notification_requirement）

### 3.1 用户通知接口（普通）

- 方法与路径
  - `POST /notifications/send`

- 新增字段
  - `notification_requirement`（可选，默认 `BASIC`）

- 请求体示例

```json
{
  "user_id": 1002,
  "title": "你有一条提醒",
  "content": "内容",
  "channel": "browser",
  "target_type": "PROJECT",
  "target_id": 123,
  "notification_requirement": "BASIC"
}
```

---

### 3.2 用户通知接口（增强）

- 方法与路径
  - `POST /notifications/send-enhanced`

- 新增字段
  - `notification_requirement`（可选，默认 `BASIC`）

- 请求体示例

```json
{
  "user_id": 1002,
  "title": "项目更新",
  "content": "项目有新动态",
  "push_channels": ["browser", "push"],
  "target_type": "PROJECT",
  "target_id": 123,
  "notification_requirement": "BASIC"
}
```

---

### 3.3 管理员发送通知接口

- 方法与路径
  - `POST /admin/notifications/send`

- 新增字段
  - `notification_requirement`（可选，默认 `BASIC`）

- 请求体示例

```json
{
  "recipients": [1002, 1003],
  "recipient_type": "user_id",
  "title": "系统公告",
  "content": "公告内容",
  "push_channels": ["browser"],
  "notification_requirement": "BASIC"
}
```

---

## 4. 前端推荐交互流程

### 4.1 用户页/仓库页通知开关

1. 页面加载时调用：
   - `GET /notifications/settings/:targetType/:targetId`
2. 将返回的 `level` 显示在 UI 上（NONE/BASIC/ENHANCED/ALL）
3. 用户修改后调用：
   - `PUT /notifications/settings`
4. 成功后更新本地 UI 状态

### 4.2 列表页批量设置

1. 勾选多个对象
2. 调用：`PUT /notifications/settings/bulk`
3. 成功后更新列表项状态

---

## 5. 兼容性与注意事项

- 旧值 `DEFAULT` 在迁移后按 `NONE` 处理。
- 更新接口支持 `NONE/BASIC/ENHANCED/ALL`。
- 如果发通知时不传 `notification_requirement`，后端默认按 `BASIC` 处理。
- 对象设置接口里的 `targetType` 建议前端统一使用大写：`USER` / `PROJECT`。
- 通知详情路由已限制为数字 ID，避免与 `/notifications/settings` 冲突。

项目优先级规则：
项目有单独配置时，项目配置优先于用户总配置（包括对项目所有者/行为者的配置）。
项目未配置时，回退到用户总配置；用户总配置未设置时，按默认 `BASIC`。

关注联动规则：
关注某个用户时，系统自动将该用户通知等级设为 `ENHANCED`。
取关时，如果该用户通知等级为 `ENHANCED`，系统会自动删除该配置并回退到默认 `BASIC`。

---

## 6. 当前后端事件重要性策略（供前端理解）

以下是目前后端事件侧传入的要求等级：

- `ALL`：`project_commit`
- `ENHANCED`：`post_create`、`project_create`、`project_update`、`project_fork`、`project_rename`、`project_info_update`、`project_delete`
- `BASIC`：`user_follow`、`comment_create`、`comment_reply`、`comment_like`、`project_star`、`project_like`、`project_collect`、推文互动类通知（mention/reply/retweet/quote/like）与登录/验证码/魔术链接邮件

该策略可以继续由业务代码在“发通知处”调整，无需集中映射表。
