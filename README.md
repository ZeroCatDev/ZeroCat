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


[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat-backend.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat-backend?ref=badge_large)

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
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat-backend.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FZeroCatDev%2Fzerocat-backend?ref=badge_shield)

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
We warmly welcome your contributions! Please [submit an Issue](https://github.com/ZeroCatDev/ZeroCat/issues/new) or submit a Pull Request. For beginner-level questions, it’s best to ask in the QQ group, and we will try to help.

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

Thanks to the [scratch-cn/lite](https://gitee.com/scratch-cn/lite) project for inspiring this project, which is licensed under the MIT License.