const logger = require("./lib/logger.js");
const configManager = require("./configManager");

const express = require("express");
const router = express.Router();
const I = require("./lib/global.js"); // 功能函数集
const DB = require("./lib/database.js"); // 数据库
const {
  getUsersByList
} = require("./lib/method/projects.js");
// 搜索：Scratch项目列表：数据（只搜索标题）
router.get("/", async (req, res, next) => {
  try {
    const {
      search_userid: userid,
      search_type: type,
      search_title: title,
      search_source: source,
      search_description: description,
      search_orderby: orderbyQuery = "time_down",
      search_tag: tags,
      curr = 1,
      limit = 10,
      search_state: stateQuery = "",
    } = req.query;

    const isCurrentUser =
      userid && res.locals.userid && userid == res.locals.userid;
    let state =
      stateQuery == ""
        ? isCurrentUser
          ? ["private", "public"]
          : ["public"]
        : stateQuery == "private"
        ? isCurrentUser
          ? ["private"]
          : ["public"]
        : [stateQuery];

    // 处理排序
    const [orderbyField, orderDirection] = orderbyQuery.split("_");
    const orderbyMap = { view: "view_count", time: "time", id: "id" };
    const orderDirectionMap = { up: "desc", down: "asc" };
    const orderBy = orderbyMap[orderbyField] || "time";
    const order = orderDirectionMap[orderDirection] || "desc";

    // 构建基本搜索条件
    const searchinfo = {
      title: title ? { contains: title } : undefined,
      source: source ? { contains: source } : undefined,
      description: description ? { contains: description } : undefined,
      type: type ? { contains: type } : undefined,
      state: { in: state },
      authorid: userid ? { equals: Number(userid) } : undefined,
    };

    // 添加标签搜索条件
    if (tags) {
      searchinfo['tags'] = {
        some: {
          name: { contains: tags }
        }
      };
    }

    // 查询项目总数
    const totalCount = await I.prisma.ow_projects.count({
      where: searchinfo,
    });

    // 查询项目结果
    const projectresult = await I.prisma.ow_projects.findMany({
      where: searchinfo,
      orderBy: { [orderBy]: order },
      select: {
        id: true,
        type: true,
        title: true,
        state: true,
        authorid: true,
        description: true,
        view_count: true,
        time: true,
        tags: {
          select: {
            name: true,
            id: true
          }
        }
      },
      skip: (Number(curr) - 1) * Number(limit),
      take: Number(limit),
    });

    // 获取作者信息
    const authorIds = [...new Set(projectresult.map((item) => item.authorid))];
    const userresult = await getUsersByList(authorIds);

    res.status(200).send({
      projects: projectresult,
      users: userresult,
      totalCount: [{ totalCount }],
    });
  } catch (error) {
    next(error);
  }
});

// 搜索：Scratch项目列表：数据（只搜索标题）
router.post("/user", async (req, res, next) => {
  try {
    const searchTxt = req.body.txt;
    if (!searchTxt) {
      return res.status(200).send([]);
    }

    const SQL = `SELECT id, display_name, motto, images FROM ow_users WHERE display_name LIKE ?`;
    const WHERE = [`%${searchTxt}%`];

    DB.qww(SQL, WHERE, (err, data) => {
      if (err) {
        return res.status(500).send([]); // 如果有数据库错误，返回500状态码
      }
      res.status(200).send(data);
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
