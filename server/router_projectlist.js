import logger from "./lib/logger.js";
import configManager from "./configManager.js";

import { Router } from "express";
const router = Router();
import { needlogin } from "./middleware/auth.js";

import { addProjectToUserProjectlist, getProjectlist, deleteProjectlist, updateProjectlist, createProjectlist, getUserProjectlist, checkProjectlistWithUser, removeProjectFromUserProjectlist } from "./lib/method/projectlist.js";

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());


// 创建新收藏夹
router.post("/", needlogin, async (req, res, next) => {
  try {
    const result = await createProjectlist(res.locals.userid);
    res.status(200).send({ status: "1", msg: "创建成功", id: result.id });
  } catch (err) {
    next(err);
  }
});

// 添加作品到作品列表
router.post("/add", needlogin, async (req, res, next) => {
  try {
    const result = await addProjectToUserProjectlist({
      projectId: req.body.projectid,
      userId: res.locals.userid,
      listId: req.body.listid,
    });
    res.status(200).send({ status: "1", message: "添加成功", data: result });
  } catch (err) {
    next(err);
  }
});

// 删除作品从作品列表
router.post("/delete", needlogin, async (req, res, next) => {
  try {
    const result = await removeProjectFromUserProjectlist({
      projectId: req.body.projectid,
      userId: res.locals.userid,
      listId: req.body.listid,
    });
    res.status(200).send({ status: "1", message: "删除成功", data: result });
  } catch (err) {
    next(err);
  }
});

// 更新作品列表信息
router.put("/:id", needlogin, async (req, res, next) => {
  try {
    const info = await updateProjectlist(req.params.id, req.body);
    res.status(200).send({ status: "1", message: "保存成功", data: info });
  } catch (err) {
    next(err);
  }
});
// 获取用户的作品列表信息
router.get("/user/:id/:state?", async (req, res, next) => {
  try {
    const { id, state } = req.params;
    const isOwnUser = res.locals.userid == id;

    const stateMap = {
      private: isOwnUser ? ["private"] : ["public"],
      public: ["public"],
      all: isOwnUser ? ["private", "public"] : ["public"]
    };

    const selectedStates = stateMap[state] || stateMap.all;
    const info = await getUserProjectlist({ userId: id, state: selectedStates }, selectedStates);

    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    next(err);
  }
});

// 检查作品是否在用户列表中
router.get("/check", async (req, res, next) => {
  try {
    const info = await checkProjectlistWithUser({
      projectId: req.query.projectid,
      userId: res.locals.userid,
    });
    logger.debug(info);
    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    next(err);
  }
});

// 获取作品列表信息
router.get("/:id", async (req, res, next) => {
  try {
    const info = await getProjectlist({ listId:req.params.id, userId: res.locals.userid });
    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    next(err);
  }
});

// 删除作品列表
router.delete("/:id", needlogin, async (req, res, next) => {
  try {
    await deleteProjectlist({ listId:req.params.id, userId: res.locals.userid });
    res.status(200).send({ status: "1", message: "删除成功" });
  } catch (err) {
    next(err);
  }
});


export default router;
