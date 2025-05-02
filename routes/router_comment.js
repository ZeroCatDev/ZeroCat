import logger from "../services/logger.js";
import { needLogin, strictTokenCheck } from "../middleware/auth.js";
import zcconfig from "../services/config/zcconfig.js";
import notificationUtils from "../controllers/notifications.js";
import { UAParser } from "ua-parser-js";
import ipLocation from "../services/ip/ipLocation.js";

import { Router } from "express";
const router = Router();
import { prisma } from "../services/global.js";
import { getUsersByList } from "../controllers/users.js";
import { createEvent, TargetTypes } from "../controllers/events.js";
// 中间件，确保所有请求均经过该处理

// 统一的错误处理函数
const handleError = (res, err, message) => {
  logger.error(err);
  res.status(500).send({ errno: 1, errmsg: message, data: err });
};

// 获取排序条件
const getSortCondition = (req) => {
  const sortBy = req.query.sortBy;
  if (sortBy == "insertedAt_desc") return { id: "desc" };
  if (sortBy == "insertedAt_asc") return { id: "asc" };
  if (sortBy == "like_desc") return { like: "desc" };
  return {};
};

// 转换评论数据
const transformComment = async (comments) => {
  return Promise.all(
    comments.map(async (comment) => {
      const time = new Date(comment.insertedAt).getTime();
      const objectId = comment.id;

      // 使用 UAParser 解析 UA
      const parser = new UAParser(comment.user_ua || "");
      const result = parser.getResult();
      const browser = result.browser.name || "未知";
      const os = result.os.name || "未知";

      // 获取 IP 地址位置信息
      let ipInfo = await ipLocation.getIPLocation(comment.user_ip);

      return {
        ...comment,
        time,
        objectId,
        browser,
        os,
        addr: ipInfo.address,
        most_specific_country_or_region: ipInfo.most_specific_country_or_region,
      };
    })
  );
};

// 读取评论
router.get("/api/comment", async (req, res, next) => {
  try {
    const { path, page, pageSize } = req.query;
    const sort = getSortCondition(req);

    const comments = await prisma.ow_comment.findMany({
      where: { page_key: path, pid: null, rid: null, type: "comment" },
      orderBy: sort,
      take: Number(pageSize) || 10,
      skip: (page - 1) * pageSize,
    });

    const transformedComments = await transformComment(comments);

    const ids = transformedComments.map((comment) => comment.id);

    const childrenComments = await prisma.ow_comment.findMany({
      where: { page_key: path, rid: { in: ids }, type: "comment" },
    });

    const transformedChildrenComments = await transformComment(
      childrenComments
    );
    // 获取评论的用户id

    var user_ids = transformedComments.map((comment) => comment.user_id);
    user_ids = user_ids.concat(
      transformedChildrenComments.map((comment) => comment.user_id)
    );
    //去重
    user_ids = Array.from(new Set(user_ids));

    logger.debug(user_ids);
    const users = await getUsersByList(user_ids);
    const result = transformedComments.map((comment) => {
      const children = transformedChildrenComments.filter(
        (child) => child.rid == comment.id
      );
      return { ...comment, children };
    });

    const count = await prisma.ow_comment.count({
      where: { page_key: path, pid: null, rid: null, type: "comment" },
    });

    res.status(200).send({
      errno: 0,
      errmsg: "",
      data: {
        page,
        totalPages: Math.ceil(count / pageSize),
        pageSize,
        count,
        data: result,
      },
      users,
    });
  } catch (err) {
    next(err);
  }
});

// 创建评论
router.post("/api/comment", needLogin, async (req, res, next) => {
  try {
    const { url, comment, pid, rid } = req.body;
    const { userid, display_name } = res.locals;
    const user_ua = req.headers["user-agent"] || "";

    const newComment = await prisma.ow_comment.create({
      data: {
        user_id: userid,
        type: "comment",
        user_ip: req.ip,
        page_type: url.split("-")[0],
        page_id: Number(url.split("-")[1]) || null,
        text: comment,
        link: `/user/${userid}`,
        user_ua,
        pid: pid || null,
        rid: rid || null,
      },
    });

    const transformedComment = (await transformComment([newComment]))[0];
    res.status(200).send({
      errno: 0,
      errmsg: "",
      data: transformedComment,
    });

    let user_id, targetType, targetId;
    if (url.split("-")[0] == "user") {
      targetType = "user";
      targetId = url.split("-")[1];
      user_id = targetId;
    } else if (url.split("-")[0] == "project") {
      const project = await prisma.ow_projects.findUnique({
        where: {
          id: Number(url.split("-")[1]),
        },
      });
      user_id = project.authorid;
      targetType = "PROJECT";
      targetId = url.split("-")[1];
    } else if (url.split("-")[0] == "projectlist") {
      targetType = "PROJECTLIST";
      targetId = url.split("-")[1];
      const projectlist = await prisma.ow_projectlists.findUnique({
        where: {
          id: Number(url.split("-")[1]),
        },
      });
      user_id = projectlist.authorid;
    } else {
      user_id = userid;
      targetType = "user";
      targetId = userid;
    }
    // 创建通知
    await notificationUtils.createNotification({
      userId: user_id,
      notificationType: "USER_NEW_COMMENT",
      actorId: userid,
      targetType: targetType,
      targetId: targetId,
      data: {
        comment: newComment.text,
      },
      highPriority: true,
    });
  } catch (err) {
    next(err);
  }
});

// 删除评论
router.delete("/api/comment/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = res.locals;

    const comment = await prisma.ow_comment.findFirst({
      where: { id: Number(id) },
    });

    if (comment.user_id == user_id || true) {
      await prisma.ow_comment.delete({
        where: { id: Number(id) },
      });
    }

    res.status(200).send({ errno: 0, errmsg: "", data: "" });
  } catch (err) {
    next(err);
  }
});

export default router;
