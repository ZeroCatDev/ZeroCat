# ZeroCat OAuth 2.0 接口文档（简化版）

本指南介绍如何通过 OAuth 2.0 接入 ZeroCat，实现用户认证与数据访问。

---

## 一、基本信息

* **协议标准**：OAuth 2.0
* **支持流程**：授权码模式（可选 PKCE 支持）
* **认证入口**：`https://api.zerocat.dev/oauth/authorize`
* **令牌交换**：`https://api.zerocat.dev/oauth/token`
* **用户信息**：`https://api.zerocat.dev/oauth/userinfo`

---

## 二、集成步骤

### 1. 创建 OAuth 应用

在 ZeroCat 控制台创建应用，填写以下字段：

* 应用名称、主页地址、回调地址（Redirect URI）
* 应用描述、Logo（可选）、隐私政策和服务条款链接（可选）

创建后获取：

* `client_id`
* `client_secret`

---

### 2. 用户授权

引导用户访问授权地址：

```
GET https://api.zerocat.dev/oauth/authorize
```

#### 请求参数：

| 参数名                     | 说明                  |
| ----------------------- | ------------------- |
| client\_id              | 必填，应用的客户端 ID        |
| redirect\_uri           | 必填，预配置的回调地址         |
| response\_type          | 必填，固定为 `code`       |
| scope                   | 可选，权限范围（空格分隔）       |
| state                   | 推荐，随机字符串防止 CSRF 攻击  |
| code\_challenge         | 可选，PKCE 使用          |
| code\_challenge\_method | 可选，`plain` 或 `S256` |

示例链接：

```
https://api.zerocat.dev/oauth/authorize?
client_id=xxx&redirect_uri=https://yourapp.com/callback&
response_type=code&scope=user:basic user:email&state=xyz
```

---

### 3. 获取访问令牌（access\_token）

用户授权后，ZeroCat 会跳转至 `redirect_uri`，并附带 `code` 参数。

使用此 `code` 向令牌端点发起 POST 请求：

```
POST https://api.zerocat.dev/oauth/token
```

#### 请求参数：

| 参数名            | 说明                       |
| -------------- | ------------------------ |
| grant\_type    | 固定为 `authorization_code` |
| client\_id     | 应用的客户端 ID                |
| client\_secret | 应用的客户端密钥                 |
| code           | 授权返回的 code               |
| redirect\_uri  | 必须与授权时一致                 |
| code\_verifier | 若启用 PKCE，则必填             |

#### 响应示例：

```json
{
  "access_token": "abc",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "xyz",
  "scope": "user:basic user:email"
}
```

---

### 4. 使用访问令牌

调用 API 时，在 Header 中添加：

```
Authorization: Bearer access_token_here
```

---

### 5. 刷新令牌（可选）

当 access\_token 过期时，可通过 refresh\_token 刷新：

```
POST https://api.zerocat.dev/oauth/token
```

#### 请求参数：

| 参数名            | 说明                  |
| -------------- | ------------------- |
| grant\_type    | 固定为 `refresh_token` |
| client\_id     | 应用的客户端 ID           |
| client\_secret | 应用的客户端密钥            |
| refresh\_token | 刷新令牌                |

---

## 三、用户信息接口

```
GET https://api.zerocat.dev/oauth/userinfo
Authorization: Bearer access_token_here
```

#### 返回示例：

```json
{
  "sub": "12345",
  "username": "johndoe",
  "name": "John Doe",
  "email": "john@example.com",
  "email_verified": true
}
```

---

## 四、可用权限（Scopes）

| 权限名          | 说明           |
| ------------ | ------------ |
| `user:basic` | 获取用户名与显示名    |
| `user:email` | 获取用户验证过的邮箱地址 |

---

## 五、安全建议

1. 使用 HTTPS 作为回调地址
2. 建议启用 PKCE，特别是移动端应用
3. 客户端密钥请勿暴露于前端代码
4. 始终校验 state 参数与 redirect\_uri
5. 妥善管理与吊销令牌，保护用户数据隐私

---

## 六、接口限速

* 全局限制：每应用每小时 5000 次请求
* 授权请求：每 IP 每分钟最多 10 次

---

## 七、错误示例

通用错误格式：

```json
{
  "error": "invalid_request",
  "error_description": "参数缺失或格式错误"
}
```

常见错误类型：

* `invalid_request`：参数不合法
* `invalid_client`：客户端验证失败
* `invalid_grant`：code 或 refresh\_token 无效
* `invalid_scope`：权限范围无效
* `unauthorized_client`：客户端未被授权
* `access_denied`：用户拒绝授权