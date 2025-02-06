import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
var router = Router();
import { prisma } from "../utils/global.js";
import { needlogin } from "../middleware/auth.js";
import { createEvent } from "../controllers/events.js";


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
router.post("/batch/:type", async function (req, res, next) {
  try {
    if (req.params.type !== "id" && req.params.type !== "name") {
      return res
        .status(400)
        .send({ status: "error", message: "无效的查询类型" });
    }

    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res
        .status(400)
        .send({ status: "error", message: "无效的用户ID数组" });
    }

    const queryField = req.params.type === "id" ? "id" : "username";
    const usersinfo = await prisma.ow_users.findMany({
      where: {
        [queryField]: { in: users.map(id => req.params.type === "id" ? parseInt(id) : id) },
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
      data: usersinfo,
    });
  } catch (err) {
    next(err);
  }
});
// 获取用户自身信息
router.get("/me", needlogin,async function (req, res, next) {
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

// 在用户资料更新时记录事件
router.post("/profile/update", needlogin, async (req, res) => {
  try {
    const userId = res.locals.userid;
    const oldUser = await prisma.ow_users.findUnique({
      where: { id: userId }
    });

    // ... 现有的更新代码 ...

    // 记录用户资料更新事件
    if (req.body.display_name !== oldUser.display_name) {
      await createEvent('user_profile_update', userId, 'user', userId, {
        update_type: 'display_name',
        old_value: oldUser.display_name,
        new_value: req.body.display_name
      });
    }

    if (req.body.motto !== oldUser.motto) {
      await createEvent('user_profile_update', userId, 'user', userId, {
        update_type: 'motto',
        old_value: oldUser.motto,
        new_value: req.body.motto
      });
    }

    // ... 其余代码 ...
  } catch (error) {
    // ... 错误处理 ...
  }
});

// 在用户注册时记录事件
router.post("/register", async (req, res) => {
  try {
    // ... 现有的注册代码 ...
    const user = await prisma.ow_users.create({
      data: userData
    });

    // 记录注册事件
    await createEvent('user_register', user.id, 'user', user.id, {
      username: user.username
    });

    // ... 其余代码 ...
  } catch (error) {
    // ... 错误处理 ...
  }
});

export default router;
