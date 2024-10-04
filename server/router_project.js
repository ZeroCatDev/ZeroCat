const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const DB = require("./lib/database.js");
const I = require("./lib/global.js");
const default_project = require("./lib/default_project.js");

// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());


// 创建新作品
router.post("/", async (req, res) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }

  try {
    const outputJson = { ...extractProjectData(req.body), type: req.body.type || "scratch" };
    outputJson.source = default_project[outputJson.type];
    outputJson.devsource = outputJson.source;
    outputJson.authorid = res.locals.userid;

    const result = await I.prisma.ow_projects.create({ data: outputJson });
    res.status(200).send({ status: "1", msg: "保存成功", id: result.id });
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

// Fork 作品
router.post("/:id/fork", async (req, res) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }

  try {
    const original = await I.prisma.ow_projects.findFirst({ where: { id: Number(req.params.id) } });

    if (original?.state === "public") {
      const result = await I.prisma.ow_projects.create({
        data: {
          authorid: res.locals.userid,
          title: `${original.title}改编`,
          description: original.description,
          licence: original.licence,
          state: "private",
          type: original.type,
          source: original.source,
          devsource: original.source,
          tags: original.tags,
        },
      });
      res.status(200).send({ status: "1", msg: "改编成功", id: result.id });
    } else {
      res.status(403).send({ status: "0", msg: "改编失败" });
    }
  } catch (err) {
    handleError(res, err, "改编失败");
  }
});

// 保存源代码
router.put("/:id/source", async (req, res) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    const sha256 = setProjectFile(JSON.stringify(req.body));
    const projectId = Number(req.params.id);
    const userId = Number(res.locals.userid);

    const updateData = { devsource: sha256 };
    const result = await I.prisma.ow_projects.update({ where: { id: projectId, authorid: userId }, data: updateData });

    if (result.devenv === 0) {
      await I.prisma.ow_projects.update({ where: { id: projectId, authorid: userId }, data: { source: sha256 } });
    }

    res.status(200).send({ status: "1", msg: "保存成功" });
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

// 更新作品信息
router.put("/:id", async (req, res) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    const updatedData = extractProjectData(req.body);
    await I.prisma.ow_projects.update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: updatedData,
    });
    res.status(200).send({ status: "1", msg: "保存成功" });
  } catch (err) {
    handleError(res, err, "保存失败");
  }
});

// 推送作品
router.post("/:id/push", async (req, res) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
    });

    if (project.devenv === 0 && req.body.force !== "true") {
      return res.status(403).send({ status: "0", msg: "未开启开发环境，无法推送" });
    }

    await I.prisma.ow_projects.update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: { source: project.devsource },
    });

    if (project.history === 1) {
      const sha256 = setProjectFile(project.source);
      await I.prisma.ow_projects_history.create({
        data: {
          projectid: Number(req.params.id),
          source: sha256,
          authorid: Number(res.locals.userid),
          type: project.type,
          title: project.title,
          description: project.description,
          state: project.state,
          licence: project.licence,
          tags: project.tags,
        },
      });
    }

    res.status(200).send({ status: "1", msg: "推送成功" });
  } catch (err) {
    handleError(res, err, "推送失败");
  }
});

// 获取项目信息
router.get("/:id", async (req, res) => {
  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
      select: projectSelectionFields(),
    });

    if (!project || (project.state === "private" && project.authorid !== res.locals.userid)) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const author = await I.prisma.ow_users.findFirst({
      where: { id: Number(project.authorid) },
      select: authorSelectionFields(),
    });
    project.author = author;
    res.status(200).send(project);
  } catch (err) {
    handleError(res, err, "作品不存在或无权打开");
  }
});

// 获取源代码
router.get("/:id/source/:env?", async (req, res) => {
  try {
    const project = await I.prisma.ow_projects.findFirst({ where: { id: Number(req.params.id) } });

    if (!project) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const source = project.authorid === res.locals.userid ? project.devsource : project.source;
    const projectFile = await getProjectFile(source);

    if (projectFile?.source) {
      res.status(200).send(projectFile.source);
    } else {
      res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
  } catch (err) {
    handleError(res, err, "作品不存在或无权打开");
  }
});

// 删除作品
router.delete("/:id", async (req, res) => {
  try {
    await I.prisma.ow_projects.delete({
      where: { id: Number(req.params.id), authorid: res.locals.userid },
    });
    res.status(200).send({ status: "1", msg: "删除成功" });
  } catch (err) {
    handleError(res, err, "删除失败");
  }
});

// 工具函数：提取项目数据
function extractProjectData(body) {
  const fields = ["type", "licence", "state", "title", "description", "history", "tags"];
  return fields.reduce((acc, field) => (body[field] ? { ...acc, [field]: body[field] } : acc), {});
}

// 工具函数：设置项目文件
function setProjectFile(source) {
  const sha256 = crypto.createHash("sha256").update(source).digest("hex");
  I.prisma.ow_projects_file.create({ data: { sha256, source } }).catch(console.error);
  return sha256;
}

// 工具函数：获取项目文件
async function getProjectFile(sha256) {
  return I.prisma.ow_projects_file.findFirst({ where: { sha256 }, select: { source: true } });
}

// 工具函数：处理错误响应
function handleError(res, err, msg) {
  console.error(err);
  res.status(500).send({ status: "0", msg, error: err });
}

// 工具函数：选择项目信息字段
function projectSelectionFields() {
  return {
    id: true,
    type: true,
    licence: true,
    authorid: true,
    state: true,
    view_count: true,
    time: true,
    title: true,
    description: true,
    tags: true,
    source: true,
  };
}

// 工具函数：选择作者信息字段
function authorSelectionFields() {
  return {
    id: true,
    username: true,
    display_name: true,
    state: true,
    regTime: true,
    motto: true,
    images: true,
  };
}

module.exports = router;
