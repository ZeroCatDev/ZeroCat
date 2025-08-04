# 通知系统使用文档

## 概述

ZeroCat 通知系统已重构，现在支持将通知内容直接存储在数据库中，不再依赖模板动态生成。系统支持多种通知渠道（浏览器、邮件），并提供了完整的 API 接口。

## 数据库结构

### ow_notifications 表字段

- `id`: 通知ID（主键）
- `user_id`: 接收通知的用户ID
- `title`: 通知标题（直接存储）
- `content`: 通知内容（直接存储）
- `link`: 通知链接（可为空）
- `metadata`: 元数据（JSON格式，存储详细信息）
- `notification_type`: 通知类型（仅用于显示图标）
- `actor_id`: 行为者ID（可为空）
- `target_type`: 目标类型（可为空）
- `target_id`: 目标ID（可为空）
- `data`: 兼容性数据字段（JSON格式）
- `read`: 是否已读
- `high_priority`: 是否高优先级
- `created_at`: 创建时间
- `read_at`: 阅读时间

## API 接口

### 1. 发送通知

**接口**: `POST /notifications/send`

**说明**: 发送通知，支持多种渠道

**请求参数**:
```json
{
  "user_id": 123,                    // 必需：接收通知的用户ID
  "title": "通知标题",                // 必需：通知标题
  "content": "通知内容详情",           // 必需：通知内容
  "link": "/projects/456",           // 可选：通知链接，特殊值 "target" 会自动生成链接
  "channel": "browser",              // 可选：通知渠道 (browser, email)，默认 browser
  "actor_id": 789,                   // 可选：行为者ID
  "target_type": "project",          // 可选：目标类型，当 link 为 "target" 时使用
  "target_id": 456,                  // 可选：目标ID，当 link 为 "target" 时使用
  "metadata": {                      // 可选：元数据
    "custom_field": "value"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "result": {
    "browser": {
      "id": 1234,
      "title": "通知标题",
      "content": "通知内容详情",
      // ... 其他通知字段
    },
    "email": null
  }
}
```

### 2. 获取用户通知列表

**接口**: `GET /notifications`

**查询参数**:
- `limit`: 每页数量，默认 20
- `offset`: 偏移量，默认 0
- `unread_only`: 是否只获取未读通知，默认 false

**响应示例**:
```json
{
  "notifications": [
    {
      "id": 1234,
      "title": "通知标题",
      "content": "通知内容",
      "link": "/projects/456",
      "metadata": {...},
      "type": "project_comment",
      "read": false,
      "created_at": "2023-12-01T10:00:00Z",
      "template_info": {
        "title": "项目评论",
        "icon": "comment"
      },
      "actor": {
        "id": 789,
        "username": "user123",
        "display_name": "用户123"
      }
    }
  ],
  "total_rows_notifications": 50,
  "seen_notification_id": 1234,
  "load_more_notifications": "/notifications?limit=20&offset=20"
}
```

### 3. 获取单个通知详情

**接口**: `GET /notifications/:id`

**说明**: 获取指定通知的详细信息，访问时自动标记为已读

**响应示例**:
```json
{
  "id": 1234,
  "title": "通知标题",
  "content": "通知内容详情",
  "link": "/projects/456",
  "metadata": {...},
  "type": "project_comment",
  "read": true,
  "read_at": "2023-12-01T10:05:00Z",
  "created_at": "2023-12-01T10:00:00Z",
  "template_info": {
    "title": "项目评论",
    "icon": "comment"
  }
}
```

### 4. 标记通知为已读

**接口**: `POST /notifications/mark-read`

**请求参数**:
```json
{
  "notification_ids": [1234, 1235, 1236]
}
```

**响应示例**:
```json
{
  "success": true,
  "count": 3
}
```

### 5. 标记所有通知为已读

**接口**: `PUT /notifications/read_all`

**响应示例**:
```json
{
  "success": true,
  "count": 15
}
```

### 6. 删除通知

**接口**: `DELETE /notifications`

**请求参数**:
```json
{
  "notification_ids": [1234, 1235, 1236]
}
```

### 7. 获取未读通知数量

