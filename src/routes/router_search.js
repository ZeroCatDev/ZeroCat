import { Router } from "express";
import { prisma } from "../services/global.js"; // 功能函数集
import logger from "../services/logger.js";

const router = Router();

// 搜索：Scratch项目列表：数据（直接查询表）
router.get("/", async (req, res, next) => {
  try {
    const {
      search_userid: userid,
      search_type: type,
      search_title: title,
      search_source: source,
      search_description: description,
      search_orderby: orderbyQuery = "time_down",
      search_tag: tags = "",
      curr = 1,
      limit = 10,
      search_state: stateQuery = "",
    } = req.query;

    // 处理 search_userid，支持列表和单个值
    let useridArray = [];
    if (userid) {
      useridArray = userid.split(",").map(id => Number(id.trim())).filter(id => !isNaN(id));
    }

    const isCurrentUser =
      useridArray.length > 0 &&
      res.locals.userid &&
      useridArray.includes(Number(res.locals.userid));

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
    let tagsArray = tags ? tags.split(",") : [];
    logger.debug(tagsArray);
    // 处理排序
    const [orderbyField, orderDirection] = orderbyQuery.split("_");
    const orderbyMap = {
      view: "view_count",
      time: "time",
      id: "id",
      star: "star_count",
    };
    const orderDirectionMap = { up: "asc", down: "desc" }; // 修正排序方向
    const orderBy = orderbyMap[orderbyField] || "time";
    const order = orderDirectionMap[orderDirection] || "desc";

    // 构建基本搜索条件
    const searchinfo = {
      title: title ? { contains: title } : undefined,
      source: source ? { contains: source } : undefined,
      description: description ? { contains: description } : undefined,
      type: type ? { equals: type } : undefined,
      state: state ? { in: state } : undefined,
      authorid: useridArray.length > 0
        ? useridArray.length === 1
          ? { equals: useridArray[0] }
          : { in: useridArray }
        : undefined,
      project_tags:
        tagsArray.length > 0
          ? { some: { name: { in: tagsArray } } }
          : undefined,
    };

    // 直接查询表
    const totalCount = await prisma.ow_projects.count({
      where: searchinfo,
    });

    const projectresult = await prisma.ow_projects.findMany({
      where: searchinfo,
      orderBy: { [orderBy]: order },
      select: {
        id: true,
        title: true,
        description: true,
        view_count: true,
        thumbnail: true,
        star_count: true,
        time: true,
        tags: true,
        state: true,
        name: true,
        author: {
          select: {
            display_name: true,
            id: true,
            avatar: true,
            username: true,
          },
        },
      },
      skip: (Number(curr) - 1) * Number(limit),
      take: Number(limit),
    });

    res.status(200).send({
      projects: projectresult,
      totalCount: totalCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
