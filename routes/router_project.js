import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import { Router } from "express";
import { prisma } from "../services/global.js";
import default_project from "../src/default_project.js";
import {
  extractProjectData,
  projectSelectionFields,
  authorSelectionFields,
  handleTagsChange,
} from "../controllers/projects.js";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import {
  generateFileAccessToken,
  verifyFileAccessToken,
} from "../services/auth/tokenManager.js";
import { needLogin } from "../middleware/auth.js";
import { hasProjectPermission } from "../services/auth/permissionManager.js";
import { getUserByUsername } from "../controllers/users.js";
import { createEvent } from "../controllers/events.js";
import { getAnalytics } from "../services/analytics.js";

const router = Router();

// 中间件，确保所有请求均经过该处理

// 抽离的函数
async function checkProjectPermission(projectid, userid, permission) {
  const hasPermission = await hasProjectPermission(
    projectid,
    userid,
    permission
  );
  if (!hasPermission) {
    throw new Error("无权访问此项目");
  }
}

async function createBranchIfNotExists(projectid, branch, userid) {
  let branchRecord = await prisma.ow_projects_branch.findFirst({
    where: { projectid: Number(projectid), name: branch },
  });
  if (!branchRecord) {
    branchRecord = await prisma.ow_projects_branch.create({
      data: {
        projectid: Number(projectid),
        name: branch,
        creator: userid,
        description: "",
      },
    });
  }
  return branchRecord;
}

async function getCommitParentId(projectid, userid, parent_commit) {
  let parent_commit_id = null;
  if (/^[a-fA-F0-9]{64}$/.test(parent_commit)) {
    parent_commit_id = parent_commit;
  } else {
    const latestCommit = await prisma.ow_projects_commits.findFirst({
      where: { project_id: Number(projectid), author_id: userid },
      orderBy: { commit_date: "desc" },
    });
    parent_commit_id = latestCommit ? latestCommit.id : null;
  }
  return parent_commit_id;
}

async function updateBranchLatestCommit(projectid, branch, commitId) {
  await prisma.ow_projects_branch.update({
    where: {
      projectid_name: {
        // 使用复合唯一索引
        projectid: Number(projectid),
        name: branch,
      },
    },
    data: {
      latest_commit_hash: commitId,
    },
  });
}

// 创建新作品
router.post("/", needLogin, async (req, res, next) => {
  try {
    const existingProject = await prisma.ow_projects.findFirst({
      where: {
        authorid: res.locals.userid,
        name: req.body.name,
      },
    });

    if (existingProject) {
      return res.status(200).send({
        status: "error",
        message: "作品名称被占用",
      });
    }

    const outputJson = {
      type: req.body.type || "scratch",
      authorid: res.locals.userid,
      title: req.body.title || "新建作品",
      name: req.body.name,
      state: req.body.state || "public",
      description: req.body.description || "",
      license: req.body.license || "None",
    };

    const result = await prisma.ow_projects.create({ data: outputJson });

    // 根据项目状态决定事件是否公开
    const isPrivate = outputJson.state === "private";

    await createEvent(
      "project_create",
      res.locals.userid,
      "project",
      result.id,
      {
        event_type: "project_create",
        actor_id: res.locals.userid,
        target_type: "project",
        target_id: Number(result.id),
        project_name: result.name,
        project_type: result.type,
        project_title: result.title,
        project_description: result.description,
        project_state: result.state,
      },
      isPrivate // 传入是否强制私密
    );

    res.status(200).send({
      status: "success",
      message: "保存成功",
      id: result.id,
    });
  } catch (err) {
    logger.error("Error creating new project:", err);
    res.status(500).send({
      status: "error",
      message: "创建新作品时出错",
    });
  }
});

