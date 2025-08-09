## 账户安全：2FA 与 Passkey

### 启用与管理 2FA (TOTP)

- GET `/account/2fa/status`
- POST `/account/2fa/setup`
- POST `/account/2fa/activate` { token }
- POST `/account/2fa/disable`

示例响应（setup）：

```json
{
  "status": "success",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP...",
    "otpauth_url": "otpauth://totp/ZeroCat:username?...",
    "algorithm": "SHA256",
    "digits": 6,
    "period": 30
  }
}
```

### 登录时 2FA 流程

当用户启用2FA，密码/邮箱/魔术链接登录返回：

```json
{
  "status": "need_2fa",
  "data": {"challenge_id": "abc123", "expires_in": 600, "available_methods": ["totp", "passkey"]}
}
```

使用TOTP完成登录：

- POST `/account/2fa/login/totp` { challenge_id, token }

成功后返回标准登录成功响应（携带access_token与refresh_token）。

### Passkey (WebAuthn) 支持

- POST `/account/passkey/begin-registration`
  - 响应示例：
  ```json
  {
    "status": "success",
    "data": {
      "challenge": "...",
      "rp": {"id": "example.com", "name": "ZeroCat"},
      "user": {"id": "123", "name": "username"},
      "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
      "excludeCredentials": [ {"id": "base64url...", "transports": ["internal"]} ]
    }
  }
  ```
- POST `/account/passkey/finish-registration` 传入浏览器返回的注册凭据对象
  - 响应：`{"status":"success","message":"Passkey 已注册"}`
- POST `/account/passkey/begin-login` { identifier }
  - identifier 可省略，省略时走发现式（discoverable）登录，无需用户手动输入账号标识。
  - 响应：
  ```json
  {
    "status":"success",
    "data":{ /* WebAuthn PublicKeyCredentialRequestOptions */ }
  }
  ```
- POST `/account/passkey/finish-login` 传入浏览器返回的断言对象
  - 成功返回标准登录成功响应（含access_token与refresh_token）
- POST `/account/passkey/sudo-begin`
  - 响应同begin-login
- POST `/account/passkey/sudo-finish` 传入浏览器返回的断言对象
  - 响应：`{"status":"success","data":{"sudo_token":"...","expires_in":900}}`

管理凭据：

- GET `/account/passkey/list`
  - 响应：
  ```json
  {
    "status":"success",
    "data":[
      {"credential_id":"base64url...","transports":["internal"],"counter":12,"registered_at":1710000000}
    ]
  }
  ```
- POST `/account/passkey/delete` { credential_id }
  - 需要 sudo，删除指定凭据；若删除后无剩余凭据，`verified` 自动置为 false。

说明：服务器将凭据存储在 `ow_users_contacts` 中，类型为 `passkey`，并在 `metadata` 中保存WebAuthn相关信息以保持向后兼容。


