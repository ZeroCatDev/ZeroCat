import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
var router = Router();
import fs from "fs";
import cryptojs from "crypto-js";
import { prisma } from "../utils/global.js";
import { needadmin } from "../middleware/auth.js";

router.get("/getuserinfo", async function (req, res, next) {
  try {
    var user = await prisma.ow_users.findMany({
      where: {
        id: parseInt(req.query.id),
      },
      select: {
        id: true,
        display_name: true,
        motto: true,
        images: true,
        regTime: true,
        sex: true,
        username: true,
      },
    });

    var scratchcount = await prisma.ow_projects.count({
      where: {
        type: "scratch",
        state: "public",
      },
    });
    var pythoncount = await prisma.ow_projects.count({
      where: {
        type: "python",
        state: "public",
      },
    });
    if (!user[0]) {
      logger.debug("用户不存在");
      res.locals.tip = { opt: "flash", message: "用户不存在" };
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
    }
    res.send({
      status: "success",
      info: { user: user[0], count: { pythoncount, scratchcount } },
    });
  } catch (err) {
    next(err);
  }
});

// 根据用户名获取用户信息
router.get("/username/:username", async function (req, res, next) {
  try {
    var user = await prisma.ow_users.findMany({
      where: {
        username: req.params.username,
      },
      select: {
        id: true,
        display_name: true,
        motto: true,
        images: true,
        regTime: true,
        sex: true,
        username: true,
      },
    });

    if (!user[0]) {
      logger.debug("用户不存在");
      res.locals.tip = { opt: "flash", message: "用户不存在" };
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
    } else {
      res.send({
        status: "success",
        info: user[0],
      });
    }
  } catch (err) {
    next(err);
  }
});

// 根据用户ID获取用户信息
router.get("/id/:id", async function (req, res, next) {
  try {
    var user = await prisma.ow_users.findMany({
      where: {
        id: parseInt(req.params.id),
      },
      select: {
        id: true,
        display_name: true,
        motto: true,
        images: true,
        regTime: true,
        sex: true,
        username: true,
      },
    });

    if (!user[0]) {
      logger.debug("用户不存在");
      res.locals.tip = { opt: "flash", message: "用户不存在" };
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
    } else {
      res.send({
        status: "success",
        info: user[0],
      });
    }
  } catch (err) {
    next(err);
  }
});

// 批量查询用户信息
router.post("/batch", async function (req, res, next) {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .send({ status: "error", message: "无效的用户ID数组" });
    }

    const users = await prisma.ow_users.findMany({
      where: {
        id: { in: userIds.map(id => parseInt(id)) },
      },
      select: {
        id: true,
        display_name: true,
        motto: true,
        images: true,
        regTime: true,
        sex: true,
        username: true,
      },
    });

    res.send({
      status: "success",
      data: users,
    });
  } catch (err) {
    next(err);
  }
});

// 获取用户自身信息
router.get("/me", async function (req, res, next) {
  if (!res.locals.userid) {
    return res.status(200).send({
      status: "error",
      message: "未登录",
      code: "AUTH_ERROR_LOGIN",
    });
  }

  try {
    const user = await prisma.ow_users.findFirst({
      where: { id: res.locals.userid },
      select: {
        id: true,
        display_name: true,
        motto: true,
        images: true,
        regTime: true,
        sex: true,
        username: true,
      },
    });

    if (!user) {
      logger.debug("用户不存在");
      return res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
    }

    res.send({
      status: "success",
      info: user,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
