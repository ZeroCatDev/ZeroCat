const express = require("express");
const router = express.Router();
const I = require("./lib/global.js");

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

// 统一的错误处理函数
const handleError = (res, err, message) => {
  console.error(err);

  res.status(500).send({ errno: 1, errmsg: message, data: err });
};

// 读取评论
router.get("/api/comment", async (req, res) => {
  //if (!res.locals.login) {return res.status(404).send({ status: "0", msg: "请先登录" });}

  try {
    console.log(req.query.path);
    console.log(req.query.page);
    console.log(req.query.pageSize);
    if (req.query.sortBy == "insertedAt_desc") {
      var sort = {
        id: "desc",
      };
    } else if (req.query.sortBy == "insertedAt_asc") {
      var sort = {
        id: "asc",
      };
    } else if (req.query.sortBy == "like_desc") {
      var sort = {
        like: "desc",
      };
    }

    var comment = await I.prisma.ow_comment.findMany({
      where: {
        url: req.query.path,
        pid: null,
        rid: null,
      },
      orderBy: sort,
      take: Number(req.query.pageSize) || 10, // 每页条数
      skip: (req.query.page - 1) * req.query.pageSize, // 跳过条数
    });
    comment = transformComment(comment);
    const ids = comment.map((item) => item.id);
    console.log(ids);

    var childrencomment = await I.prisma.ow_comment.findMany({
      where: {
        url: req.query.path,
        rid: { in: ids },
      },
    });
    childrencomment = transformComment(childrencomment);
    //console.log(childrencomment);

    const result1 = comment.map((item) => {
      // 从 arr2 中筛选 rid 等于 item.id 的项，组成 children 数组
      const children = childrencomment.filter((child) => child.rid === item.id);

      // 返回包含 children 的新对象
      return { ...item, children };
    });

    console.log(result1);
    const count = await I.prisma.ow_comment.count({
      where: {
        url: req.query.path,
        pid: null,
        rid: null,
      },
    });
    console.log(count);

    //console.log(comment);
    var result = {
      errno: 0,
      errmsg: "",
      data: {
        page: req.query.page,
        totalPages: Math.ceil(count / req.query.pageSize),
        pageSize: req.query.pageSize,
        count: count,
        data: result1,
      },
    };

    res.status(200).send(result);
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

// 创建评论
router.post("/api/comment", async (req, res) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }

  try {
    var comment = await I.prisma.ow_comment.create({
      data: {
        url: req.body.url,
        comment: req.body.comment,
        link: "/user/" + res.locals.userid,
        mail: res.locals.userid + "@zerocat.wuyuan.dev",
        nick: res.locals.display_name,
        ua: req.headers['user-agent']||"",
        //at: req.body.at||"",
        pid: req.body.pid || null,
        rid: req.body.rid || null,
      },
    });

    console.log(comment);

    res.status(200).send({
      errno: 0,
      errmsg: "",
      data: transformComment([comment])[0],
    });
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

// 删除评论
router.delete("/api/comment/:id", async (req, res) => {
  //if (!res.locals.login) {return res.status(404).send({ status: "0", msg: "请先登录" });}

  try {
    var comment = await I.prisma.ow_comment.findFirst({
      where: {
        id: Number(req.params.id),
      },
    });
    if (comment.user_id == res.locals.user_id || true) {
      var comment = await I.prisma.ow_comment.delete({
        where: {
          id: Number(req.params.id),
        },
      });
    }

    res.status(200).send({ errno: 0, errmsg: "", data: "" });
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

function transformComment(input) {
  var output = input.map((item) => {
    // 将时间戳转换为毫秒数
    const time = new Date(item.insertedAt).getTime();
    const objectId = item.id;
    const browser = (item.ua ? item.ua.match(/(Edge|Chrome|Firefox|Safari|Opera)/) : null || ["未知"])[0];

    const os = (item.ua ? item.ua.match(/(Windows|Mac|Linux)/) : null || ["未知"])[0];
    const type = item.id == 1 ? "administrator" : "guest";
    const label = null;
    const avatar =
      "https://owcdn.190823.xyz/user/fcd939e653195bb6d057e8c2519f5cc7";
    const orig = item.comment;
    const ip = item.ip;
    const addr = "";

    // 转换后的对象
    return {
      ...item,
      time,
      objectId,
      browser,
      os,
      type,
      label,
      avatar,
      orig,
      ip,
      addr,
    };
  });

  return output;
}

module.exports = router;
