const logger = require("./lib/logger.js");
const configManager = require("./configManager");
const express = require("express");
const router = express.Router();
const DB = require("./lib/database.js");
const I = require("./lib/global.js");
const default_project = require("./lib/default_project.js");
const {
  extractProjectData,
  setProjectFile,
  getProjectFile,
  projectSelectionFields,
  authorSelectionFields,
  handleTagsChange,
} = require("./lib/method/projects.js");
const { Logger } = require("winston");
// 中间件，确保所有请求均经过该处理
router.all("*", (req, res, next) => next());

// 创建新作品
router.post("/", async (req, res, next) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }

  try {
    const outputJson = {
      ...extractProjectData(req.body),
      type: req.body.type || "scratch",
    };
    outputJson.source = default_project[outputJson.type];
    outputJson.devsource = outputJson.source;
    outputJson.authorid = res.locals.userid;

    const result = await I.prisma.ow_projects.create({ data: outputJson });
    res.status(200).send({ status: "1", msg: "保存成功", id: result.id });
  } catch (err) {
    logger.error("Error creating new project:", err);
    next(err);
  }
});

// Fork 作品
router.post("/:id/fork", async (req, res, next) => {
  if (!res.locals.login) {
    return res.status(404).send({ status: "0", msg: "请先登录" });
  }

  try {
    const original = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
    });

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
    logger.error("Error forking project:", err);
    next(err);
  }
});

// 保存源代码
router.put("/:id/source", async (req, res, next) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    var project=await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
    })
    if(project==null){
      return res.status(403).send({ status: "0", msg: "没有权限" });
    }
    //logger.debug(req.body);
    var reqbody = req.body
    //logger.debug('1111111111111');
    logger.debug(typeof reqbody);
    const sha256 = setProjectFile(reqbody);
    const projectId = Number(req.params.id);
    const userId = Number(res.locals.userid);

    const updateData = { devsource: sha256 };
    const result = await I.prisma.ow_projects.update({
      where: { id: projectId, authorid: userId },
      data: updateData,
    });

    if (result.devenv === 0) {
      await I.prisma.ow_projects.update({
        where: { id: projectId, authorid: userId },
        data: { source: sha256 },
      });
    }

    res.status(200).send({ status: "1", msg: "保存成功" });
  } catch (err) {
    logger.error("Error saving source code:", err);
    next(err);
  }
});

// 更新作品信息
router.put("/:id", async (req, res, next) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    const updatedData = extractProjectData(req.body);
    await I.prisma.ow_projects.update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: updatedData,
    });
    // 处理标签
    if(req.body.tags){
      await handleTagsChange(Number(req.params.id), req.body.tags);
    }

    res.status(200).send({ status: "1", msg: "保存成功" });
  } catch (err) {
    logger.error("Error updating project information:", err);
    next(err);
  }
});

// 推送作品
router.post("/:id/push", async (req, res, next) => {
  if (!res.locals.userid) {
    return res.status(403).send({ status: "0", msg: "请先登录" });
  }

  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
    });

    if (project.devenv === 0 && req.body.force !== "true") {
      return res
        .status(403)
        .send({ status: "0", msg: "未开启开发环境，无法推送" });
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
    logger.error("Error pushing project:", err);
    next(err);
  }
});

// 获取项目信息
router.get("/:id", async (req, res, next) => {
  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
      select: projectSelectionFields(),
    });

    if (
      !project ||
      (project.state === "private" && project.authorid !== res.locals.userid)
    ) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const author = await I.prisma.ow_users.findFirst({
      where: { id: Number(project.authorid) },
      select: authorSelectionFields(),
    });

    const tags = await I.prisma.ow_projects_tags.findMany({
      where: { projectid: Number(req.params.id) },
      select: { name: true, id: true ,created_at: true},
    });

    project.author = author;
    project.tags = tags
    logger.debug(tags);
    logger.debug(project);
    res.status(200).send(project);
  } catch (err) {
    logger.error("Error fetching project information:", err);
    next(err);
  }
});

// 获取源代码
router.get("/:id/source/:env?", async (req, res, next) => {
  try {
    const project = await I.prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id) },
    });

    if (!project) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const source =
      project.authorid === res.locals.userid
        ? project.devsource
        : project.source;
    const projectFile = await getProjectFile(source);

    if (projectFile?.source) {
      res.status(200).send(projectFile.source);
    } else {
      res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
  } catch (err) {
    logger.error("Error fetching project source code:", err);
    next(err);
  }
});

// 删除作品
router.delete("/:id", async (req, res, next) => {
  try {
    await I.prisma.ow_projects.delete({
      where: { id: Number(req.params.id), authorid: res.locals.userid },
    });
    res.status(200).send({ status: "1", msg: "删除成功" });
  } catch (err) {
    logger.error("Error deleting project:", err);
    next(err);
  }
});

module.exports = router;
