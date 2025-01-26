import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
var router = Router();
import fs from "fs";
import cryptojs from "crypto-js";
import { prisma } from "../utils/global.js";
import { needadmin } from "../middleware/auth.js";

router.get("/usertx", async function (req, res, next) {
  try {
    const USER = await prisma.ow_users.findFirst({
      where: {
        id: parseInt(req.query.id),
      },
      select: {
        images: true,
      },
    });
    if (!USER) {
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
      return;
    }
    res.redirect(
      302,
      (await configManager.getConfig("s3.staticurl")) +
        "/user/" +
        USER.images
    );
  } catch (err) {
    next(err);
  }
});

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

router.get("/info", async (req, res, next) => {
  try {
    const userCount = await prisma.ow_users.count();
    const scratchCount = await prisma.ow_projects.count();
    const pythonCount = await prisma.ow_projects.count();

    res.send({
      user: userCount,
      scratch: scratchCount,
      python: pythonCount,
      project: scratchCount + pythonCount,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/projectinfo", async function (req, res, next) {
  try {
    const project = await prisma.ow_projects.findFirst({
      where: {
        id: Number(req.query.id),
        OR: [{ state: "public" }, { authorid: res.locals.userid }],
      },
      select: {
        id: true,
        authorid: true,
        time: true,
        view_count: true,
        like_count: true,
        type: true,
        favo_count: true,
        title: true,
        state: true,
        description: true,
        license: true,
        tags: true,
        name: true,
      },
    });

    if (!project) {

      res.send({
        code: 404,
        status: "404",
        message: "项目不存在或未发布",
      });
      return;
    }

    const author = await prisma.ow_users.findFirst({
      where: { id: project.authorid },
      select: {
        display_name: true,
        images: true,
        motto: true,
      },
    });

    res.json({
      ...project,
      author_display_name: author.display_name,
      author_images: author.images,
      author_motto: author.motto,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/config", async function (req, res, next) {
  const result = await prisma.ow_config.findMany({
    where: { is_public: true },
    select: { key: true, value: true },
  });

  res.status(200).send(
    result.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {})
  );
});

router.get("/config/reload", needadmin, async function (req, res, next) {
  await configManager.loadConfigsFromDB();

  res.status(200).send({
    status: "success",
    message: "配置已重新加载",
  });
});
router.get("/config/:key", async function (req, res, next) {
  const result = await prisma.ow_config.findFirst({
    where: { is_public: true, key: req.params.key },
    select: { key: true, value: true },
  });

  if (!result) {
    res.status(404).send({
      status: "error",
      code: "404",
      message: "找不到配置项",
    });
    return;
  }
  res.status(200).send({
    [result.key]: result.value,
  });
});

router.get("/tuxiaochao", async function (req, res) {
  const userId = res.locals.userid;
  const displayName = res.locals.display_name;

  // 获取配置
  const txcid = await configManager.getConfig("feedback.txcid");
  const txckey = await configManager.getConfig("feedback.txckey");
  const staticUrl = await configManager.getConfig("s3.staticurl");

  // 判断登录状态和配置
  if (!res.locals.login || !txcid || !txckey) {
    res.redirect(txcid ? `https://support.qq.com/product/${txcid}` : "https://support.qq.com/product/597800");
    return;
  }

  try {
    // 查询用户信息
    const USER = await prisma.ow_users.findFirst({
      where: { id: userId },
      select: { images: true },
    });

    if (!USER) {
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
      return;
    }

    const userImage = USER.images;
    const txcinfo = `${userId}${displayName}${staticUrl}/user/${userImage}${txckey}`;
    const cryptostr = cryptojs.MD5(txcinfo).toString();

    // 构建重定向链接
    const redirectUrl = `https://support.qq.com/product/${txcid}?openid=${userId}&nickname=${displayName}&avatar=${staticUrl}/user/${userImage}&user_signature=${cryptostr}`;
    res.redirect(redirectUrl);

  } catch (error) {
    // 错误处理
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "服务器内部错误",
    });
  }
});
export default router;
