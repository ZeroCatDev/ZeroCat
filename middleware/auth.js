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
    return res
      .status(401)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
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
    return res
      .status(401)
      .send({ status: "error", message: "未登录", code: "AUTH_ERROR_LOGIN" });
  }

  if (res.locals.userid !== 1) {
    logger.info(`[needadmin] - ${req.ip} - 尝试访问管理路由，权限不足`);
    return res.status(401).send({ status: "error", message: "权限不足" });
  }
  next();
}

export { needlogin, needadmin };
