# OAuth临时令牌认证流程

## 概述

为了提高安全性，OAuth登录流程现已更新为使用临时令牌（Temporary Token）模式。这种方式将敏感的用户数据安全地存储在Redis中，而不是直接在URL中传递。

## 认证流程

1. 用户点击OAuth登录按钮，后端生成state并重定向到OAuth提供商
2. 用户在OAuth提供商页面完成授权
3. OAuth提供商回调我们的系统
4. 后端验证OAuth信息并生成临时令牌，将用户数据存储在Redis中
5. 后端将临时令牌通过URL参数重定向到前端
6. 前端获取临时令牌，调用验证API获取正式登录凭证和用户信息

## 前端实现

### 1. 获取临时令牌

当用户完成OAuth授权后，系统会重定向到前端的回调页面，URL中包含临时令牌：

```
https://your-frontend.com/app/account/callback?temp_token=abcdef123456
```

### 2. 使用临时令牌获取用户信息和正式令牌

前端需要从URL中提取临时令牌，然后调用API获取用户信息和正式的登录令牌：

```javascript
// 从URL中提取临时令牌
const urlParams = new URLSearchParams(window.location.search);
const tempToken = urlParams.get('temp_token');

if (tempToken) {
  // 调用API验证临时令牌并获取用户信息
  fetch(`https://your-api.com/account/oauth/validate-token/${tempToken}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // 存储用户信息和令牌
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify({
          userid: data.userid,
          username: data.username,
          display_name: data.display_name,
          avatar: data.avatar,
          email: data.email
        }));

        // 登录成功后的操作...
        // 重定向到用户主页
        window.location.href = '/app/dashboard';
      } else {
        // 处理错误
        console.error('登录失败:', data.message);
        // 显示错误消息
        showError(data.message);
      }
    })
    .catch(error => {
      console.error('验证临时令牌时出错:', error);
      showError('登录过程中发生错误，请重试');
    });
}
```

## 临时令牌安全性

- 临时令牌存储在Redis中，有效期为24小时
- 临时令牌仅可使用一次，验证后自动失效
- 用户数据存储在Redis中，而不是直接在URL中传递
- 临时令牌只能通过特定的API端点验证，增加了安全性

## API参考

### 获取用户信息和令牌

**请求**

```
GET /account/oauth/validate-token/:token
```

**响应**

成功:
```json
{
  "status": "success",
  "message": "登录成功",
  "userid": 123,
  "username": "user123",
  "display_name": "用户名称",
  "avatar": "avatar.jpg",
  "email": "user@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "abcdef123456789...",
  "expires_at": "2023-06-01T12:00:00Z",
  "refresh_expires_at": "2023-07-01T12:00:00Z"
}
```

失败:
```json
{
  "status": "error",
  "message": "令牌不存在或已过期"
}
```