

你需要参考文档，创建一个sudotoken的管理组件，可以调用获取sudotoken，如果没有则阻塞执行并弹出弹框，创建统一的账户认证组件，允许使用各种认证方式。任何关键的请求都可以调用sudo组件获取sudotoken，sudotoken管理组件需要存储记录
  ，并判断过期等等，保留一定缓冲时间。
## 认证方式与目的

**认证方式**：password, email, totp, passkey

**获取认证方法**
```
GET /auth/methods?purpose=login
```

**响应:**
```json
{
  "status": "success",
  "data": {
    "purpose": "login",
    "available_methods": ["password", "email", "passkey"]
  }
}
```
## 二次验证（2FA）

当用户启用了2FA后，密码/邮箱/魔术链接登录将返回need_2fa响应：

```
POST /account/login
```

成功但需要2FA示例：

```json
{
  "status": "need_2fa",
  "message": "需要二次验证",
  "data": {
    "challenge_id": "abc123...",
    "expires_in": 600,
    "available_methods": ["totp", "passkey"]
  }
}
```

使用TOTP完成登录：

```
POST /account/2fa/login/totp
{
  "challenge_id": "abc123...",
  "token": "123456"
}
```

响应（登录成功）：

```json
{
  "status": "success",
  "data": {
    "user": {"id": 123, "username": "testuser"},
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600
  }
}
```

管理2FA：

```
GET /account/2fa/status
POST /account/2fa/setup
POST /account/2fa/activate { token }
POST /account/2fa/disable
```

## Passkey（WebAuthn）

注册：

```
POST /account/passkey/begin-registration
POST /account/passkey/finish-registration
```

登录：

```
POST /account/passkey/begin-login { identifier }
POST /account/passkey/finish-login { user_id, challenge, assertion }
```

sudo 提升：

```
POST /account/passkey/sudo-begin
POST /account/passkey/sudo-finish { challenge, assertion }
```


**发送验证码**
```
POST /auth/send-code
{
  "email": "user@example.com",
  "purpose": "login",
  "userId": 123
}
```
**响应:**
```json
{
  "status": "success",
  "data": {
    "code_id": "uuid"
  }
}
```
**统一认证**
```
POST /auth/authenticate
```

密码认证示例：
```json
{
  "method": "password",
  "purpose": "login",
  "identifier": "username_or_email",
  "password": "your_password"
}
```

注意：启用2FA的用户不会直接在此接口获得令牌，需要按照2FA流程完成。

**成功响应（登录）:**
```json
{
  "status": "success",
  "message": "login认证成功",
  "data": {
    "user": {
      "id": 123,
      "username": "testuser",
      "display_name": "Test User",
      "email": "user@example.com"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def502001a2b3c...",
    "expires_in": 3600
  }
}
```

邮件认证示例：
```json
{
  "method": "email",
  "purpose": "sudo",
  "code_id": "uuid-from-send-code",
  "code": "123456"
}
```

**成功响应（sudo）:**
```json
{
  "status": "success",
  "message": "sudo认证成功",
  "data": {
    "sudo_token": "a1b2c3d4e5f6...",
    "expires_in": 900
  }
}
```

也可以使用passkey完成sudo：

```
POST /account/passkey/sudo-begin
POST /account/passkey/sudo-finish { challenge, assertion }
```

**重置密码认证示例：**
```json
{
  "method": "email",
  "purpose": "reset_password",
  "code_id": "uuid-from-send-code",
  "code": "654321"
}
```

**成功响应（重置密码）:**
```json
{
  "status": "success",
  "message": "reset_password认证成功",
  "data": {
    "reset_token": "reset_abc123...",
    "expires_in": 1800
  }
}
```

## 中间件

导入：
```javascript
import { requireSudo, optionalSudo } from '../middleware/sudo.js';
```

使用：
```javascript
// 强制sudo
router.delete('/admin/users/:id', requireSudo, deleteUser);
// 可选sudo
router.get('/admin/users', optionalSudo, getUsers);
```

sudo令牌传递方式：
- Authorization头: `Authorization: Sudo <token>`
- 自定义头: `X-Sudo-Token: <token>`
- Query参数: `?sudo_token=<token>`
- 请求体: `{"sudo_token": "<token>"}`

## 错误码

- EMAIL_REQUIRED: 需要邮箱
- NEED_LOGIN: 需要登录
- EMAIL_NOT_FOUND: 邮箱未注册
- SEND_CODE_FAILED: 发送验证码失败
- AUTH_FAILED: 认证失败
- SUDO_TOKEN_REQUIRED: 需要sudo令牌
- SUDO_TOKEN_INVALID: sudo令牌无效