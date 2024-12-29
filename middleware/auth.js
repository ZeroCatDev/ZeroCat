import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

/**
 * 需要登录的中间件
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function needlogin(req, res, next) {
  if (!res.locals.login) {
    logger.info(`[needlogin] - ${req.ip} - 未登录，返回401 Unauthorized状态码`);
    return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
  }
  next(); // 已登录，继续处理请求
}

/**
 * 需要管理员权限的中间件
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function needadmin(req, res, next) {
  if (!res.locals.login) {
    logger.info(`[needadmin] - ${req.ip} - 未登录，返回401 Unauthorized状态码`);
    return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
  }

  const adminEmail = await configManager.getConfig("security.adminuser");
  if (res.locals.email !== adminEmail) {
    logger.info(`[needadmin] - ${req.ip} - 权限不足，返回401 Unauthorized状态码`);
    return res.status(401).send({ status: "0", msg: "权限不足" });
  }
  next(); // 已登录，继续处理请求
}

export {
  needlogin,
  needadmin
};

