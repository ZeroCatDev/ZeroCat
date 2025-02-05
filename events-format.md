# 事件数据格式文档

## 基本结构

所有事件都遵循以下基本数据结构：

```typescript
interface Event {
  id: string;          // 事件ID
  type: string;        // 事件类型
  actor: {             // 事件执行者
    id: number;        // 用户ID
    username: string;  // 用户名
    display_name: string; // 显示名称
  };
  target: {           // 事件目标
    type: string;     // 目标类型
    id: number;       // 目标ID
    page: object;     // 目标详细信息
  };
  created_at: Date;   // 事件创建时间
  event_data: object; // 事件相关数据
  public: boolean;    // 是否公开
}
```

## 事件类型定义

### 项目相关事件

#### 1. project_create
```typescript
{
  type: "project_create",
  target: {
    type: "project",
    id: number,
    page: {
      name: string,
      title: string,
      project_type: string
    }
  }
}
```

#### 2. project_publish
```typescript
{
  type: "project_publish",
  target: {
    type: "project",
    id: number,
    page: {
      name: string,
      title: string,
      old_state: string,
      new_state: string
    }
  }
}
```

#### 3. project_fork
```typescript
{
  type: "project_fork",
  target: {
    type: "project",
    id: number,
    page: {
      name: string,
      title: string,
      fork_id: number
    }
  }
}
```

#### 4. project_update
```typescript
{
  type: "project_update",
  target: {
    type: "project",
    id: number,
    page: {
      name: string,
      title: string,
      update_type: string
    }
  }
}
```

#### 5. project_delete
```typescript
{
  type: "project_delete",
  target: {
    type: "project",
    id: number,
    page: {
      name: string,
      title: string
    }
  }
}
```

### 评论相关事件

#### comment_create
```typescript
{
  type: "comment_create",
  target: {
    type: string,      // 评论所在页面类型
    id: number,        // 评论所在页面ID
    page: {
      page_type: string,   // 页面类型
      page_id: number,     // 页面ID
      parent_id?: number,  // 父评论ID（可选）
      reply_id?: number,   // 回复评论ID（可选）
      comment_text: string // 评论内容（限100字）
    }
  }
}
```

### 用户相关事件

#### 1. user_register
```typescript
{
  type: "user_register",
  target: {
    type: "user",
    id: number,
    page: {
      username: string,
      display_name: string
    }
  }
}
```

#### 2. user_profile_update
```typescript
{
  type: "user_profile_update",
  target: {
    type: "user",
    id: number,
    page: {
      update_type: string,
      // 更新的字段...
    }
  }
}
```

#### 3. user_login
```typescript
{
  type: "user_login",
  target: {
    type: "user",
    id: number,
    page: {
      username: string
    }
  }
}
```

## 特殊字段说明

### target.page 对象

1. **通用字段**
   - `name`: 目标的名称
   - `title`: 目标的标题（如果有）
   - `state`: 目标的状态（如果适用）

2. **评论特有字段**
   - `page_type`: 评论所在的页面类型
   - `page_id`: 评论所在的页面ID
   - `parent_id`: 父评论ID
   - `reply_id`: 回复评论ID
   - `comment_text`: 评论内容（限100字）

### event_data 对象

event_data 包含事件的原始数据，可能包含：
- 更新前后的状态
- 操作的具体内容
- 其他元数据

## 数据库存储说明

1. **ID字段**
   - 所有ID在数据库中使用 BigInt 类型存储
   - API返回时转换为字符串

2. **时间字段**
   - 使用 ISO 格式存储
   - created_at 自动记录创建时间

3. **文本字段**
   - comment_text 限制为100字符
   - 其他文本字段遵循数据库字段限制

## 注意事项

1. **事件可见性**
   - public 字段决定事件是否公开可见
   - 某些事件类型默认不公开（如 user_login）
   - 项目相关事件的可见性通常跟随项目状态

2. **目标信息**
   - target.type 和 target.id 始终在顶层
   - 详细信息统一存放在 page 对象中
   - 评论事件的 target 指向评论所在的页面

3. **数据处理**
   - 处理事件时需检查必要字段存在性
   - 注意处理可能的空值情况
   - 评论内容需要截断处理

4. **安全性**
   - 敏感信息不应包含在事件数据中
   - 需要根据用户权限过滤事件可见性