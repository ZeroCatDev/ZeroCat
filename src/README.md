# 项目结构说明

本项目采用标准的Node.js/Express应用程序架构，遵循以下目录结构和命名约定：

## 目录结构

```
src/
├── config/                # 应用配置
│   ├── app/               # 应用级配置
│   │   └── server.js      # 服务器配置
│   ├── constants/         # 常量定义
│   │   └── paths.js       # 路径常量
│   ├── middleware.js      # 中间件配置
│   ├── default_project.js # 默认项目配置
│   └── index.js           # 配置索引
├── controllers/           # 控制器逻辑
│   ├── auth/              # 认证相关控制器
│   └── ...                # 其他控制器
├── middleware/            # 自定义中间件
│   ├── auth.js            # 认证中间件
│   └── ...                # 其他中间件
├── routes/                # 路由定义
│   ├── index.js           # 路由主入口
│   ├── account.routes.js  # 账户相关路由
│   └── ...                # 其他路由
└── utils/                 # 工具函数
    └── ...                # 各种工具函数
```

## 命名约定

- **路由文件**: `[功能].routes.js`
  - 例如: `account.routes.js`, `project.routes.js`

- **控制器文件**: `[功能].controller.js`
  - 例如: `auth.controller.js`, `user.controller.js`

- **中间件文件**: `[功能].middleware.js`
  - 例如: `auth.middleware.js`, `validator.middleware.js`

- **服务文件**: `[功能].service.js`
  - 例如: `email.service.js`, `storage.service.js`

- **工具文件**: `[功能].util.js`
  - 例如: `date.util.js`, `string.util.js`

- **配置文件**: 按领域分组
  - `app/server.js`: 服务器配置
  - `constants/paths.js`: 路径常量

## 最佳实践

1. **关注点分离**: 保持路由、控制器和服务的职责单一清晰
2. **模块化**: 相关功能应该分组在同一目录下
3. **一致性**: 遵循相同的命名和结构约定
4. **可扩展性**: 设计应便于添加新功能而无需大规模重构
5. **配置集中**: 所有配置通过src/config/index.js统一导出

## 迁移说明

项目正在从旧结构迁移到新结构。在迁移过程中，可能会同时存在旧的和新的文件结构。最终目标是将所有功能模块迁移到标准化的结构中。