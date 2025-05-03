# 用户认证API文档

## 概述

本文档详细介绍了所有与用户认证、注册和登录相关的API接口。系统支持多种登录方式，包括密码登录、验证码登录和魔术链接登录。

## 基本约定

所有API请求和响应均使用JSON格式。除非特别说明，所有请求都需要包含以下头部：

```
Content-Type: application/json
```

所有响应都包含以下基本结构：

```json
{
  "status": "success|error",
  "message": "操作结果说明",
  // 其他数据...
}
```

### 状态码

- `success`: 操作成功
- `error`: 操作失败

## 用户注册和验证

### 注册用户

注册新用户，只需要邮箱或用户名，密码可选。

**请求**

```
POST /api/account/register
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 否* | 用户邮箱（邮箱和用户名必填其一） |
| username | string | 否* | 用户名（邮箱和用户名必填其一） |
| password | string | 否 | 密码，如果不提供则后续需要设置 |
| skipPassword | boolean | 否 | 是否跳过密码设置（用于第三方登录注册） |

**响应**

成功:
```json
{
  "status": "success",
  "message": "注册成功，请查收验证邮件完成注册",
  "userId": 12345,
  "username": "example_user",
  "needVerify": true,
  "needPassword": false,
  "setupUrl": null
}
```

失败:
```json
{
  "status": "error",
  "message": "邮箱已被使用"
}
```

### 验证邮箱

验证用户邮箱。

**请求**

```
POST /api/account/verify-email
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 要验证的邮箱 |
| code | string | 是 | 验证码 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "邮箱验证成功"
}
```

失败:
```json
{
  "status": "error",
  "message": "验证码错误",
  "attemptsLeft": 4
}
```

### 设置密码

为用户设置密码（适用于注册时未设置密码的情况）。

**请求**

```
POST /api/account/set-password
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| userId | number | 是 | 用户ID |
| password | string | 是 | 新密码 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "密码设置成功"
}
```

失败:
```json
{
  "status": "error",
  "message": "密码格式不正确，密码至少需要8位，包含数字和字母"
}
```

## 登录

### 密码登录

使用用户名/邮箱和密码登录。

**请求**

```
POST /api/account/login
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| un | string | 是 | 用户名或邮箱 |
| pw | string | 是 | 密码 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "登录成功",
  "userid": 12345,
  "username": "example_user",
  "display_name": "Example User",
  "avatar": "avatar_url",
  "email": "user@example.com",
  "token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_at": "2023-05-10T12:00:00Z",
  "refresh_expires_at": "2023-06-10T12:00:00Z"
}
```

失败:
```json
{
  "status": "error",
  "message": "账户或密码错误"
}
```

### 发送登录验证码

发送邮箱验证码用于登录。

**请求**

```
POST /api/account/send-login-code
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 用户邮箱 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "验证码已发送",
  "email": "user@example.com",
  "expiresIn": 300
}
```

失败:
```json
{
  "status": "error",
  "message": "发送验证码过于频繁，请稍后再试"
}
```

### 验证码登录

使用邮箱验证码登录。

**请求**

```
POST /api/account/login-with-code
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 用户邮箱 |
| code | string | 是 | 验证码 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "登录成功",
  "userid": 12345,
  "username": "example_user",
  "display_name": "Example User",
  "avatar": "avatar_url",
  "email": "user@example.com",
  "token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_at": "2023-05-10T12:00:00Z",
  "refresh_expires_at": "2023-06-10T12:00:00Z"
}
```

失败:
```json
{
  "status": "error",
  "message": "验证码错误",
  "attemptsLeft": 4
}
```

### 生成魔术链接

生成登录魔术链接。

**请求**

```
POST /api/account/magiclink/generate
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 用户邮箱 |
| redirect | string | 否 | 登录后重定向URL |

**响应**

成功:
```json
{
  "status": "success",
  "message": "魔术链接已发送到您的邮箱",
  "expiresIn": 600
}
```

失败:
```json
{
  "status": "error",
  "message": "未找到此邮箱地址"
}
```

### 验证魔术链接

验证并使用魔术链接登录。

**请求**

