# ZeroCat Programming Community
[中文](./README_ZH.md) | [English](./README.md)

If you like this project, please give me a star.
##
ZeroCat is a lightweight online programming and sharing platform.

This repository contains the backend code for ZeroCat.

## Contents

- [ZeroCat Programming Community](#zerocat-programming-community)
  - [](#)
  - [Contents](#contents)
  - [Background](#background)
  - [Communication](#communication)
  - [Example](#example)
  - [Installation](#installation)
    - [Configure Database](#configure-database)
    - [Configure Environment Variables](#configure-environment-variables)
    - [Run](#run)
    - [Use Docker](#use-docker)
  - [Developer](#developer)
  - [How to Contribute](#how-to-contribute)
  - [Contributor Covenant Code of Conduct](#contributor-covenant-code-of-conduct)
    - [Contributors](#contributors)
  - [License](#license)
  - [项目结构](#项目结构)


[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat?ref=badge_large)

## Background

`ZeroCat` was originally proposed by [@sunwuyuan](https://github.com/sunwuyuan) a long time ago. Our goal is to create a fully open-source programming community, and this project started from that vision. However, significant progress was made only when Sun Wuyuan was in the second year of middle school.

Maintaining a programming community is, to some extent, quite challenging, but I believe this project will continue to develop.

The goal of this repository is to:
<br/>Develop a comprehensive programming community that supports Scratch, Python, and other languages suitable for beginner programmers.

## Communication

QQ: 964979747

## Example

To see the community in action, please refer to [ZeroCat](https://zerocat.houlangs.com).

## Installation
![Developed with Node.js](public/Node.js.png)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat?ref=badge_shield)

This project uses [Node.js](http://nodejs.org), [npm](https://npmjs.com), and [Docker](https://docker.com). Please ensure that these are installed on your local machine.

```sh
$ npm install
# Or use cnpm
$ cnpm install
# Or use any other npm tool you prefer (haha)
$ XXX install
```

### Configure Database

Not written yet.

### Configure Environment Variables

Rename `.env.example` to `.env` or configure the environment variables manually (refer to `.env.example` for guidance).
<br/>Please do not use both environment variables and `.env` at the same time, and ensure the project's environment does not conflict with other projects.
<br/>Currently, all environment variables must be configured.

### Run

```sh
$ npm run start
```

### Use Docker

Make sure Docker and Docker Compose are installed.

```sh
$ docker compose up -d
```

## Developer

[@SunWuyuan](https://github.com/sunwuyuan)

## How to Contribute

- [ZeroCat](https://zerocat.houlangs.com)
We warmly welcome your contributions! Please [submit an Issue](https://github.com/ZeroCatDev/ZeroCat/issues/new) or submit a Pull Request. For beginner-level questions, it's best to ask in the QQ group, and we will try to help.

## Contributor Covenant Code of Conduct

The ZeroCat project follows the [Contributor Covenant](http://contributor-covenant.org/version/1/3/0/) Code of Conduct.
<br/>Sun Wuyuan encourages you to follow [The Smart Way to Ask Questions](https://github.com/ryanhanwu/How-To-Ask-Questions-The-Smart-Way/blob/main/README-zh_CN.md).

### Contributors

Thanks to everyone who has contributed to this project. Their information can be found on the right side of the repository page. It is updated in real time and easy to view.

## License

The ZeroCat community project is licensed under the [GPL-3.0 License](LICENSE).

Copyright (C) 2020-2024 Sun Wuyuan.

You are free to use the ZeroCat community under an open-source license, but you may not use the name "ZeroCat" for promotional purposes. You must retain the copyright notice for ZeroCat.

For closed-source usage licenses, please contact QQ 1847261658.

Thanks to the [scratch-cn/lite](https://gitee.com/scratch-cn/lite) project for inspiring this project.

## 项目结构

项目采用标准的Node.js/Express应用程序架构，遵循以下目录结构和命名约定：

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
│   ├── event.controller.js # 事件控制器
│   └── ...                # 其他控制器
├── middleware/            # 自定义中间件
│   ├── auth.middleware.js # 认证中间件
│   └── ...                # 其他中间件
├── models/                # 数据模型和验证
│   ├── events.model.js    # 事件模型
│   └── ...                # 其他模型
├── routes/                # 路由定义
│   ├── index.js           # 路由主入口
│   ├── account.routes.js  # 账户相关路由
│   ├── event.routes.js    # 事件相关路由
│   └── ...                # 其他路由
├── services/              # 业务服务
│   ├── eventService.js    # 事件服务
│   ├── scheduler.service.js # 调度器服务
│   └── ...                # 其他服务
└── utils/                 # 工具函数
    └── ...                # 各种工具函数
```

### 命名约定

- **路由文件**: `[功能].routes.js`
  - 例如: `account.routes.js`, `event.routes.js`

- **控制器文件**: `[功能].controller.js`
  - 例如: `auth.controller.js`, `event.controller.js`

- **中间件文件**: `[功能].middleware.js`
  - 例如: `auth.middleware.js`, `validator.middleware.js`

- **服务文件**: `[功能].service.js`
  - 例如: `scheduler.service.js`, `errorHandler.service.js`

- **模型文件**: `[功能].model.js`
  - 例如: `events.model.js`, `user.model.js`

### 最佳实践

1. **关注点分离**: 保持路由、控制器和服务的职责单一清晰
2. **模块化**: 相关功能应该分组在同一目录下
3. **一致性**: 遵循相同的命名和结构约定
4. **可扩展性**: 设计应便于添加新功能而无需大规模重构
5. **配置集中**: 所有配置通过src/config/index.js统一导出

### 迁移进展

项目正在从旧结构迁移到新结构。下面是当前的迁移进度：

✅ 完成
- 事件模块 (events)
- 用户模块 (users)
- 通知模块 (notifications)
- 核心服务 (scheduler, errorHandler)
- 身份验证中间件 (auth)

⏳ 进行中
- 关注模块 (follows)
- 项目模块 (projects)
- 评论模块 (comments)

⌛ 待完成
- 搜索模块 (search)
- 时间线模块 (timeline)
- 点赞模块 (likes)
- 收藏模块 (stars)
- 列表模块 (lists)