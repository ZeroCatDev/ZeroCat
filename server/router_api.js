const logger = require("./lib/logger.js");
const configManager = require("./configManager");

var express = require("express");
var router = express.Router();
var fs = require("fs");

var I = require("./lib/global.js");
var DB = require("./lib/database.js");
var { needadmin } = require("./middleware/auth.js");
router.get("/usertx", async function (req, res, next) {
  try {
    SQL = `SELECT images FROM ow_users WHERE id = ${req.query.id};`;
    DB.query(SQL, async function (err, USER) {
      if (err || USER.length == 0) {
        res.locals.tip = { opt: "flash", msg: "用户不存在" };
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
          USER[0].images
      );
    });
  } catch (err) {
    next(err);
  }
});

router.get("/getuserinfo", async function (req, res, next) {
  try {
    user = await I.prisma.ow_users.findMany({
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

    scratchcount = await I.prisma.ow_projects.count({
      where: {
        type: "scratch",
        state: "public",
      },
    });
    pythoncount = await I.prisma.ow_projects.count({
      where: {
        type: "python",
        state: "public",
      },
    });
    if (!user[0]) {
      logger.debug("用户不存在");
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
      res.status(404).json({
        status: "error",
        code: "404",
        message: "找不到页面",
      });
    }
    res.send({
      status: "ok",
      info: { user: user[0], count: { pythoncount, scratchcount } },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/info", async (req, res, next) => {
  try {
    const userCount = await I.prisma.ow_users.count();
    const scratchCount = await I.prisma.ow_projects.count();
    const pythonCount = await I.prisma.ow_projects.count();

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
    SQL =
      `SELECT ow_projects.id,ow_projects.authorid,ow_projects.time,ow_projects.view_count,ow_projects.like_count,ow_projects.type,` +
      ` ow_projects.favo_count,ow_projects.title,ow_projects.state,ow_projects.description,ow_projects.licence,ow_projects.tags,` +
      ` '' AS likeid, '' AS favoid,` +
      ` ow_users.display_name AS author_display_name,` +
      ` ow_users.images AS author_images,` +
      ` ow_users.motto AS author_motto` +
      ` FROM ow_projects ` +
      ` LEFT JOIN ow_users ON (ow_users.id=ow_projects.authorid) ` +
      ` WHERE ow_projects.id=${req.query.id} AND (ow_projects.state='public' or ow_projects.authorid=${res.locals.userid}) LIMIT 1`;
    DB.query(SQL, function (err, SCRATCH) {
      if (err || SCRATCH.length == 0) {
        res.locals.tip = {
          opt: "flash",
          msg: "项目不存在或未发布",
          error: err,
        };
        res.send({
          code: 404,
          status: "404",
          msg: "项目不存在或未发布",
          error: err,
        });
        return;
      }

      res.locals["is_author"] =
        SCRATCH[0].authorid == res.locals.userid ? true : false;

      res.json(SCRATCH[0]);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/config", async function (req, res, next) {
  const result = await I.prisma.ow_config.findMany({
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
  const result = await I.prisma.ow_config.findFirst({
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
  const userId = res.locals["userid"];
  const displayName = res.locals["display_name"];

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
      res.locals.tip = { opt: "flash", msg: "用户不存在" };
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
module.exports = router;
