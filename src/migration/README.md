# 项目结构迁移指南

本文档提供了将项目从旧结构迁移到新结构的指南和最佳实践。

## 目录

- [概述](#概述)
- [迁移步骤](#迁移步骤)
- [迁移工具](#迁移工具)
- [测试策略](#测试策略)
- [迁移检查清单](#迁移检查清单)

## 概述

项目正在从旧的非结构化代码库迁移到新的标准化结构。新结构遵循现代Node.js/Express应用程序的最佳实践，采用清晰的分层架构：

```
src/
├── config/                # 应用配置
├── controllers/           # 控制器逻辑
├── middleware/            # 自定义中间件
├── models/                # 数据模型和验证
├── routes/                # 路由定义
├── services/              # 业务服务
└── utils/                 # 工具函数
```

## 迁移步骤

### 1. 准备工作

- 创建相应的目录结构
- 确保了解旧代码的功能和依赖关系
- 在开始迁移前创建分支

### 2. 模型迁移

1. 为每个实体创建一个模型文件 (`src/models/<实体名>.model.js`)
2. 使用Zod定义验证模式
3. 添加相关的枚举和常量
4. 导出所有模型和验证模式

示例:
```javascript
// src/models/user.model.js
import { z } from 'zod';

export const UserTypes = {
  REGULAR: 'regular',
  ADMIN: 'admin'
};

export const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  // ...其他字段
});
```

### 3. 服务迁移

1. 为每个实体创建一个服务文件 (`src/services/<实体名>.service.js`)
2. 从旧控制器中提取业务逻辑并移至服务层
3. 使用标准化的错误处理和日志记录
4. 确保服务函数返回一致的数据结构

示例:
```javascript
// src/services/user.service.js
import { prisma } from "../../utils/global.js";
import logger from "../../utils/logger.js";

export async function getUserById(userId) {
  try {
    const user = await prisma.ow_users.findUnique({
      where: { id: Number(userId) }
    });
    return user;
  } catch (error) {
    logger.error(`获取用户信息出错: ${error.message}`);
    throw error;
  }
}
```

### 4. 控制器迁移

1. 为每个实体创建一个控制器文件 (`src/controllers/<实体名>.controller.js`)
2. 控制器只负责处理HTTP请求和响应
3. 使用服务层进行业务逻辑处理
4. 确保一致的错误处理和响应格式

示例:
```javascript
// src/controllers/user.controller.js
import * as userService from '../services/user.service.js';
import logger from '../../utils/logger.js';

export async function getUserInfo(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'not_found',
        message: '未找到用户'
      });
    }

    res.json({
      status: 'success',
      data: user
    });
  } catch (error) {
    next(error);
  }
}
```

### 5. 路由迁移

1. 为每个实体创建一个路由文件 (`src/routes/<实体名>.routes.js`)
2. 定义路由并连接到控制器
3. 添加必要的中间件（身份验证、验证等）
4. 在路由索引中注册路由

示例:
```javascript
// src/routes/user.routes.js
import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/:userId', userController.getUserInfo);
router.patch('/:userId', authMiddleware, userController.updateUserInfo);

export default router;
```

### 6. 更新路由索引

在 `src/routes/index.js` 中注册新路由:

```javascript
import userRoutes from './user.routes.js';

export async function configureRoutes(app) {
  // 注册新的标准化路由
  app.use("/users", userRoutes);

  // 保留旧路由，以保持URL兼容性
  const userModule = await import('../../routes/router_user.js');
  app.use("/user", userModule.default);
}
```

### 7. 测试和验证

1. 针对迁移的功能编写单元测试
2. 执行API集成测试
3. 验证旧路由仍能正常工作
4. 验证新路由是否按预期工作

## 迁移工具

可以使用以下工具辅助迁移过程:

- **VSCode 重构工具**: 用于重命名和提取函数
- **ESLint**: 确保代码符合风格指南
- **Jest**: 用于单元测试和集成测试
- **Postman**: 用于API测试

## 测试策略

1. **单元测试**:
   - 为每个服务函数编写测试
   - 为控制器中的关键逻辑编写测试
   - 模拟数据库和其他依赖项

2. **集成测试**:
   - 测试完整的API流程
   - 验证请求/响应格式
   - 测试错误处理

3. **手动测试**:
   - 使用Postman测试关键API端点
   - 验证响应格式和状态码

## 迁移检查清单

确保迁移的代码满足以下要求:

- [ ] 所有业务逻辑都在服务层
- [ ] 控制器只处理HTTP请求和响应
- [ ] 一致的错误处理
- [ ] 适当的日志记录
- [ ] 合适的文档注释
- [ ] 通过测试
- [ ] 旧接口仍然可用

**注意**: 数据验证可以使用简单的手动验证或Zod等库进行，视项目需求而定。

## 已完成的迁移

### 事件模块

已完成事件模块的迁移，具体包括：

1. **模型**：创建 `src/models/event.model.js`，定义事件类型和配置。
2. **服务**：创建 `src/services/event.service.js`，实现事件的核心业务逻辑。
3. **控制器**：创建 `src/controllers/event.controller.js`，处理HTTP请求和响应。
4. **路由**：创建 `src/routes/event.routes.js`，定义API端点。

迁移中的主要改进：
- 代码结构更加清晰，关注点分离
- 添加了更详细的文档注释
- 保持向后兼容性
- 改进了错误处理

## 常见问题

**Q: 如何处理旧代码中的全局变量?**
A: 将它们迁移到配置模块或适当的服务中。

**Q: 如何处理旧代码中的混合函数?**
A: 将它们拆分为控制器逻辑和服务逻辑，遵循单一责任原则。

**Q: 如何确保向后兼容性?**
A: 保留旧路由，同时添加新路由。使用服务层共享业务逻辑。