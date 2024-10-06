const express = require("express");
const router = express.Router();
const needlogin = require("./lib/needlogin.js");

const {
  userProjectlistAdd,
  userProjectlistDelete,
  getProjectlist,
  deleteProjectlist,
  updateProjectlist,
  createProjectlist,
  getUserPublicProjectlist,
  getUserProjectlist,
  checkProjectlistWithUser,
} = require("./lib/method/projectlist.js");

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

// 统一的错误处理函数
const handleError = (res, message, err) => {
  console.error(err);
  res.status(500).send({ status: "0", message, error: err });
};

// 创建新收藏夹
router.post("/", needlogin, async (req, res) => {
  try {
    const result = await createProjectlist(res.locals.userid);
    res.status(200).send({ status: "1", msg: "创建成功", id: result.id });
  } catch (err) {
    handleError(res, "创建失败", err);
  }
});

// 添加作品到作品列表
router.post("/add", needlogin, async (req, res) => {
  try {
    const result = await userProjectlistAdd({
      projectid: req.body.projectid,
      userid: res.locals.userid,
      listid: req.body.listid,
    });
    res.status(200).send({ status: "1", message: "添加成功", data: result });
  } catch (err) {
    handleError(res, "添加失败", err);
  }
});

// 删除作品从作品列表
router.post("/delete", needlogin, async (req, res) => {
  try {
    const result = await userProjectlistDelete({
      projectid: req.body.projectid,
      userid: res.locals.userid,
      listid: req.body.listid,
    });
    res.status(200).send({ status: "1", message: "删除成功", data: result });
  } catch (err) {
    handleError(res, "删除失败", err);
  }
});

// 更新作品列表信息
router.put("/:id", needlogin, async (req, res) => {
  try {
    const info = await updateProjectlist(req.params.id, req.body);
    res.status(200).send({ status: "1", message: "保存成功", data: info });
  } catch (err) {
    handleError(res, "保存失败", err);
  }
});

// 获取用户的作品列表信息
router.get("/user/:id/:state?", async (req, res) => {
  try {
    const { id, state } = req.params;
    let info;

    if (state === "private" && res.locals.userid == id) {
      console.log("1");
      info = await getUserProjectlist(id,["private"]);
    } else if (state === "public") {
      console.log("2");
      info = await getUserProjectlist(id,["public"]);
    } else if (!state || ["all", "undefined", "null", ""].includes(state)) {
      console.log("3");
      info = res.locals.userid == id
        ? await getUserProjectlist(id,["private", "public"])
        : await getUserProjectlist(id,["public"]);
    } else {
      console.log("4");
      info = await getUserProjectlist(id,"public");
    }

    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    res.status(200).send({ status: "0", message: "列表不存在或无权打开", error: err });
  }
});

// 检查作品是否在用户列表中
router.get("/check", async (req, res) => {
  try {
    const info = await checkProjectlistWithUser({
      projectid: req.query.projectid,
      userid: res.locals.userid,
    });
    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    res.status(200).send({ status: "0", message: "列表不存在或无权打开", error: err });
  }
});

// 获取作品列表信息
router.get("/:id", async (req, res) => {
  try {
    const info = await getProjectlist(req.params.id, res.locals.userid);
    res.status(200).send({ status: "1", message: "获取成功", data: info });
  } catch (err) {
    res.status(200).send({ status: "0", message: "列表不存在或无权打开", error: err });
  }
});

// 删除作品列表
router.delete("/:id", needlogin, async (req, res) => {
  try {
    await deleteProjectlist(req.params.id, res.locals.userid);
    res.status(200).send({ status: "1", message: "删除成功" });
  } catch (err) {
    handleError(res, "删除失败", err);
  }
});

module.exports = router;
