const express = require("express");
const router = express.Router();
const I = require("./lib/global.js"); // 功能函数集
const DB = require("./lib/database.js"); // 数据库

// 搜索：Scratch项目列表：数据（只搜索标题）
router.get("/", async (req, res) => {
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

  const isCurrentUser = userid && res.locals.userid && userid === res.locals.userid;
  let state = stateQuery === "" ? (isCurrentUser ? ['private', 'public'] : ['public'])
            : (stateQuery === 'private' ? (isCurrentUser ? ['private'] : ['public']) : [stateQuery]);

  // 处理排序
  const [orderbyField, orderDirection] = orderbyQuery.split("_");
  const orderbyMap = { view: "view_count", time: "time", id: "id" };
  const orderDirectionMap = { up: "desc", down: "asc" };
  const orderBy = orderbyMap[orderbyField] || "time";
  const order = orderDirectionMap[orderDirection] || "desc";

  // 搜索条件
  const searchinfo = {
    title: { contains: title },
    source: source ? { contains: source } : undefined,
    description: { contains: description },
    type: { contains: type },
    state: { in: state },
    tags: { contains: tags },
    authorid: userid ? { equals: Number(userid) } : undefined,
  };

  try {
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
        tags: true,
      },
      skip: (Number(curr) - 1) * Number(limit),
      take: Number(limit),
    });

    // 统计项目总数
    const projectcount = await I.prisma.ow_projects.count({ where: searchinfo });

    // 获取作者信息
    const authorIds = [...new Set(projectresult.map((item) => item.authorid))];
    const userresult = await I.prisma.ow_users.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        username: true,
        display_name: true,
        motto: true,
        images: true,
      },
    });

    res.status(200).send({
      projects: projectresult,
      users: userresult,
      totalCount: [{ totalCount: projectcount }],
    });
  } catch (error) {
    console.error("Error fetching data: ", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// 搜索：Scratch项目列表：数据（只搜索标题）
router.post("/user", (req, res) => {
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
});

module.exports = router;
