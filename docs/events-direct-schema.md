# 直接存储事件数据的新架构

## 概述

我们对事件系统进行了重构，移除了旧的 `dbFields` 字段过滤方法，改为使用 Zod 验证模式和直接存储整个事件数据结构的方法。这种新方法简化了代码，提高了可维护性，并且增强了类型安全性。

## 重大变更

1. 移除了 `EventTypes` 中的 `dbFields` 数组
2. 使用 Zod 验证模式直接验证完整事件数据
3. 将整个验证通过的事件数据存储在数据库中
4. 为支持旧版代码提供了向后兼容层

## 新事件系统的工作方式

### 1. 定义事件模式

每个事件类型都使用 Zod 模式定义：

```javascript
// models/events.js
export const ProjectCommitEventSchema = BaseEventSchema.extend({
  commit_id: z.string(),
  commit_message: z.string(),
  branch: z.string(),
  // 其他字段...
});
```

### 2. 事件配置

每个事件类型的配置包含验证模式和其他元数据：

```javascript
export const EventConfig = {
  'project_commit': {
    schema: ProjectCommitEventSchema,
    logToDatabase: true,
    public: true,
    notifyTargets: ['project_owner', 'project_followers'],
  },
  // 其他事件类型...
};
```

### 3. 创建事件

创建事件时，所有数据都会通过验证模式进行验证：

```javascript
// 创建事件
await createEvent(
  'project_create',  // 事件类型
  userId,           // 操作者ID
  'project',        // 目标类型
  projectId,        // 目标ID
  {
    project_type: 'scratch',
    project_name: 'my-project',
    project_title: '我的项目',
    project_description: '项目描述',
    project_state: 'private'
  }
);
```

### 4. 数据验证和存储

1. 事件数据通过 Zod 模式验证
2. 验证通过的完整数据直接存储到数据库
3. 不再需要提取特定字段

```javascript
// 验证数据
const validationResult = eventConfig.schema.safeParse(eventData);

// 如果验证通过，存储完整数据
const event = await prisma.events.create({
  data: {
    event_type: normalizedEventType,
    actor_id: BigInt(validatedData.actor_id),
    target_type: validatedData.target_type,
    target_id: BigInt(validatedData.target_id),
    event_data: validatedData, // 存储完整的验证后数据
    public: isPublic ? 1 : 0
  },
});
```

## 兼容旧版代码

为确保与使用旧版 `EventTypes` 对象的代码兼容，我们提供了向后兼容层：

```javascript
// 旧版 EventTypes 常量兼容层
export const EventTypes = {
  // 映射旧版结构到新版
  'project_commit': 'project_commit',
  'project_update': 'project_update',
  // ...其他映射

  // 常用的事件类型常量（大写格式）
  PROJECT_CREATE: 'project_create',
  PROJECT_DELETE: 'project_delete',
  // ...其他常量

  // 获取事件配置的辅助方法
  get(eventType) {
    const type = typeof eventType === 'string' ? eventType : String(eventType);
    return EventConfig[type.toLowerCase()];
  }
};
```

## 升级指南

### 1. 直接使用事件类型字符串

```javascript
// 旧代码
await createEvent(
  EventTypes.PROJECT_CREATE,
  userId,
  "project",
  projectId,
  // ...
);

// 新代码 - 使用字符串
await createEvent(
  'project_create',
  userId,
  "project",
  projectId,
  // ...
);
```

### 2. 不再需要考虑 dbFields

旧代码:
```javascript
// 旧系统 - 需要提供 dbFields 中定义的所有字段
const eventData = {
  project_type: project.type,   // 在 dbFields 中
  project_name: project.name,   // 在 dbFields 中
  // ...其他必需字段
};
```

新代码:
```javascript
// 新系统 - 提供所有相关数据，由 Zod 验证确保正确性
const eventData = {
  // 根据事件类型提供所有相关数据
  project_type: project.type,
  project_name: project.name,
  project_title: project.title,
  // ...其他数据
};
```

### 3. 验证错误处理

如果事件数据不符合定义的模式，系统会拒绝创建事件并记录错误：

```javascript
// 错误数据将被验证拒绝
const invalidData = { /* 缺少必需字段 */ };
const result = await createEvent('project_create', userId, 'project', projectId, invalidData);
// result 将为 null，错误会被记录
```

## 迁移注意事项

1. 检查所有使用 `EventTypes.XXX` 形式常量的代码
2. 考虑直接使用字符串形式的事件类型
3. 确保提供事件所需的所有数据字段
4. 使用 Zod 验证模式中定义的类型作为指导

## 总结

新的事件系统移除了不必要的 `dbFields` 过滤步骤，使用 Zod 验证模式直接验证和存储完整事件数据。这种方式更加简洁、类型安全，并且保持了向后兼容性。