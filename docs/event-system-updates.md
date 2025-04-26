# 事件系统更新文档

## 事件创建格式变更

事件系统已更新，现在所有事件创建时需要在事件数据中包含基本的事件元数据字段。这确保了事件数据的一致性并满足了 schema 验证的要求。

### 旧格式示例

```javascript
await createEvent("project_create", userId, "project", projectId, {
  project_name: "my-project",
  project_title: "My Project",
  // 其他事件特定字段...
});
```

### 新格式示例

```javascript
await createEvent("project_create", userId, "project", projectId, {
  // 必须包含这些基本字段
  event_type: "project_create",
  actor_id: userId,
  target_type: "project",
  target_id: projectId,

  // 事件特定字段
  project_name: "my-project",
  project_title: "My Project",
  // 其他事件特定字段...
});
```

## 更新说明

1. 每个事件数据对象现在必须包含以下基本字段：
   - `event_type`: 事件类型，与第一个参数保持一致
   - `actor_id`: 执行操作的用户ID，与第二个参数保持一致
   - `target_type`: 目标类型，与第三个参数保持一致
   - `target_id`: 目标ID，与第四个参数保持一致

2. 所有事件类型字符串必须使用小写格式（如 `user_login` 而非 `USER_LOGIN`）

3. 请参考 `docs/event-formats.json` 文件了解每种事件类型所需的特定字段

## 迁移指南

当更新现有代码时，请确保：

1. 将所有 `EventTypes.常量` 形式替换为对应的小写字符串格式
   - 例如：`EventTypes.USER_LOGIN` 更新为 `"user_login"`

2. 在事件数据对象中添加基本元数据字段：
   ```javascript
   {
     event_type: eventType,
     actor_id: actorId,
     target_type: targetType,
     target_id: targetId,
     // 事件特定字段...
   }
   ```

3. 继续使用第五个参数 `forcePrivate` 来控制事件的可见性（如果需要）

## 注意事项

- 事件数据在保存前会使用 `models/events.js` 中定义的 schema 进行验证
- 不符合对应事件类型 schema 的数据将导致事件创建失败
- 请查看 `services/eventService.js` 中的 `createEvent` 函数了解完整的事件创建流程