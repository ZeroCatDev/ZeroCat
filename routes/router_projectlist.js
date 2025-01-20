import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

import { Router } from "express";
const router = Router();
import { needlogin } from "../middleware/auth.js";

import {
  starProject,
  unstarProject,
  getProjectStars,
  getProjectStarStatus,
  getProjectList,
  getUserListInfoAndCheak,
  createList,
  deleteList,
  addProjectToList,
  removeProjectFromList,
  getUserListInfo,
  getUserListInfoPublic,
  updateList
} from "../controllers/projectlist.js";

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

router.post("/star", needlogin, async (req, res, next) => {
  try {
    await starProject(res.locals.userid, req.body.projectid);
    res.status(200).send({ status: "success", message: "收藏成功", star: 1 });
  } catch (err) {
    next(err);
  }
});

router.post("/unstar", needlogin, async (req, res, next) => {
  try {
    await unstarProject(res.locals.userid, req.body.projectid);
    res.status(200).send({ status: "success", message: "取消收藏成功", star: 0 });
  } catch (err) {
    next(err);
  }
});

router.get("/stars", async (req, res, next) => {
  try {
    const stars = await getProjectStars(req.query.id);
    res.status(200).send({ status: "success", message: "获取成功", stars });
  } catch (err) {
    next(err);
  }
});

router.get("/checkstar", async (req, res, next) => {
  try {
    const status = await getProjectStarStatus(
      res.locals.userid,
      req.query.projectid
    );
    res.status(200).send({ status: "success", message: "获取成功", star: status });
  } catch (err) {
    next(err);
  }
});
router.get("/listid/:id", async (req, res, next) => {
  try {
    logger.debug(res.locals.userid);
    const list = await getProjectList(req.params.id, res.locals.userid);
    if (!list) {
      res.status(200).send({ status: "error", message: "列表不存在"});
      return;
    }

    res.status(200).send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    next(err);
  }
});

router.get("/userid/:id/public", async (req, res, next) => {
  try {
    logger.info(res.locals.userid);
    const list = await getUserListInfoPublic(req.params.id, res.locals.userid);
    res.status(200).send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    next(err);
  }
});
router.get("/my", async (req, res, next) => {
  try {
    logger.info(res.locals.userid);
    const list = await getUserListInfo(res.locals.userid);
    res.status(200).send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    next(err);
  }
});
router.get("/check", async (req, res, next) => {
  var result = await getUserListInfoAndCheak(
    res.locals.userid,
    req.query.projectid
  );
  res.status(200).send({ status: "success", message: "获取成功", data: result });
});

router.post("/create", needlogin, async (req, res, next) => {
  try {
    const list = await createList(res.locals.userid, req.body.name);
    res.status(200).send({ status: "success", message: "创建成功", data: list });
  } catch (err) {
    next(err);
  }
});
router.post("/delete", needlogin, async (req, res, next) => {
  try {
    const list = await deleteList(res.locals.userid, req.body.id);
    res.status(200).send({ status: "success", message: "删除成功", data: list });
  } catch (err) {
    next(err);
  }
});
router.post("/add", needlogin, async (req, res, next) => {
  try {
    const list = await addProjectToList(
      res.locals.userid,
      req.body.listid,
      req.body.projectid
    );
    res.status(200).send({ status: "success", message: "添加成功", data: list });
  } catch (err) {
    next(err);
  }
});
router.post("/remove", needlogin, async (req, res, next) => {
  try {
    const list = await removeProjectFromList(
      res.locals.userid,
      req.body.listid,
      req.body.projectid
    );
    res.status(200).send({ status: "success", message: "删除成功", data: list });
  } catch (err) {
    next(err);
  }
});
// 修改列表名称，简介，状态
router.post("/update/:id", needlogin, async (req, res, next) => {
  try {
    const list = await updateList(res.locals.userid,req.params.id, req.body);
    res.status(200).send({ status: "success", message: "修改成功", data: list });
  } catch (err) {
    next(err);
  }
})
export default router;