// 保存源代码
router.post("/savefile", needLogin, async (req, res, next) => {
  try {
    let source;
    if (req.is("multipart/form-data")) {
      source = req.body.source;
    } else if (req.is("application/json")) {
      source = req.body;
    } else if (req.is("application/x-www-form-urlencoded")) {
      source = req.body.source;
    } else {
      return res.status(400).send({
        status: "error",
        message: "无效的内容类型",
      });
    }

    if (typeof source === "object") {
      try {
        source = JSON.stringify(source);
      } catch (err) {
        logger.error("Error stringifying source code:", err);
        return res.status(400).send({
          status: "error",
          message: "无效的源代码格式",
        });
      }
    } else if (typeof source !== "string") {
      source = String(source);
    }

    const sha256 = createHash("sha256").update(source).digest("hex");
    logger.debug(sha256);

    await prisma.ow_projects_file
      .create({
        data: {
          sha256,
          source,
          create_userid: res.locals.userid,
        },
      })
      .catch((err) => {
        if (err.code === "P2002") {
          logger.debug("File already exists, skipping.");
        } else {
          logger.error(err);
          return res.status(500).send({
            status: "error",
            message: "保存源代码时出错",
          });
        }
      });

    const accessFileToken = await generateFileAccessToken(
      sha256,
      res.locals.userid
    );
    res.status(200).send({
      status: "success",
      message: "保存成功",
      accessFileToken,
    });
  } catch (err) {
    logger.error("Error saving source code:", err);
    res.status(500).send({
      status: "error",
      message: "保存源代码时出错",
    });
  }
});

// 获取项目文件 放最后最后匹配免得冲突
router.get("/commit", async (req, res, next) => {
  try {
    const { projectid, commitid } = req.query;
    const userId = res.locals.userid || 0; // 未登录用户为匿名用户
    const hasPermission = await hasProjectPermission(projectid, userId, "read");

    if (!hasPermission) {
      return res.status(200).send({
        status: "error",
        message: "项目不存在或无权访问",
        code: "404",
      });
    }

    let commit;

    commit = await prisma.ow_projects_commits.findFirst({
      where: { project_id: Number(projectid), id: commitid },
    });

    if (!commit) {
      return res.status(200).send({
        status: "error",
        message: "获取失败",
        commit: {
          error_code: "no_commit",
          commit_message: "No commit found",
        },
      });
    }

    const accessFileToken = await generateFileAccessToken(
      commit.commit_file,
      userId
    );

    res.status(200).send({
      status: "success",
      message: "获取成功",
      commit,
      accessFileToken,
    });
  } catch (err) {
    logger.error("Error fetching project file:", err);
    next(err);
  }
});
// 提交代码
router.put("/commit/id/:id", needLogin, async (req, res, next) => {
  try {
    const {
      branch = "main",
      projectid,
      accessFileToken,
      message = "edit",
      parent_commit,
      commit_description,
    } = req.body;

    if (!projectid || !accessFileToken) {
      return res.status(400).send({
        status: "error",
        message: "缺少必要的参数",
      });
    }

    // 验证项目权限
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(projectid) },
    });
    if (!project) {
      return res.status(403).send({
        status: "error",
        message: "项目不存在",
      });
    }

    if (project.authorid !== res.locals.userid) {
      return res.status(403).send({
        status: "error",
        message: "无权提交此项目",
      });
    }

    const decodedFileToken = jwt.verify(
      accessFileToken,
      await zcconfig.get("security.jwttoken")
    );
    logger.debug(decodedFileToken);
    if (!decodedFileToken) {
      return res.status(200).send({
        status: "error",
        message: "无效的文件访问令牌 #2",
      });
    }

    const { sha256, type, action, userid } = decodedFileToken.data;
    if (decodedFileToken.type !== "file" || action !== "read" || Number(userid) !== Number(res.locals.userid)) {

      return res.status(200).send({
        status: "error",
        message: "无效的文件访问令牌 #1",
      });
    }

    // 检查分支是否存在，不存在则创建
    await createBranchIfNotExists(projectid, branch, res.locals.userid);

    const parent_commit_id = await getCommitParentId(
      projectid,
      res.locals.userid,
      parent_commit
    );
    const timestamp = Date.now();
    // 计算提交的哈希值作为 id
    const commitContent = JSON.stringify({
      userid: res.locals.userid,
      project_id: Number(projectid),
      source_sha256: sha256,
      commit_message: message,
      parent_commit: parent_commit_id,
      commit_description: commit_description,
      timestamp,
    });
    const commitId = createHash("sha256").update(commitContent).digest("hex");

    const result = await prisma.ow_projects_commits.create({
      data: {
        id: commitId,
        project_id: Number(projectid),
        author_id: res.locals.userid,
        branch,
        commit_file: sha256,
        commit_message: message,
        commit_description: commit_description,
        parent_commit_id,
        commit_date: new Date(timestamp),
      },
    });

    await updateBranchLatestCommit(projectid, branch, commitId);

    // 根据项目状态决定事件是否公开
    const isPrivate = project.state === "private";

    // 创建提交事件，添加更多项目信息
    await createEvent(
      "project_commit",
      res.locals.userid,
      "project",
      Number(projectid),
      {
        event_type: "project_commit",
        actor_id: res.locals.userid,
        target_type: "project",
        target_id: Number(projectid),
        commit_id: commitId,
        commit_message: message,
        branch: branch,
        commit_file: sha256,
        // 添加项目相关信息
        project_name: project.name,
        project_title: project.title,
        project_type: project.type,
        project_description: project.description,
        project_state: project.state,
      },
      isPrivate // 传入是否强制私密
    );

    res.status(200).send({
      status: "success",
      message: "保存成功",
      data: result,
    });
  } catch (err) {
    logger.error("Error saving source code:", err);
    res.status(500).send({
      status: "error",
      message: "提交代码时出错",
    });
  }
});

