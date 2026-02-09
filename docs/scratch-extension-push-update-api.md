# Scratch 扩展创建/推送/更新接口文档

## 基础信息
| 项 | 值 |
|---|---|
| 基础路径 | `/extensions` |
| 鉴权 | 需要登录（`needLogin`） |
| Token 支持 | `Authorization: Bearer <token>` / `?token=<token>` / Cookie `token` |
| 建议请求头 | `Accept: application/json` |

## 通用返回格式
### 成功
```json
{
  "status": "success",
  "message": "文本消息",
  "data": {}
}
```

### 失败
```json
{
  "status": "error",
  "message": "错误消息"
}
```

---

## 0) 创建扩展
`POST /extensions/manager/create`

### 作用
创建一条扩展记录，初始状态为 `developing`。

### 请求体
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `projectid` | number | 是 | 项目 ID（必须为当前登录用户自己的项目） |
| `branch` | string | 否 | 分支名；不传时取项目默认分支 |
| `commit` | string | 否 | 提交哈希；不传或 `latest` 时保存为 `latest` |
| `image` | string | 否 | 封面资源 ID，默认空字符串 |
| `samples` | number | 否 | 示例项目 ID（必须为当前登录用户自己的项目） |
| `docs` | string | 否 | 文档 URL |
| `scratchCompatible` | boolean | 否 | 是否兼容 Scratch，默认 `false` |

### 成功返回示例
```json
{
  "status": "success",
  "message": "扩展创建成功",
  "data": {
    "id": 12,
    "projectid": 301,
    "branch": "main",
    "commit": "latest",
    "image": "a1b2c3d4e5f678901234567890abcdef",
    "samples": 455,
    "docs": "https://docs.example.com/ext-301",
    "scratchCompatible": true,
    "status": "developing",
    "created_at": "2026-02-09T08:10:11.000Z",
    "updated_at": "2026-02-09T08:10:11.000Z"
  }
}
```

### 错误返回示例
#### 401 未登录
```json
{
  "status": "error",
  "message": "需要登录",
  "code": "ZC_ERROR_NEED_LOGIN"
}
```

#### 400 缺少项目 ID
```json
{
  "status": "error",
  "message": "缺少项目ID"
}
```

#### 403 项目不可访问
```json
{
  "status": "error",
  "message": "项目不存在或无权访问"
}
```

#### 400 示例项目不可访问
```json
{
  "status": "error",
  "message": "示例项目不存在或无权访问"
}
```

#### 400 已存在扩展
```json
{
  "status": "error",
  "message": "该项目已存在扩展"
}
```

#### 500 分支或提交校验失败
```json
{
  "status": "error",
  "message": "分支不存在"
}
```

#### 500 服务端错误
```json
{
  "status": "error",
  "message": "创建扩展时出错"
}
```

### cURL
```bash
curl -X POST "http://localhost:3000/extensions/manager/create" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "projectid": 301,
    "branch": "main",
    "commit": "latest",
    "image": "a1b2c3d4e5f678901234567890abcdef",
    "samples": 455,
    "docs": "https://docs.example.com/ext-301",
    "scratchCompatible": true
  }'
```

---

## 1) 更新扩展提交指针
`POST /extensions/manager/update/:id`

### 作用
将扩展 `commit` 更新为当前 `branch` 的最新提交哈希。

### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | number | 是 | 扩展 ID |

### 请求体
无

### 成功返回示例（已更新）
```json
{
  "status": "success",
  "message": "扩展已更新到最新提交",
  "data": {
    "id": 12,
    "projectid": 301,
    "branch": "main",
    "commit": "f0c2e13b7f0b2f4f17f0f0f4be6a0e4cba3e9b55",
    "image": "a1b2c3d4e5f678901234567890abcdef",
    "samples": 455,
    "docs": "https://docs.example.com/ext-301",
    "scratchCompatible": true,
    "status": "developing",
    "created_at": "2026-02-08T03:18:11.000Z",
    "updated_at": "2026-02-09T08:15:22.000Z"
  }
}
```