**接口**: `GET /notifications/unread-count`

**响应示例**:
```json
{
  "count": 5
}
```

### 8. 注册浏览器推送通知

**接口**: `POST /notifications/register-browser`

**说明**: 注册或更新浏览器推送通知订阅

**请求参数**:
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "auth": "认证密钥",
      "p256dh": "P256DH公钥"
    }
  },
  "device_info": {
    "browser": "Chrome",
    "os": "Windows",
    "version": "117.0.0.0"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "浏览器推送通知注册成功",
  "subscription_id": 123,
  "is_new": true
}
```

### 9. 取消浏览器推送通知

**接口**: `DELETE /notifications/register-browser`

**请求参数**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### 10. 获取推送订阅列表

**接口**: `GET /notifications/push-subscriptions`

**响应示例**:
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": 123,
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "device_info": {
        "browser": "Chrome",
        "os": "Windows"
      },
      "created_at": "2023-12-01T10:00:00Z",
      "last_used_at": "2023-12-01T15:30:00Z"
    }
  ]
}
```

## 数据库结构

### ow_push_subscriptions 表（新增）

推送通知订阅表，用于存储用户的浏览器推送订阅信息：

- `id`: 订阅ID（主键）
- `user_id`: 用户ID
- `endpoint`: 推送端点URL
- `p256dh_key`: P256DH公钥
- `auth_key`: 认证密钥
- `user_agent`: 用户代理字符串
- `device_info`: 设备信息（JSON格式）
- `is_active`: 是否活跃
- `last_used_at`: 最后使用时间
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 推送通知功能

### 自动推送通知

当创建浏览器通知时，系统会自动尝试发送推送通知给用户的所有活跃设备。推送通知包含：

- 标题和内容
- 图标（基于通知类型）
- 点击链接
- 相关数据（通知ID等）

### 配置要求

推送通知功能需要在系统配置中设置以下参数：

```javascript
// 需要在 zcconfig 中配置
{
  "webpush.vapid_public_key": "BK...",  // VAPID 公钥
  "webpush.vapid_private_key": "私钥",   // VAPID 私钥
  "webpush.vapid_subject": "mailto:admin@zerocat.top"  // VAPID 主题
}
```

### 生成 VAPID 密钥

可以使用 `web-push` 库生成 VAPID 密钥：

```bash
npx web-push generate-vapid-keys
```

### 依赖项

推送通知功能需要安装以下 npm 包：

```bash
npm install web-push
```

在 `package.json` 中添加：

```json
{
  "dependencies": {
    "web-push": "^3.6.6"
  }
}
```

## 编程接口

### 创建通知

```javascript
import { createNotification } from '../controllers/notifications.js';

// 使用模板创建通知
const notification = await createNotification({
  userId: 123,
  notificationType: 'project_comment',
  actorId: 456,
  targetType: 'project',
  targetId: 789,
  data: {
    project_name: '我的项目',
    comment_text: '这是一个评论'
  }
});

// 自定义通知内容
const customNotification = await createNotification({
  userId: 123,
  title: '自定义标题',
  content: '自定义内容',
  link: '/custom-link',
  notificationType: 'custom_notification'
});
```

### 发送通知（多渠道）

```javascript
import { sendNotification } from '../controllers/notifications.js';

// 发送浏览器通知
const result = await sendNotification({
  userId: 123,
  title: '新消息',
  content: '您收到了一条新消息',
  channel: 'browser'
});

// 发送邮件通知
const emailResult = await sendNotification({
  userId: 123,
  title: '重要通知',
  content: '这是一个重要通知',
  link: 'target',  // 特殊值，会自动生成链接
  targetType: 'project',
  targetId: 456,
  channel: 'email'
});
```

### 事件驱动通知

事件系统会自动根据配置发送通知：

```javascript
import { createEvent } from '../controllers/events.js';

// 创建项目评论事件，自动发送通知给相关用户
await createEvent('comment_create', actorId, 'project', projectId, {
  project_name: '项目名称',
  comment_text: '评论内容'
});
```

## 通知模板

通知模板位于 `src/config/notificationTemplates.json`，包含以下字段：

