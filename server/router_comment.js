const logger = require("./lib/logger.js");
const configManager = require("./configManager");

const express = require("express");
const router = express.Router();
const I = require("./lib/global.js");
const { getUsersByList } = require("./lib/method/users.js");
// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

// 统一的错误处理函数
const handleError = (res, err, message) => {
  logger.error(err);
  res.status(500).send({ errno: 1, errmsg: message, data: err });
};

// 检查登录状态
const checkLogin = (res) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }
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
const transformComment = (comments) => {
  return comments.map((comment) => {
    return comment;
    const time = new Date(comment.insertedAt).getTime();
    const objectId = comment.id;
    const browser = (
      comment.ua
        ? comment.ua.match(/(Edge|Chrome|Firefox|Safari|Opera)/)
        : ["未知"]
    )[0];
    const os = (
      comment.ua ? comment.ua.match(/(Windows|Mac|Linux)/) : null || ["未知"]
    )[0];
    const type = comment.id == 1 ? "administrator" : "guest";
    const avatar =
      "https://owcdn.190823.xyz/user/fcd939e653195bb6d057e8c2519f5cc7";
    const orig = comment.comment;
    const ip = comment.ip;
    const addr = "";

    return {
      ...comment,
      time,
      objectId,
      browser,
      os,
      type,
      avatar,
      orig,
      ip,
      addr,
    };
  });
};

// 读取评论
router.get("/api/comment", async (req, res, next) => {
  try {
    const { path, page, pageSize } = req.query;
    const sort = getSortCondition(req);

    const comments = await I.prisma.ow_comment.findMany({
      where: { page_key: path, pid: null, rid: null, type: "comment" },
      orderBy: sort,
      take: Number(pageSize) || 10,
      skip: (page - 1) * pageSize,
    });

    const transformedComments = transformComment(comments);

    const ids = transformedComments.map((comment) => comment.id);

    const childrenComments = await I.prisma.ow_comment.findMany({
      where: { page_key: path, rid: { in: ids }, type: "comment" },
    });

    const transformedChildrenComments = transformComment(childrenComments);
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

    const count = await I.prisma.ow_comment.count({
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
router.post("/api/comment", async (req, res, next) => {
  try {
    checkLogin(res);

    const { url, comment, pid, rid } = req.body;
    const { userid, display_name } = res.locals;
    const user_ua = req.headers["user-agent"] || "";

    const newComment = await I.prisma.ow_comment.create({
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

    res.status(200).send({
      errno: 0,
      errmsg: "",
      data: transformComment([newComment])[0],
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

    const comment = await I.prisma.ow_comment.findFirst({
      where: { id: Number(id) },
    });

    if (comment.user_id == user_id || true) {
      await I.prisma.ow_comment.delete({
        where: { id: Number(id) },
      });
    }

    res.status(200).send({ errno: 0, errmsg: "", data: "" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