// 批量获取项目信息
router.post("/batch", async (req, res, next) => {
  try {
    const { projectIds } = req.body;
    if (!Array.isArray(projectIds)) {
      return res.status(400).send({
        status: "error",
        message: "无效的项目ID数组",
      });
    }

    const userId = res.locals.userid || 0; // 未登录用户为匿名用户

    // 获取所有项目
    const projects = await prisma.ow_projects.findMany({
      where: { id: { in: projectIds } },
      select: projectSelectionFields()
    });

    // 并行化权限检查
    const projectsWithPermission = await Promise.all(
      projects.map(async (project) => {
        const hasPermission = await hasProjectPermission(
          project.id,
          userId,
          "read"
        );
        return hasPermission ? project : null;
      })
    );

    // 过滤掉没有权限的项目
    const filteredProjects = projectsWithPermission.filter(
      (project) => project !== null
    );

    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: filteredProjects,
    });
  } catch (err) {
    logger.error("Error fetching batch project information:", err);
    res.status(500).send({
      status: "error",
      message: "批量获取项目信息时出错",
    });
  }
});

router.get("/branches", async (req, res, next) => {
  try {
    const { projectid } = req.query;
    await checkProjectPermission(projectid, res.locals.userid, "read");

    const result = await prisma.ow_projects_branch.findMany({
      where: { projectid: Number(projectid) },
      select: {
        id: true,
        name: true,
        description: true,
        latest_commit_hash: true,
      },
    });
    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: result,
    });
  } catch (err) {
    logger.error("Error getting project information:", err);
    next(err);
  }
});
router.get("/commits", async (req, res, next) => {
  try {
    const { projectid } = req.query;
    await checkProjectPermission(projectid, res.locals.userid, "read");

    const result = await prisma.ow_projects_commits.findMany({
      where: { project_id: Number(projectid) },
      orderBy: { commit_date: "desc" },
    });
    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: result,
    });
  } catch (err) {
    logger.debug("Error getting project information:", err);
    next(err);
  }
});

