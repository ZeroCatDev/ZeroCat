# 用户鉴权系统说明文档

本文档详细介绍了系统的用户鉴权系统，包括令牌管理、刷新机制、设备记录等功能。

## 系统架构

鉴权系统主要由以下部分组成：

1. **数据模型**：
   - `ow_auth_tokens` - 存储访问令牌和刷新令牌
   - `ow_user_devices` - 记录用户设备信息

2. **核心功能**：
   - 令牌生成与验证
   - 令牌刷新机制
   - 设备管理
   - 令牌吊销

3. **API接口**：
   - 登录与注册
   - 令牌刷新
   - 设备管理
   - 令牌管理

## 数据库迁移

系统提供了两种迁移方式：

### 使用Prisma迁移

```bash
# 使用Prisma CLI执行迁移
node prisma/migrate-auth-system.js
```

### 手动SQL迁移

```bash
# 使用SQL脚本执行迁移
node prisma/migrations.js
```

## 配置项

系统在`ow_config`表中存储了以下配置项：

- `security.accessTokenExpiry` - 访问令牌过期时间（秒），默认3600秒（1小时）
- `security.refreshTokenExpiry` - 刷新令牌过期时间（秒），默认604800秒（7天）

## API接口说明

### 登录接口

```
POST /account/login
```

**请求参数**：
- `un`: 用户名或邮箱
- `pw`: 密码

**响应内容**：
```json
{
  "status": "success",
  "message": "登录成功",
  "userid": 123,
  "username": "example",
  "display_name": "用户昵称",
  "avatar": "avatar_url",
  "email": "user@example.com",
  "token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_at": "2023-01-01T00:00:00Z",
  "refresh_expires_at": "2023-01-08T00:00:00Z"
}
```

### 刷新令牌接口

```
POST /account/refresh-token
```

**请求参数**：
- `refresh_token`: 刷新令牌

**响应内容**：
```json
{
  "status": "success",
  "message": "令牌已刷新",
  "token": "new_jwt_token",
  "expires_at": "2023-01-01T00:00:00Z"
}
```

### 登出接口

```
POST /account/logout
```

**请求头**：
- `Authorization`: Bearer {token}

**响应内容**：
```json
{
  "status": "success",
  "message": "已成功退出登录"
}
```

### 所有设备登出接口

```
POST /account/logout-all-devices
```

**请求头**：
- `Authorization`: Bearer {token}

**响应内容**：
```json
{
  "status": "success",
  "message": "已成功退出所有设备"
}
```

### 获取设备列表

```
GET /account/devices
```

**请求头**：
- `Authorization`: Bearer {token}

**响应内容**：
```json
{
  "status": "success",
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "device_type": "desktop",
      "os": "Windows 10",
      "browser": "Chrome 90.0",
      "last_login_at": "2023-01-01T00:00:00Z",
      "last_login_ip": "127.0.0.1",
      "is_trusted": false
    }
  ]
}
```

### 获取活跃令牌列表

```
GET /account/active-tokens
```

**请求头**：
- `Authorization`: Bearer {token}

**响应内容**：
```json
{
  "status": "success",
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "created_at": "2023-01-01T00:00:00Z",
      "expires_at": "2023-01-01T01:00:00Z",
      "device": {
        "id": 1,
        "device_type": "desktop",
        "os": "Windows 10",
        "browser": "Chrome 90.0",
        "last_login_at": "2023-01-01T00:00:00Z",
        "is_trusted": false
      },
      "ip_address": "127.0.0.1",
      "is_current": true
    }
  ]
}
```

### 吊销令牌

```
POST /account/revoke-token
```

**请求头**：
- `Authorization`: Bearer {token}

**请求参数**：
- `token_id`: 令牌ID

**响应内容**：
```json
{
  "status": "success",
  "message": "令牌已成功吊销"
}
```

### 标记设备为可信

```
POST /account/trust-device
```

**请求头**：
- `Authorization`: Bearer {token}

**请求参数**：
- `device_id`: 设备ID

**响应内容**：
```json
{
  "status": "success",
  "message": "设备已标记为可信"
}
```

### 取消设备可信状态

```
POST /account/untrust-device
```

**请求头**：
- `Authorization`: Bearer {token}

**请求参数**：
- `device_id`: 设备ID

**响应内容**：
```json
{
  "status": "success",
  "message": "已取消设备可信状态"
}
```

## 使用示例

### 前端登录流程

```javascript
// 1. 用户登录
async function login(username, password) {
  const response = await fetch('/account/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ un: username, pw: password })
  });

  const data = await response.json();

  if (data.status === 'success') {
    // 存储令牌
    localStorage.setItem('token', data.token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('expires_at', data.expires_at);
    localStorage.setItem('refresh_expires_at', data.refresh_expires_at);

    return data;
  } else {
    throw new Error(data.message);
  }
}

// 2. 令牌刷新
async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch('/account/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const data = await response.json();

  if (data.status === 'success') {
    // 更新访问令牌
    localStorage.setItem('token', data.token);
    localStorage.setItem('expires_at', data.expires_at);

    return data.token;
  } else {
    // 刷新失败，需要重新登录
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('refresh_expires_at');

    throw new Error(data.message);
  }
}

// 3. 请求拦截器
async function fetchWithAuth(url, options = {}) {
  // 检查令牌是否过期
  const expiresAt = localStorage.getItem('expires_at');

  if (expiresAt && new Date(expiresAt) < new Date()) {
    // 令牌已过期，尝试刷新
    try {
      await refreshToken();
    } catch (error) {
      // 刷新失败，重定向到登录页
      window.location.href = '/login';
      throw error;
    }
  }

  // 添加授权头
  const token = localStorage.getItem('token');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  // 发送请求
  return fetch(url, options);
}
```

## 安全最佳实践

1. **令牌存储**：
   - 前端应将令牌存储在内存中，或使用 HttpOnly Cookie
   - 避免将令牌存储在localStorage（上面的示例仅为演示）

2. **令牌生命周期**：
   - 访问令牌应设置较短的过期时间（1-2小时）
   - 刷新令牌可设置较长的过期时间（7-30天）

3. **定期清理**：
   - 系统会自动清理过期的令牌
   - 建议用户定期检查并清理不活跃的设备

4. **可信设备**：
   - 对于可信设备，可考虑延长令牌过期时间
   - 不常用的设备应及时清理

## 故障排除

1. **令牌验证失败**：
   - 检查令牌是否过期
   - 检查令牌是否已被吊销
   - 尝试刷新令牌

2. **设备识别错误**：
   - 如果设备识别不准确，可能是因为用户代理信息不完整
   - 考虑使用指纹识别技术提高准确性

3. **数据库迁移失败**：
   - 检查数据库连接
   - 检查数据库用户权限
   - 尝试手动执行SQL脚本