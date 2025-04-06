import logger from "../utils/logger.js";
import { Router } from "express";
import { needlogin } from "../middleware/auth.js";
import {
  getProjectList,
  getUserListInfoAndCheak,
  createList,
  deleteList,
  addProjectToList,
  removeProjectFromList,
  getUserListInfo,
  getUserListInfoPublic,
  updateList,
} from "../controllers/lists.js";

const router = Router();

// Get a specific list by ID
router.get("/listid/:id", async (req, res) => {
  try {
    const list = await getProjectList(req.params.id, res.locals.userid);
    if (!list) {
      return res.status(404).send({ status: "error", message: "列表不存在" });
    }

    res
      .status(200)
      .send({ status: "success", message: "获取成功", data: list });
  } catch (err) {
    logger.error("Error getting project list:", err);
    res.status(500).send({ status: "error", message: "获取项目列表时出错" });
  }
});

// Get public lists for a user
router.get("/userid/:id/public", async (req, res) => {
  try {
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

// Get current user's lists
router.get("/my", async (req, res) => {
  try {
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

// Check if a project is in any of the user's lists
router.get("/check", async (req, res) => {
  try {
    const { projectid } = req.query;

    if (!projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "项目ID不能为空" });
    }

    const result = await getUserListInfoAndCheak(res.locals.userid, projectid);
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

// Create a new list
router.post("/create", needlogin, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).send({ status: "error", message: "标题不能为空" });
    }

    const list = await createList(res.locals.userid, title, description);
    res
      .status(200)
      .send({ status: "success", message: "创建成功", data: list });
  } catch (err) {
    logger.error("Error creating list:", err);
    res.status(500).send({ status: "error", message: "创建列表时出错" });
  }
});

// Delete a list
router.post("/delete", needlogin, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res
        .status(400)
        .send({ status: "error", message: "列表ID不能为空" });
    }

    const list = await deleteList(res.locals.userid, id);
    res
      .status(200)
      .send({ status: "success", message: "删除成功", data: list });
  } catch (err) {
    logger.error("Error deleting list:", err);
    res.status(500).send({ status: "error", message: "删除列表时出错" });
  }
});

// Add a project to a list
router.post("/add", needlogin, async (req, res) => {
  try {
    const { listid, projectid } = req.body;

    if (!listid || !projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "列表ID和项目ID不能为空" });
    }

    const list = await addProjectToList(res.locals.userid, listid, projectid);
    res
      .status(200)
      .send({ status: "success", message: "添加成功", data: list });
  } catch (err) {
    logger.error("Error adding project to list:", err);
    res.status(500).send({ status: "error", message: "添加项目到列表时出错" });
  }
});

// Remove a project from a list
router.post("/remove", needlogin, async (req, res) => {
  try {
    const { listid, projectid } = req.body;

    if (!listid || !projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "列表ID和项目ID不能为空" });
    }

    const list = await removeProjectFromList(
      res.locals.userid,
      listid,
      projectid
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

// Update list details
router.post("/update/:id", needlogin, async (req, res) => {
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