router.post("/branches", async (req, res, next) => {
  try {
    const { name, branch, projectid } = req.body;
    await checkProjectPermission(projectid, res.locals.userid, "read");
    const result = await prisma.ow_projects_commits.findFirst({
      where: { project_id: Number(projectid), branch },
      orderBy: { commit_date: "desc" },
    });
    const timestamp = Date.now();
    const commitContent = JSON.stringify({
      userid: res.locals.userid,
      project_id: Number(projectid),
      source_sha256: result.commit_file,
      commit_message: result.commit_message,
      parent_commit: result.parent_commit_id,
      timestamp: timestamp,
    });
    const commitId = createHash("sha256").update(commitContent).digest("hex");
    await prisma.ow_projects_commits.create({
      data: {
        id: commitId,
        project_id: Number(projectid),
        author_id: res.locals.userid,
        branch: name,
        commit_file: result.commit_file,
        commit_message: result.commit_message,
        parent_commit_id: result.parent_commit_id,
        commit_date: new Date(timestamp),
      },
    });
    await prisma.ow_projects_branch.create({
      data: {
        projectid: Number(projectid),
        name: name,
        description: "",
        latest_commit_hash: commitId,
      },
    });

    res.status(200).send({
      status: "success",
      message: "创建成功",
      data: result,
    });
  } catch (err) {
    logger.error("Error getting project information:", err);
    next(err);
  }
});
router.get("/commits", async (req, res, next) => {
  try {
    const { projectid } = req.query;
    await checkProjectPermission(projectid, res.locals.userid, "read");

    const result = await prisma.ow_projects_commits.findMany({
      where: { project_id: Number(projectid) },
    });
    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: result,
    });
  } catch (err) {
    logger.debug("Error getting project information:", err);
    next(err);
  }
});
// 获取项目信息
router.get("/id/:id", async (req, res, next) => {
  const userId = res.locals.userid || 0; // 未登录用户为匿名用户
  await checkProjectPermission(req.params.id, userId, "read");

  const project = await prisma.ow_projects.findFirst({
    where: { id: Number(req.params.id) },
    select: projectSelectionFields(),
  });

  const author = await prisma.ow_users.findFirst({
    where: { id: Number(project.authorid) },
    select: authorSelectionFields(),
  });

  const tags = await prisma.ow_projects_tags.findMany({
    where: { projectid: Number(req.params.id) },
    select: { name: true, id: true, created_at: true },
  });

  project.author = author;
  project.tags = tags;
  logger.debug(tags);
  logger.debug(project);
  res.status(200).send(project);
});

// 更新作品信息
router.put("/id/:id", needLogin, async (req, res, next) => {
  try {
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id), authorid: res.locals.userid },
    });

    if (!project) {
      return res.status(404).send({
        status: "error",
        message: "项目不存在或无权访问",
      });
    }

    const updatedData = extractProjectData(req.body);
    await prisma.ow_projects.update({
      where: { id: Number(req.params.id), authorid: Number(res.locals.userid) },
      data: updatedData,
    });

    // 处理标签
    if (req.body.tags) {
      await handleTagsChange(Number(req.params.id), req.body.tags);
    }

    // 收集变更的字段信息
    const changes = {
      updated_fields: [],
      old_values: {},
      new_values: {},
    };

    // 必须记录的字段
    ["title", "type", "state"].forEach((field) => {
      if (updatedData[field] !== undefined) {
        changes.updated_fields.push(field);
        changes.old_values[field] = project[field];
        changes.new_values[field] = updatedData[field];
      }
    });

    // 其他可能变更的字段
    ["description", "license", "tags"].forEach((field) => {
      if (
        updatedData[field] !== undefined &&
        updatedData[field] !== project[field]
      ) {
        changes.updated_fields.push(field);
        changes.old_values[field] = project[field];
        changes.new_values[field] = updatedData[field];
      }
    });

    // 创建项目信息更新事件
    await createEvent(
      "project_info_update",
      res.locals.userid,
      "project",
      Number(req.params.id),
      {
        updated_fields: changes.updated_fields,
        old_values: changes.old_values,
        new_values: changes.new_values,
        // 基本项目信息
        project_name: project.name,
        project_title: updatedData.title || project.title,
        project_type: updatedData.type || project.type,
        project_description: updatedData.description || project.description,
        project_state: updatedData.state || project.state,
      },
      project.state === "private" // 根据项目状态决定是否私密
    );

    res.status(200).send({
      status: "success",
      message: "保存成功",
    });
  } catch (err) {
    logger.error("Error updating project information:", err);
    next(err);
  }
});