```
GET /api/account/magiclink/validate?token=xxx&redirect=xxx
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| token | string | 是 | 魔术链接令牌 |
| redirect | string | 否 | 登录成功后重定向URL |

**响应**

成功:
```json
{
  "status": "success",
  "message": "登录成功",
  "userid": 12345,
  "username": "example_user",
  "display_name": "Example User",
  "avatar": "avatar_url",
  "email": "user@example.com",
  "token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_at": "2023-05-10T12:00:00Z",
  "refresh_expires_at": "2023-06-10T12:00:00Z",
  "callback": {
    "redirect": "https://example.com/dashboard",
    "canUseCurrentPage": true
  }
}
```

失败:
```json
{
  "status": "error",
  "message": "魔术链接已过期或无效"
}
```

## 密码重置

### 发送密码重置邮件

发送密码重置链接。

**请求**

```
POST /api/account/retrievePassword
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 用户邮箱 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "重置密码链接已发送到您的邮箱"
}
```

失败:
```json
{
  "status": "error",
  "message": "发送找回密码邮件失败"
}
```

### 重置密码

使用重置链接重置密码。

**请求**

```
POST /api/account/reset-password
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| token | string | 是 | 重置令牌 |
| password | string | 是 | 新密码 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "密码已重置，请使用新密码登录"
}
```

失败:
```json
{
  "status": "error",
  "message": "重置链接已过期或已被使用"
}
```

## 令牌管理

### 刷新令牌

使用刷新令牌获取新的访问令牌。

**请求**

```
POST /api/account/refresh-token
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| refresh_token | string | 是 | 刷新令牌 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "令牌已刷新",
  "token": "new_jwt_token",
  "expires_at": "2023-05-10T12:15:00Z"
}
```

失败:
```json
{
  "status": "error",
  "message": "刷新令牌已过期"
}
```

### 登出

撤销当前令牌并登出。

**请求**

```
POST /api/account/logout
```

**参数**

无

**响应**

成功:
```json
{
  "status": "success",
  "message": "登出成功"
}
```

失败:
```json
{
  "status": "error",
  "message": "登出失败"
}
```

### 登出所有设备

撤销所有设备的令牌（除当前设备外）。

**请求**

```
POST /api/account/logout-all-devices
```

**参数**

无

**响应**

成功:
```json
{
  "status": "success",
  "message": "已登出所有其他设备",
  "count": 3
}
```

失败:
```json
{
  "status": "error",
  "message": "登出失败"
}
```

### 获取活跃令牌

获取用户所有活跃登录令牌。

**请求**

```
GET /api/account/active-tokens
```

**参数**

无

**响应**

成功:
```json
{
  "status": "success",
  "tokens": [
    {
      "id": "token_id",
      "device_info": {
        "browser": "Chrome",
        "os": "Windows",
        "device": "Desktop"
      },
      "ip_address": "192.168.1.1",
      "created_at": "2023-04-10T12:00:00Z",
      "last_used_at": "2023-05-05T15:30:00Z",
      "current": true
    },
    // 更多令牌...
  ]
}
```

### 撤销令牌

撤销特定令牌。

**请求**

```
POST /api/account/revoke-token
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| token_id | string | 是 | 令牌ID |

**响应**

成功:
```json
{
  "status": "success",
  "message": "令牌已撤销"
}
```

失败:
```json
{
  "status": "error",
  "message": "令牌撤销失败"
}
```

## 邮箱管理

### 获取用户邮箱列表

获取当前用户的所有邮箱。

**请求**

```
GET /api/account/emails
```

**参数**

无

**响应**

成功:
```json
{
  "status": "success",
  "emails": [
    {
      "id": 1,
      "email": "primary@example.com",
      "is_primary": true,
      "verified": true
    },
    {
      "id": 2,
      "email": "secondary@example.com",
      "is_primary": false,
      "verified": true
    }
  ]
}
```

### 发送邮箱验证码

发送邮箱验证码用于添加新邮箱。

**请求**

```
POST /api/account/send-verification-code
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 要验证的邮箱 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "验证码已发送"
}
```

失败:
```json
{
  "status": "error",
  "message": "发送验证码过于频繁，请稍后再试"
}
```

### 添加邮箱

为当前用户添加新邮箱。

**请求**

```
POST /api/account/add-email
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 新邮箱 |
| code | string | 是 | 验证码 |
| is_primary | boolean | 否 | 是否设为主邮箱 |

**响应**

成功:
```json
{
  "status": "success",
  "message": "邮箱添加成功"
}
```

失败:
```json
{
  "status": "error",
  "message": "验证码错误"
}
```

### 移除邮箱

移除用户的邮箱。

**请求**

```
POST /api/account/remove-email
```

**参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email_id | number | 是 | 邮箱ID |

**响应**

成功:
```json
{
  "status": "success",
  "message": "邮箱已移除"
}
```

失败:
```json
{
  "status": "error",
  "message": "无法移除主邮箱，请先设置其他邮箱为主邮箱"
}
```

## 错误代码

| 错误代码 | 描述 |
|---------|------|
| NO_PASSWORD | 用户未设置密码，需要使用验证码或魔术链接登录 |
| RATE_LIMIT | 请求频率超过限制 |
| INVALID_TOKEN | 无效的令牌 |
| EXPIRED_TOKEN | 令牌已过期 |
| INVALID_CODE | 验证码错误 |
| TOO_MANY_ATTEMPTS | 尝试次数过多 |

## 安全建议

1. 所有包含敏感信息的请求应使用HTTPS。
2. 访问令牌有效期较短（15分钟），应定期刷新。
3. 如发现异常登录，请立即使用"登出所有设备"功能。
4. 建议启用TOTP二次验证以提高账户安全性。