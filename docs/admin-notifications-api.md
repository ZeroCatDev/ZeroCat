注：涉及登录的接口可能在启用2FA时返回need_2fa状态，随后需调用`/account/2fa/login/totp`或passkey登录完成流程。
参考一下文档和已有管理员页面，创建新的与代码集成的通知管理员页面
发送通知`POST /admin/notifications/send`
| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `recipient` | string | ✓ | - | 接收者用户名或ID |
| `title` | string | ✓ | - | 通知标题 |
| `content` | string | ✓ | - | 通知内容 |
| `link` | string | ✗ | - | 可点击的链接 |
| `high_priority` | boolean | ✗ | false | 是否为高优先级通知 |
| `notification_type` | string | ✗ | 'system_announcement' | 通知类型 |
| `metadata` | object | ✗ | {} | 附加元数据 |

```json
{
  "success": true,
  "message": "通知发送成功",
  "result": {
    "notification_id": 12345,
    "recipient_id": 789,
    "sent_at": "2024-01-01T12:00:00Z"
  }
}
```


## 2. 群发通知

### `POST /admin/notifications/broadcast`

向多个用户群发通知。

#### 请求参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `recipients` | array | ✓ | - | 接收者用户名或ID数组 |
| `title` | string | ✓ | - | 通知标题 |
| `content` | string | ✓ | - | 通知内容 |
| `link` | string | ✗ | - | 可点击的链接 |
| `high_priority` | boolean | ✗ | false | 是否为高优先级通知 |
| `notification_type` | string | ✗ | 'system_announcement' | 通知类型 |
| `metadata` | object | ✗ | {} | 附加元数据 |


#### 响应示例

```json
{
  "success": true,
  "message": "群发通知完成: 成功 3/3",
  "result": {
    "total": 3,
    "successful": [
      {"user_id": 1, "notification_id": 101},
      {"user_id": 2, "notification_id": 102},
      {"user_id": 3, "notification_id": 103}
    ],
    "failed": []
  }
}
```

---

## 3. 获取通知列表

### `GET /admin/notifications/list`

获取所有通知的管理视图，支持过滤和分页。

#### 查询参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `limit` | integer | ✗ | 20 | 每页数量 |
| `offset` | integer | ✗ | 0 | 偏移量 |
| `user_id` | string | ✗ | - | 按用户ID过滤 |
| `notification_type` | string | ✗ | - | 按通知类型过滤 |
| `unread_only` | boolean | ✗ | false | 只显示未读通知 |
| `date_from` | string | ✗ | - | 开始日期 (ISO格式) |
| `date_to` | string | ✗ | - | 结束日期 (ISO格式) |


#### 响应示例

```json
{
  "success": true,
  "notifications": [
    {
      "id": 12345,
      "title": "系统维护通知",
      "content": "系统将于今晚进行维护",
      "user_id": 789,
      "username": "user123",
      "notification_type": "system_announcement",
      "read": false,
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 156,
  "has_more": true
}
```

---

## 4. 获取统计信息

### `GET /admin/notifications/stats`

获取通知系统的统计信息。

#### 响应示例

```json
{
  "success": true,
  "stats": {
    "total_notifications": 1234,
    "unread_notifications": 56,
    "notifications_today": 23,
    "notifications_this_week": 145,
    "top_notification_types": [
      {"type": "system_announcement", "count": 456},
      {"type": "user_interaction", "count": 321},
      {"type": "feature_announcement", "count": 234}
    ],
    "active_users_with_notifications": 89
  }
}
```

---

## 5. 搜索用户

### `GET /admin/notifications/users/search`

搜索用户，用于发送通知时的用户选择。

#### 查询参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | ✓ | - | 搜索查询字符串 (最少2个字符) |
| `limit` | integer | ✗ | 20 | 返回结果数量限制 |

#### 示例请求

```javascript
GET /admin/notifications/users/search?q=john&limit=10
```

#### 响应示例

```json
{
  "success": true,
  "users": [
    {
      "id": 123,
      "username": "john_doe",
      "display_name": "John Doe",
      "avatar": "/avatars/john.jpg",
      "email": "john@example.com",
      "type": "user"
    },
    {
      "id": 456,
      "username": "johnny",
      "display_name": "Johnny Smith",
      "avatar": "/avatars/johnny.jpg",
      "email": "johnny@example.com",
      "type": "user"
    }
  ],
  "total": 2
}
```

---