// 根据 authorname 和 projectname 获取项目
router.get("/namespace/:authorname/:projectname", async (req, res, next) => {
  try {
    const { authorname, projectname } = req.params;
    const userId = res.locals.userid || 0; // 未登录用户为匿名用户

    const author = await getUserByUsername(authorname);
    if (!author) {
      return res.status(404).send({
        status: "error",
        message: "用户不存在",
      });
    }

    const project = await prisma.ow_projects.findFirst({
      where: {
        authorid: author.id,
        name: projectname,
      },
      select: projectSelectionFields(),
    });

    if (!project) {
      return res.status(404).send({
        status: "error",
        message: "项目不存在",
      });
    }

    await checkProjectPermission(project.id, userId, "read");

    const tags = await prisma.ow_projects_tags.findMany({
      where: { projectid: project.id },
      select: { name: true, id: true, created_at: true },
    });

    project.author = author;
    project.tags = tags;
    logger.debug(tags);
    logger.debug(project);
    res.status(200).send(project);
  } catch (err) {
    logger.error("Error fetching project by authorname and projectname:", err);
    res.status(404).send({
      status: "error",
      message: "找不到页面",
    });
  }
});

// 根据文件哈希读取文件
router.get("/files/:sha256", async (req, res, next) => {
  try {
    const { sha256 } = req.params;
    const { accessFileToken } = req.query;
    const userId = res.locals.userid || 0; // 未登录用户为匿名用户
    const content = req.query.content;
    try {
      await verifyFileAccessToken(accessFileToken, userId);
    } catch (err) {
      logger.error("Error verifying file access token:", err);
      return res.status(200).send({
        status: "error",
        message: "无效的文件访问令牌 #3",
      });
    }

    const file = await prisma.ow_projects_file.findFirst({
      where: { sha256 },
    });

    if (!file) {
      return res.status(200).send({
        status: "error",
        message: "文件不存在",
      });
    }
    if (content == "true") {
      res.status(200).send(file.source);
    } else {
      res.status(200).send({
        status: "success",
        message: "获取成功",
        file,
      });
    }
  } catch (err) {
    logger.error("Error fetching file by hash:", err);
    next(err);
  }
});

// 删除作品
router.delete("/:id", async (req, res, next) => {
  try {
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(req.params.id), authorid: res.locals.userid },
    });

    if (project) {
      await prisma.ow_projects.delete({
        where: { id: Number(req.params.id), authorid: res.locals.userid },
      });

      // Create project deletion event
      await createEvent(
        "project_delete",
        res.locals.userid,
        "project",
        Number(req.params.id),
        {
          event_type: "project_delete",
          actor_id: res.locals.userid,
          target_type: "project",
          target_id: Number(req.params.id),
          project_name: project.name,
          project_type: project.type,
          project_title: project.title,
        }
      );
    }

    res.status(200).send({
      status: "success",
      message: "删除成功",
    });
  } catch (err) {
    logger.error("Error deleting project:", err);
    next(err);
  }
});

// 初始化项目
router.post("/initlize", needLogin, async (req, res, next) => {
  if (!res.locals.userid) {
    return res.status(200).send({
      status: "error",
      message: "未登录",
      code: "AUTH_ERROR_LOGIN",
    });
  }

  try {
    const { projectid } = req.query;
    await checkProjectPermission(projectid, res.locals.userid, "write");

    // 检查项目是否在任何分支都没有任何提交
    const commitCount = await prisma.ow_projects_commits.count({
      where: { project_id: Number(projectid) },
    });
    if (commitCount > 0) {
      return res.status(400).send({
        status: "error",
        message: "项目已存在提交或不存在",
      });
    }

    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(projectid) },
    });
    // 获取默认作品
    const defaultSource = default_project[project.type];
    if (!defaultSource) {
      return res.status(200).send({
        status: "error",
        message: "默认作品不存在",
      });
    }
    //先创建时间戳
    const timestamp = new Date();
    // 计算提交的哈希值作为 id
    const commitContent = JSON.stringify({
      userid: res.locals.userid,
      project_id: Number(projectid),
      project_branch: "main",
      source_sha256: defaultSource,
      commit_message: "初始化提交",
      parent_commit: null,
      timestamp: timestamp,
    });
    const commitId = createHash("sha256").update(commitContent).digest("hex");

    // 创建分支记录
    await prisma.ow_projects_branch.create({
      data: {
        projectid: Number(projectid),
        latest_commit_hash: commitId,
        name: "main",
        creator: res.locals.userid,
        description: "默认分支",
      },
    });

    // 创建提交记录
    const result = await prisma.ow_projects_commits.create({
      data: {
        id: commitId,
        project_id: Number(projectid),
        author_id: res.locals.userid,
        branch: "main",
        commit_file: defaultSource,
        commit_message: "初始化提交",
        parent_commit_id: null,
        commit_date: new Date(timestamp), // 使用 Date 对象
        commit_description: "# 初始化提交",
      },
    });
    await prisma.ow_projects.update({
      where: { id: Number(projectid) },
      data: {
        default_branch: "main",
      },
    });
    res.status(200).send({
      status: "success",
      message: "初始化成功",
      data: result,
    });
  } catch (err) {
    logger.error("Error initializing project:", err);
    next(err);
  }
});

