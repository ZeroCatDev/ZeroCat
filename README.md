# ZeroCat 编程社区

高中喵开发，求 Star 支持

##
ZeroCat 是一个轻量级的在线编程、分享平台

本仓库是 ZeroCat 的后端代码

## 内容列表

- [ZeroCat 编程社区](#zerocat-编程社区)
  - [](#)
  - [内容列表](#内容列表)
  - [前端一键部署](#前端一键部署)
  - [背景](#背景)
  - [交流](#交流)
  - [示例](#示例)
  - [安装](#安装)
    - [配置数据库](#配置数据库)
    - [配置环境变量](#配置环境变量)
    - [运行](#运行)
    - [使用 Docker](#使用-docker)
  - [开发者](#开发者)
  - [](#-1)
  - [如何贡献](#如何贡献)
  - [](#-2)
    - [贡献者](#贡献者)
  - [许可协议](#许可协议)
- [感谢](#感谢)

## 前端一键部署
[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https://github.com/ZeroCatDev/zerocat-frontend&repository-name=ZeroCat&env=VITE_APP_BASE_API&env-description=后端API地址)


## 背景

`ZeroCat` 最开始由 [@sunwuyuan](https://github.com/sunwuyuan) 在很早以前提出，我们希望搭建一个全开源的编程社区，这个项目也就从此开始了。但实际上项目在孙悟元初二的时候才有了很大进展。
<br/>维护一个编程社区从某种程度上来说相当不易，但我相信，这个项目会一直开发下去。

这个仓库的目标是：
<br/>开发一个完整的支持 Scratch、Python 与其他适合编程初学者的编成社区

## 交流

QQ：964979747

## 示例

想了解社区效果，请参考 [ZeroCat](https://zerocat.houlangs.com)。

## 安装
![使用Nodejs开发](public/Node.js.png)

这个项目使用 [node](http://nodejs.org) , [npm](https://npmjs.com), [docker](https://docker.com)，请确保你本地已经安装了祂们

```sh
$ npm install
# 或者使用cnpm
$ cnpm install
# 或者使用任意奇奇怪怪的npm工具(笑
$ XXX install
```

### 配置数据库

还没写好

### 配置环境变量

将`.env.example`修改为`.env`或手动配置环境变量(根据`.env.example`配置)
<br/>请务必不要同时使用环境变量与.env，请注意不要让项目环境与其他项目环境冲突
<br/>目前所有环境变量都必须配置

### 运行

```sh
$ npm run start
```

### 使用 Docker

请确保以安装 Docker 与 DockerCompose

```sh
$ docker compose up -d
```

## 开发者

[@SunWuyuan](https://github.com/sunwuyuan)

##
## 如何贡献

- [ZeroCat](https://zerocat.houlangs.com)
非常欢迎你的加入！[提一个 Issue](https://github.com/ZeroCatDev/ZeroCat/issues/new) 或者提交一个 Pull Request。对于小白问题，最好在 qq 群里问，我们会尽量回答。

##
ZeroCat 的项目 遵循 [Contributor Covenant](http://contributor-covenant.org/version/1/3/0/) 行为规范
<br/>孙悟元 希望你遵循 [提问的智慧](https://github.com/ryanhanwu/How-To-Ask-Questions-The-Smart-Way/blob/main/README-zh_CN.md)

### 贡献者

感谢所有参与项目的人，他们的信息可以在右侧看到，这是实时的且便于查看
## 许可协议

ZeroCat 社区项目遵循 [AGPL-3.0 许可证](LICENSE)。


版权所有 (C) 2020-2024 孙悟元。
Copyright (C) 2020-2024  Sun Wuyuan.


您可以在开源的前提下免费使用 ZeroCat 社区，但不允许使用 ZeroCat 的名称进行宣传。您需要保留 ZeroCat 的版权声明。

如需闭源使用授权，请联系 QQ1847261658。

感谢 [scratch-cn/lite](https://gitee.com/scratch-cn/lite) 项目对本项目的启发。

# 感谢

本项目 CDN 加速及安全防护由 Tencent EdgeOne 赞助
[立即访问 EdgeOne](https://edgeone.ai/zh?from=github)

[![EdgeOne](./public/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png)](https://edgeone.ai/zh?from=github)
