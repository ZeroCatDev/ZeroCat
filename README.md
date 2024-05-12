# ZeroCat 编程社区

初中喵开发，求Star支持


ZeroCat 是一个轻量级的在线编程、分享平台

本仓库包含以下内容：
ZeroCat 社区的源代码，包括前端与后端

## 内容列表

- [ZeroCat 编程社区](#zerocat-编程社区)
  - [内容列表](#内容列表)
  - [背景](#背景)
  - [交流](#交流)
  - [示例](#示例)
  - [安装](#安装)
    - [配置数据库](#配置数据库)
    - [配置环境变量](#配置环境变量)
    - [运行](#运行)
    - [使用 Docker](#使用-docker)
  - [相关仓库](#相关仓库)
  - [开发者](#开发者)
  - [如何贡献](#如何贡献)
    - [贡献者](#贡献者)
  - [使用许可](#使用许可)

## 背景

`ZeroCat` 最开始由 [@sunwuyuan](https://github.com/sunwuyuan) 在秦氏工作室中提出，我们希望搭建一个全开源的编成社区，因此这个项目也就从这开始了。
<br/>维护一个编程社区从某种程度上来说相当不易，但我相信，这个项目会一直开发下去。

这个仓库的目标是：
<br/>开发一个完整的支持 Scratch、Python 与其他适合编程初学者的编成社区

## 交流
QQ：964979747

## 示例

想了解社区效果，请参考 [ZeroCat](https://ourworld.wuyuan.dev)。

## 安装

这个项目使用 [node](http://nodejs.org) , [npm](https://npmjs.com), [docker](https://docker.com)，请确保你本地已经安装了祂们

```sh
$ npm install
#或者使用cnpm
$ cnpm install
#或者使用任意奇奇怪怪的npm工具(笑
$ XXX install
```

### 配置数据库

还没写好

### 配置环境变量

将`.env.example`修改为`.env`或手动配置环境变量(根据`.env.example`配置)
<br/>请务必不要同时使用环境变量与.env，请注意不要让项目与其他项目冲突
<br/>目前所有环境变量都必须配置

### 运行

```sh
$ npm start
#或者(不建议)
$ node app
```

### 使用 Docker

请确保以安装 Docker 与 DockerCompose

```sh
$ docker compose up -d
```

## 相关仓库

- [StaticFile](https://github.com/ZeroCatOrg/StaticFile) — 静态文件仓库

## 开发者

[@SunWuyuan](https://github.com/sunwuyuan)

## 如何贡献

非常欢迎你的加入！[提一个 Issue](https://github.com/RichardLitt/standard-readme/issues/new) 或者提交一个 Pull Request。

ZeroCat 的项目 遵循 [Contributor Covenant](http://contributor-covenant.org/version/1/3/0/) 行为规范
<br/>孙悟元 希望你遵循 [提问的智慧](https://github.com/ryanhanwu/How-To-Ask-Questions-The-Smart-Way/blob/main/README-zh_CN.md)

### 贡献者

感谢所有参与项目的人，他们的信息可以在右侧看到，这是实时的且便于查看

## 使用许可

[GPL](LICENSE) © 2020-2023 孙悟元 https://wuyuan.dev

您可以在开源的前提下免费使用 ZeroCat 社区，您不可以使用 ZeroCat 社区的名称进行宣传，您需要保留 ZeroCat 的声明
<br/>需要闭源的使用授权请联系 QQ1847261658

原项目：https://gitee.com/scratch-cn/lite


![社区(Github图床)](https://github.com/ZeroCatDev/ZeroCat/assets/88357633/d6f4a6ba-daa1-45c8-88f7-4b20d9edbb22)

<br/>原项目声明了MIT协议