// 重命名项目
router.put("/rename/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).send({
        status: "error",
        message: "缺少必要的参数",
      });
    }

    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(id), authorid: res.locals.userid },
    });

    if (!project) {
      return res.status(404).send({
        status: "error",
        message: "项目不存在或无权访问",
      });
    }

    const existingProject = await prisma.ow_projects.findFirst({
      where: { name: newName, authorid: res.locals.userid },
    });

    if (existingProject) {
      return res.status(200).send({
        status: "error",
        message: "项目名称已存在",
      });
    }

    await prisma.ow_projects.update({
      where: { id: Number(id) },
      data: { name: newName },
    });

    // 创建重命名事件
    await createEvent(
      "project_rename",
      res.locals.userid,
      "project",
      Number(id),
      {
        event_type: "project_rename",
        actor_id: res.locals.userid,
        target_type: "project",
        target_id: Number(id),
        old_name: project.name,
        new_name: newName,
        project_title: project.title,
        project_type: project.type,
        project_state: project.state,
      },
      project.state === "private" // 根据项目状态决定是否私密
    );

    res.status(200).send({
      status: "success",
      message: "重命名成功",
    });
  } catch (err) {
    logger.error("Error renaming project:", err);
    next(err);
  }
});

// 重命名项目
router.put("/changevisibility/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newState } = req.body;

    if (!newState || (newState !== "public" && newState !== "private")) {
      return res.status(400).send({
        status: "error",
        message: "缺少必要的参数",
      });
    }

    await prisma.ow_projects
      .update({
        where: { id: Number(id), authorid: res.locals.userid },
        data: { state: newState },
      })
      .catch((err) => {
        return res.status(400).send({
          status: "error",
          message: "无权操作",
        });
      })
      .then((result) => {
        res.status(200).send({
          status: "success",
          message: "操作成功",
        });
      });
  } catch (err) {
    logger.error("Error renaming project:", err);
    next(err);
  }
});

// 修改分支简介
router.post("/branches/description", needLogin, async (req, res, next) => {
  try {
    const { projectid, branch } = req.query;
    const { description } = req.body;

    if (!description) {
      return res.status(400).send({
        status: "error",
        message: "缺少必要的参数",
      });
    }

    await checkProjectPermission(projectid, res.locals.userid, "write");

    const branchRecord = await prisma.ow_projects_branch.findFirst({
      where: { projectid: Number(projectid), name: branch },
    });

    if (!branchRecord) {
      return res.status(404).send({
        status: "error",
        message: "分支不存在",
      });
    }

    await prisma.ow_projects_branch.update({
      where: { id: branchRecord.id },
      data: { description },
    });

    res.status(200).send({
      status: "success",
      message: "分支简介更新成功",
    });
  } catch (err) {
    logger.error("Error updating branch description:", err);
    next(err);
  }
});

