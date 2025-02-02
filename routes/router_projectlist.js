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
  updateList,
} from "../controllers/projectlist.js";

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

router.post("/star", needlogin, async (req, res, next) => {
  try {
    res.status(200).send({ status: "success", message: "收藏成功", star: 1 });
    await starProject(res.locals.userid, req.body.projectid);
  } catch (err) {
    logger.error("Error starring project:", err);
    res.status(500).send({ status: "error", message: "收藏项目时出错" });
  }
});

router.post("/unstar", needlogin, async (req, res, next) => {
  try {
    res
      .status(200)
      .send({ status: "success", message: "取消收藏成功", star: 0 });
    await unstarProject(res.locals.userid, req.body.projectid);
  } catch (err) {
    logger.error("Error unstarring project:", err);
    res.status(500).send({ status: "error", message: "取消收藏项目时出错" });
  }
});

router.get("/checkstar", async (req, res, next) => {
  try {
    const status = await getProjectStarStatus(
      res.locals.userid,
      req.query.projectid
    );
    res.status(200).send({
      status: "success",
      message: "获取成功",
      star: status,
    });
  } catch (err) {
    logger.error("Error checking star status:", err);
    res.status(500).send({ status: "error", message: "检查收藏状态时出错" });
  }
});
router.get("/listid/:id", async (req, res, next) => {
  try {
    logger.debug(res.locals.userid);
    const list = await getProjectList(req.params.id, res.locals.userid);
    if (!list) {
      res.status(200).send({ status: "error", message: "列表不存在" });
      return;
    }

    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    logger.error("Error getting project list:", err);
    res.status(500).send({ status: "error", message: "获取项目列表时出错" });
  }
});

router.get("/userid/:id/public", async (req, res, next) => {
  try {
    logger.info(res.locals.userid);
    const list = await getUserListInfoPublic(req.params.id, res.locals.userid);
    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    logger.error("Error getting public user list info:", err);
    res
      .status(500)
      .send({ status: "error", message: "获取公共用户列表信息时出错" });
  }
});
router.get("/my", async (req, res, next) => {
  try {
    logger.info(res.locals.userid);
    const list = await getUserListInfo(res.locals.userid);
    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    logger.error("Error getting my list info:", err);
    res
      .status(500)
      .send({ status: "error", message: "获取我的列表信息时出错" });
  }
});
router.get("/check", async (req, res, next) => {
  try {
    var result = await getUserListInfoAndCheak(
      res.locals.userid,
      req.query.projectid
    );
    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: result });
  } catch (err) {
    logger.error("Error checking user list info:", err);
    res
      .status(500)
      .send({ status: "error", message: "检查用户列表信息时出错" });
  }
});

router.post("/create", needlogin, async (req, res, next) => {
  try {
    const list = await createList(
      res.locals.userid,
      req.body.title,
      req.body.description
    );
    res
      .status(200)
      .send({ status: "success", message: "创建成功", data: list });
  } catch (err) {
    logger.error("Error creating list:", err);
    res.status(500).send({ status: "error", message: "创建列表时出错" });
  }
});
router.post("/delete", needlogin, async (req, res, next) => {
  try {
    const list = await deleteList(res.locals.userid, req.body.id);
    res
      .status(200)
      .send({ status: "success", message: "删除成功", data: list });
  } catch (err) {
    logger.error("Error deleting list:", err);
    res.status(500).send({ status: "error", message: "删除列表时出错" });
  }
});
router.post("/add", needlogin, async (req, res, next) => {
  try {
    const list = await addProjectToList(
      res.locals.userid,
      req.body.listid,
      req.body.projectid
    );
    res
      .status(200)
      .send({ status: "success", message: "添加成功", data: list });
  } catch (err) {
    logger.error("Error adding project to list:", err);
    res.status(500).send({ status: "error", message: "添加项目到列表时出错" });
  }
});
router.post("/remove", needlogin, async (req, res, next) => {
  try {
    const list = await removeProjectFromList(
      res.locals.userid,
      req.body.listid,
      req.body.projectid
    );
    res
      .status(200)
      .send({ status: "success", message: "删除成功", data: list });
  } catch (err) {
    logger.error("Error removing project from list:", err);
    res
      .status(500)
      .send({ status: "error", message: "从列表中删除项目时出错" });
  }
});
// 修改列表名称，简介，状态
router.post("/update/:id", needlogin, async (req, res, next) => {
  try {
    const list = await updateList(res.locals.userid, req.params.id, req.body);
    res
      .status(200)
      .send({ status: "success", message: "修改成功", data: list });
  } catch (err) {
    logger.error("Error updating list:", err);
    res.status(500).send({ status: "error", message: "修改列表时出错" });
  }
});
export default router;
