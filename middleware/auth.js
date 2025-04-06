import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import jsonwebtoken from "jsonwebtoken";

/**
 * 解析token中间件
 * 从请求中提取token并验证
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function parseToken(req, res, next) {
  const SecurityToken = await configManager.getConfig("security.jwttoken");
  const tokenSources = [
    req.headers["authorization"]?.replace("Bearer ", ""),
    req.cookies?.token,
    req.body?.token,
    req.query?.token,
    req.headers?.["token"],
  ];
  logger.debug(tokenSources);

  let foundValidToken = false;
  for (let source of tokenSources) {
    if (source) {
      logger.debug(source);
      try {
        const decodedToken = jsonwebtoken.verify(source, SecurityToken);
        if (decodedToken?.userid) {
          res.locals = {
            login: true,
            userid: decodedToken.userid,
            username: decodedToken.username,
            is_admin: decodedToken.is_admin || 0,
            usertoken: source,
          };
          logger.debug(res.locals);
          foundValidToken = true;
          break;
        }
      } catch (err) {
        logger.debug(err);
        continue;
      }
    }
  }

  if (foundValidToken === false) {
    logger.debug('未找到登录信息');
    res.locals = {
      login: false,
      userid: "",
      username: "",
      is_admin: 0,
      usertoken: "",
    };
  }

  logger.debug(res.locals);
  next();
}

/**
 * 严格模式token中间件
 * 和parseToken功能相同，但为重要接口保留
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
async function strictTokenCheck(req, res, next) {
  // 当前和parseToken实现相同，但保留为单独中间件以便未来差异化实现
  await parseToken(req, res, next);
}

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

  // 检查管理员标志或管理员用户ID
  if (res.locals.is_admin !== 1 && res.locals.userid !== 1) {
    logger.info(`[needadmin] - ${req.ip} - 尝试访问管理路由，权限不足`);
    return res.status(401).send({ status: "error", message: "权限不足", code: "AUTH_ERROR_PERMISSION" });
  }
  next();
}

export { parseToken, strictTokenCheck, needlogin, needadmin };
