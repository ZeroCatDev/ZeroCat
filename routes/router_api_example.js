import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
import { prisma } from "../utils/global.js";
import { needlogin, strictTokenCheck, needadmin } from "../middleware/auth.js";

const router = Router();

// 使用基本登录验证的路由
router.get("/user-info", needlogin, async function (req, res, next) {
  try {
    const user = await prisma.ow_users.findUnique({
      where: { id: res.locals.userid },
      select: {
        id: true,
        username: true,
        display_name: true,
        images: true,
        created_at: true,
      }
    });

    res.status(200).json({
      status: "success",
      data: user
    });
  } catch (err) {
    next(err);
  }
});

// 使用严格token验证的路由（敏感操作）
router.post("/change-password", strictTokenCheck, needlogin, async function (req, res, next) {
  try {
    // 处理密码更改逻辑
    res.status(200).json({
      status: "success",
      message: "密码已更改"
    });
  } catch (err) {
    next(err);
  }
});

// 需要管理员权限的路由
router.post("/admin/update-config", strictTokenCheck, needadmin, async function (req, res, next) {
  try {
    // 处理配置更新逻辑
    res.status(200).json({
      status: "success",
      message: "配置已更新"
    });
  } catch (err) {
    next(err);
  }
});

// 公共路由，不需要登录验证
router.get("/public-info", async function (req, res, next) {
  try {
    const info = {
      version: "1.0.0",
      serverTime: new Date().toISOString()
    };

    res.status(200).json({
      status: "success",
      data: info
    });
  } catch (err) {
    next(err);
  }
});

export default router;