- `title`: 模板标题
- `template`: 内容模板（支持 `{{变量}}` 语法）
- `icon`: 图标名称
- `requiresActor`: 是否需要行为者信息
- `requiresData`: 需要的数据字段列表

示例模板：
```json
{
  "project_comment": {
    "title": "项目评论",
    "template": "{{actor_name}} 评论了您的项目 {{target_name}}",
    "icon": "comment",
    "requiresActor": true,
    "requiresData": ["target_name"]
  }
}
```

## 邮件通知

邮件通知功能需要配置邮件服务。邮件内容会自动生成 HTML 格式，包含：

- 标题和内容
- 查看详情按钮（链接到 `/app/notifications/:id`）
- ZeroCat 品牌信息

邮件跳转地址格式：`{前端地址}/app/notifications/{通知ID}`

## 前端集成

### 推送通知集成

#### 1. 注册 Service Worker

```javascript
// 注册 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('Service Worker 注册成功');
      // 请求通知权限
      return requestNotificationPermission(registration);
    })
    .catch(error => {
      console.error('Service Worker 注册失败:', error);
    });
}

async function requestNotificationPermission(registration) {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // 订阅推送通知
    await subscribeToPush(registration);
  }
}
```

#### 2. 订阅推送通知

```javascript
async function subscribeToPush(registration) {
  try {
    // 获取 VAPID 公钥（从服务器获取或硬编码）
    const vapidPublicKey = 'BK...'; // 你的 VAPID 公钥

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // 发送订阅信息到服务器
    await fetch('/notifications/register-browser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        device_info: {
          browser: getBrowserInfo(),
          os: getOSInfo(),
          version: getBrowserVersion()
        }
      })
    });

    console.log('推送通知订阅成功');
  } catch (error) {
    console.error('推送通知订阅失败:', error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

#### 3. Service Worker 处理推送事件

创建 `public/sw.js` 文件：

```javascript
// Service Worker - 处理推送事件
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-72x72.png',
    data: data.data,
    actions: [
      {
        action: 'view',
        title: '查看'
      },
      {
        action: 'dismiss',
        title: '忽略'
      }
    ],
    requireInteraction: true,
    timestamp: data.timestamp
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 处理通知点击事件
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // 获取通知数据
  const data = event.notification.data;

  let url = '/';
  if (data.notificationId) {
    url = `/app/notifications/${data.notificationId}`;
  } else if (data.url) {
    url = data.url;
  }

  event.waitUntil(
    clients.matchAll().then(clientList => {
      // 查找已打开的窗口
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

#### 4. 取消订阅

```javascript
async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // 取消本地订阅
      await subscription.unsubscribe();

      // 通知服务器
      await fetch('/notifications/register-browser', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });

      console.log('推送通知取消成功');
    }
  } catch (error) {
    console.error('取消推送通知失败:', error);
  }
}
```

### 获取通知列表
```javascript
// 获取通知列表
fetch('/notifications?limit=20&offset=0')
  .then(response => response.json())
  .then(data => {
    console.log('通知列表:', data.notifications);
  });
```

### 查看单个通知
```javascript
// 访问单个通知（自动标记已读）
fetch(`/notifications/${notificationId}`)
  .then(response => response.json())
  .then(notification => {
    console.log('通知详情:', notification);
  });
```

### 发送自定义通知
```javascript
// 发送通知
fetch('/notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 123,
    title: '测试通知',
    content: '这是一个测试通知',
    link: '/test-page'
  })
})
.then(response => response.json())
.then(result => {
  console.log('发送结果:', result);
});
```

## 注意事项

1. **通知内容固化**: 通知创建后，内容不再变化，即使模板或相关数据发生变化
2. **兼容性**: 保留了 `data` 字段确保向后兼容
3. **安全性**: 用户只能访问自己的通知
4. **性能**: 通知内容预生成，提高查询性能
5. **扩展性**: 通过 `metadata` 字段支持自定义数据存储

## 迁移说明

现有的通知创建代码无需修改，新的 `createNotification` 函数向后兼容。但建议使用新的 `sendNotification` 接口来获得更好的功能支持。