### 成功返回示例（无需更新）
当扩展 `commit === "latest"` 时：
```json
{
  "status": "success",
  "message": "扩展已是最新提交",
  "data": {
    "id": 12,
    "projectid": 301,
    "branch": "main",
    "commit": "latest",
    "image": "a1b2c3d4e5f678901234567890abcdef",
    "samples": 455,
    "docs": "https://docs.example.com/ext-301",
    "scratchCompatible": true,
    "status": "developing",
    "created_at": "2026-02-08T03:18:11.000Z",
    "updated_at": "2026-02-08T03:18:11.000Z",
    "project": {
      "id": 301,
      "name": "motion-plus",
      "default_branch": "main",
      "authorid": 10086
    }
  }
}
```

### 错误返回示例
#### 401 未登录
```json
{
  "status": "error",
  "message": "需要登录",
  "code": "ZC_ERROR_NEED_LOGIN"
}
```

#### 403 无权限
```json
{
  "status": "error",
  "message": "无权更新该扩展"
}
```

#### 404 扩展不存在
```json
{
  "status": "error",
  "message": "扩展不存在"
}
```

#### 400 分支不可用
```json
{
  "status": "error",
  "message": "无法获取分支最新提交"
}
```

#### 500 服务端错误
```json
{
  "status": "error",
  "message": "更新扩展提交时出错"
}
```

### cURL
```bash
curl -X POST "http://localhost:3000/extensions/manager/update/12" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer <token>"
```

---

## 2) 推送扩展到审核队列
`POST /extensions/manager/submit/:id`

### 作用
将扩展状态从 `developing` 推送为 `pending`（提交审核）。

### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | number | 是 | 扩展 ID |

### 请求体
无

### 成功返回示例
```json
{
  "status": "success",
  "message": "扩展已提交审核，待管理员审核",
  "data": {
    "id": 12,
    "projectid": 301,
    "branch": "main",
    "commit": "f0c2e13b7f0b2f4f17f0f0f4be6a0e4cba3e9b55",
    "image": "a1b2c3d4e5f678901234567890abcdef",
    "samples": 455,
    "docs": "https://docs.example.com/ext-301",
    "scratchCompatible": true,
    "status": "pending",
    "created_at": "2026-02-08T03:18:11.000Z",
    "updated_at": "2026-02-09T08:16:03.000Z"
  }
}
```

### 错误返回示例
#### 401 未登录
```json
{
  "status": "error",
  "message": "需要登录",
  "code": "ZC_ERROR_NEED_LOGIN"
}
```

#### 403 无权限
```json
{
  "status": "error",
  "message": "无权提交该扩展"
}
```

#### 404 扩展不存在
```json
{
  "status": "error",
  "message": "扩展不存在"
}
```

#### 400 状态不允许提交
```json
{
  "status": "error",
  "message": "仅开发中的扩展可以提交审核"
}
```

#### 500 服务端错误
```json
{
  "status": "error",
  "message": "提交扩展审核时出错"
}
```

### cURL
```bash
curl -X POST "http://localhost:3000/extensions/manager/submit/12" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer <token>"
```

---

## 状态流转
`developing -> pending -> verified/rejected`

## `data` 字段说明（两接口通用）
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 扩展 ID |
| `projectid` | number | 绑定项目 ID |
| `branch` | string | 扩展来源分支 |
| `commit` | string | 提交哈希或 `latest` |
| `image` | string | 扩展封面资源 ID |
| `samples` | number \| null | 示例项目 ID |
| `docs` | string \| null | 文档地址 |
| `scratchCompatible` | boolean | 是否标记 Scratch 兼容 |
| `status` | string | `developing`/`pending`/`verified`/`rejected` |
| `created_at` | string(datetime) | 创建时间（ISO 8601） |
| `updated_at` | string(datetime) | 更新时间（ISO 8601） |