router.post("/fork", needLogin, async (req, res, next) => {
  const { projectid, branch, name } = req.body;

  try {
    await checkProjectPermission(projectid, res.locals.userid, "read");

    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(projectid) },
    });

    if (!project) {
      return res.status(404).send({
        status: "error",
        message: "项目不存在",
      });
    }
    console.log(res.locals.userid);
    const existingProject = await prisma.ow_projects.findMany({
      where: {
        authorid: res.locals.userid,
        name: name,
      },
    });
    logger.debug(existingProject);
    if (existingProject.length > 0) {
      return res.status(200).send({
        status: "error",
        message: "同名项目已存在",
      });
    }

    let branches;
    if (branch == "all") {
      branches = await prisma.ow_projects_branch.findMany({
        where: { projectid: Number(projectid) },
      });
    } else {
      branches = [
        await prisma.ow_projects_branch.findFirst({
          where: { projectid: Number(projectid), name: project.default_branch },
        }),
      ];
    }
    if (branches.length == 0) {
      return res.status(404).send({
        status: "error",
        message: "分支不存在",
      });
    }
    const forkedProject = await prisma.ow_projects.create({
      data: {
        name: name,
        type: project.type,
        state: project.state,
        license: project.license,
        authorid: res.locals.userid,
        title: project.title,
        description: project.description,
        fork: projectid,
        default_branch: project.default_branch,
      },
    });

    await Promise.all(
      branches.map((branch) => {
        return prisma.ow_projects_branch.create({
          data: {
            projectid: forkedProject.id,
            name: branch.name,
            creator: res.locals.userid,
            latest_commit_hash: branch.latest_commit_hash,
            description: branch.description,
            protected: branch.protected,
          },
        });
      })
    );


    res.status(200).send({
      status: "success",
      message: "项目已成功分叉",
    });
    // 根据原项目和新项目的状态决定事件是否公开
    const isPrivate =
      project.state === "private" || forkedProject.state === "private";
    logger.error(project)
    await createEvent(
      "project_fork",
      res.locals.userid,
      "project",
      Number(forkedProject.id),
      {NotificationTo: [project.authorid]},
      isPrivate
    );
  } catch (err) {
    logger.error("Error forking project:", err);
    res.status(500).send({
      status: "error",
      message: "服务器内部错误",
    });
  }
});

// 获取项目文件 放最后最后匹配免得冲突
router.get("/:id/:branch/:ref", async (req, res, next) => {
  try {
    const { id, branch, ref } = req.params;
    const userId = res.locals.userid || 0; // 未登录用户为匿名用户
    const hasPermission = await hasProjectPermission(id, userId, "read");

    if (!hasPermission) {
      return res.status(200).send({
        status: "error",
        message: "项目不存在或无权访问",
        code: "404",
      });
    }

    let commit;
    if (ref === "latest") {
      commit = await prisma.ow_projects_commits.findFirst({
        where: { project_id: Number(id), branch },
        orderBy: { commit_date: "desc" },
      });
    } else {
      commit = await prisma.ow_projects_commits.findFirst({
        where: { id: ref, project_id: Number(id), branch },
      });
    }

    if (!commit) {
      const project = await prisma.ow_projects.findFirst({
        where: { id: Number(id) },
      });
      const defaultSource = default_project[project.type];
      if (!defaultSource) {
        return res.status(200).send({
          status: "error",
          message: "默认作品不存在",
        });
      }

      return res.status(200).send({
        status: "error",
        message: "无有效提交",
        commit: {
          error_code: "NoFirstCommit",
          commit_message: "仓库无有效提交",
        },
      });
    }

    const accessFileToken = await generateFileAccessToken(
      commit.commit_file,
      userId
    );

    res.status(200).send({
      status: "success",
      message: "获取成功",
      commit,
      accessFileToken,
    });
  } catch (err) {
    logger.error("Error fetching project file:", err);
    next(err);
  }
});

// 获取项目分析数据
router.get("/analytics/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // 验证日期格式
    if (!start_date || !end_date || !Date.parse(start_date) || !Date.parse(end_date)) {
      return res.status(400).send({
        status: "error",
        message: "无效的日期格式",
      });
    }

    // 验证项目权限
    const hasPermission = await hasProjectPermission(id, res.locals.userid, "read");
    if (!hasPermission) {
      return res.status(403).send({
        status: "error",
        message: "无权访问此项目",
      });
    }

    const analytics = await getAnalytics("project", Number(id), start_date, end_date);

    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: analytics,
    });
  } catch (err) {
    logger.error("Error fetching project analytics:", err);
    next(err);
  }
});

export default router;
