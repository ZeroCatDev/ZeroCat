# 扩展信息查询API文档

本文档描述了合并后的扩展信息查询API，支持查询公开扩展和用户自己的扩展。

## 接口概览

### 1. 统一扩展搜索接口 
`GET /extensions/search`

支持灵活的扩展搜索和筛选，可以查询公开扩展、用户自己的扩展或所有扩展。

### 2. 统一扩展详情接口
`GET /extensions/detail/:id`

获取单个扩展的详细信息，支持不同的查询范围。

## 详细API规范

### 1. 扩展搜索接口

#### 请求
```
GET /extensions/search
```

#### 查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量，最大100 |
| `sort` | string | "created_at" | 排序字段 |
| `order` | string | "desc" | 排序方向：asc/desc |
| `search` | string | "" | 搜索关键词（标题、描述、项目名） |
| `author` | string | "" | 作者用户名筛选 |
| `has_docs` | string | "" | 文档筛选：true/false |
| `has_samples` | string | "" | 示例筛选：true/false |
| `tags` | string | "" | 标签筛选，逗号分隔 |
| `scratchCompatible` | string | "" | Scratch兼容性：true/false |
| `scope` | string | "public" | 查询范围：public/my/all |
| `status_filter` | string | "" | 状态筛选：developing/pending/verified/rejected |

#### 排序字段选项
- `created_at`: 创建时间
- `updated_at`: 更新时间  
- `stars`: 星标数
- `views`: 查看数
- `likes`: 点赞数
- `name`: 名称
- `author`: 作者
- `popularity`: 综合热度

#### 查询范围说明
- `public`: 仅查询已验证的公开扩展
- `my`: 查询用户自己的扩展（需登录）
- `all`: 查询所有扩展（需管理员权限）

#### 响应格式
```json
{
  "status": "success",
  "data": {
    "extensions": [
      {
        "id": 1,
        "name": "扩展名称",
        "description": "扩展描述",
        "image": "https://example.com/image.webp",
        "status": "verified",
        "author": {
          "id": 123,
          "username": "username",
          "display_name": "显示名称",
          "avatar": "avatar_url",
          "profile_url": "https://example.com/username"
        },
        "project": {
          "id": 456,
          "name": "project_name",
          "url": "https://example.com/username/project",
          "star_count": 10,
          "view_count": 100,
          "like_count": 5,
          "tags": ["tag1", "tag2"]
        },
        "has_docs": true,
        "docs_url": "https://docs.example.com",
        "has_samples": true,
        "sample_project": {
          "id": 789,
          "name": "sample_name",
          "title": "示例标题",
          "author": {
            "username": "sample_author",
            "display_name": "示例作者"
          },
          "url": "https://example.com/sample_author/sample"
        },
        "scratchCompatible": true,
        "branch": "main",
        "commit": "abc123",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-02T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5,
      "has_next": true,
      "has_prev": false
    },
    "filters": {
      "search": "",
      "author": "",
      "has_docs": "",
      "has_samples": "",
      "tags": "",
      "scratchCompatible": "",
      "scope": "public",
      "status_filter": ""
    },
    "sort": {
      "field": "created_at",
      "order": "desc"
    }
  }
}
```

#### 示例请求

1. 查询公开扩展（默认）
```
GET /extensions/search
```

2. 查询用户自己的扩展
```
GET /extensions/search?scope=my
```

3. 搜索包含"sensor"关键词的扩展
```
GET /extensions/search?search=sensor
```

4. 查询有文档且Scratch兼容的扩展
```
GET /extensions/search?has_docs=true&scratchCompatible=true
```

5. 按热度排序查询
```
GET /extensions/search?sort=popularity&order=desc
```

### 2. 扩展详情接口

#### 请求
```
GET /extensions/detail/:id
```

#### 路径参数
| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 扩展ID |

#### 查询参数
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `scope` | string | "public" | 查询范围：public/my/all |

#### 响应格式
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "扩展名称",
    "description": "扩展描述",
    "image": "https://example.com/image.webp",
    "status": "verified",
    "author": {
      "id": 123,
      "username": "username",
      "display_name": "显示名称",
      "avatar": "avatar_url",
      "profile_url": "https://example.com/username"
    },
    "project": {
      "id": 456,
      "name": "project_name",
      "title": "项目标题",
      "url": "https://example.com/username/project",
      "star_count": 10,
      "view_count": 100,
      "like_count": 5,
      "tags": ["tag1", "tag2"]
    },
    "has_docs": true,
    "docs_url": "https://docs.example.com",
    "has_samples": true,
    "sample_project": {
      "id": 789,
      "name": "sample_name",
      "title": "示例标题",
      "author": {
        "username": "sample_author",
        "display_name": "示例作者"
      },
      "url": "https://example.com/sample_author/sample"
    },
    "scratchCompatible": true,
    "branch": "main",
    "commit": "abc123",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-02T00:00:00.000Z"
  }
}
```

#### 示例请求

1. 查询公开扩展详情
```
GET /extensions/detail/123
```

2. 查询用户自己的扩展详情
```
GET /extensions/detail/123?scope=my
```

## 错误响应

### 401 未授权
```json
{
  "status": "error",
  "message": "需要登录才能查看自己的扩展"
}
```

### 404 未找到
```json
{
  "status": "error",
  "message": "扩展不存在或未通过审核"
}
```

### 500 服务器错误
```json
{
  "status": "error",
  "message": "搜索扩展时出错"
}
```

## 迁移指南

### 从原有API迁移

1. **替换 `/marketplace` → `/search?scope=public`**
   ```javascript
   // 原来
   fetch('/extensions/marketplace')
   
   // 现在  
   fetch('/extensions/search?scope=public')
   ```

2. **替换 `/manager/my` → `/search?scope=my`**
   ```javascript
   // 原来
   fetch('/extensions/manager/my')
   
   // 现在
   fetch('/extensions/search?scope=my')
   ```

3. **替换 `/marketplace/:id` → `/detail/:id?scope=public`**
   ```javascript
   // 原来
   fetch('/extensions/marketplace/123')
   
   // 现在
   fetch('/extensions/detail/123?scope=public')
   ```

4. **替换 `/manager/:id` → `/detail/:id?scope=my`**
   ```javascript
   // 原来
   fetch('/extensions/manager/123')
   
   // 现在  
   fetch('/extensions/detail/123?scope=my')
   ```

## 优势

1. **统一接口**: 一个接口支持多种查询场景
2. **灵活筛选**: 支持多维度筛选和排序
3. **权限控制**: 基于scope参数控制访问权限
4. **向前兼容**: 保持原有API继续可用
5. **扩展性**: 易于添加新的筛选条件和排序方式

## 注意事项

1. 查询自己的扩展（`scope=my`）需要用户登录
2. 查询所有扩展（`scope=all`）需要管理员权限
3. `status_filter` 参数仅在 `scope` 不是 "public" 时有效
4. 分页最大限制为100条记录
5. 搜索关键词会匹配标题、描述和项目名称