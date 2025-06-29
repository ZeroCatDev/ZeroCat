import { Router } from "express";
import logger from "../services/logger.js";
import { needLogin } from "../middleware/auth.js";
import { getUserTimeline, getFollowingTimeline, getMyTimeline } from "../services/timeline.js";

const router = Router();

// 获取用户时间线
router.get("/user/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const isOwner = res.locals.userid === Number(userid);

    logger.debug("Fetching timeline for user", {
      userid,
      isOwner,
      currentUser: res.locals.userid,
    });

    const result = await getUserTimeline(userid, page, limit, isOwner);

    res.status(200).send({
      status: "success",
      data: result,
    });
  } catch (error) {
    logger.error("Error fetching timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取时间线失败",
      details: error.message,
    });
  }
});

// 获取关注的用户的时间线（只显示公开事件）
router.get("/following", needLogin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await getFollowingTimeline(res.locals.userid, page, limit);

    res.status(200).send({
      status: "success",
      data: result,
    });
  } catch (error) {
    logger.error("Error fetching following timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取关注时间线失败",
    });
  }
});

// 获取我的时间线（包含自己和关注的人的事件）
router.get("/me", needLogin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await getMyTimeline(res.locals.userid, page, limit);

    res.status(200).send({
      status: "success",
      data: result,
    });
  } catch (error) {
    logger.error("Error fetching my timeline:", error);
    res.status(500).send({
      status: "error",
      message: "获取我的时间线失败",
    });
  }
});

export default router;
