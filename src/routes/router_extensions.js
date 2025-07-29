import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import { Router } from "express";
import { prisma } from "../services/global.js";
import { needLogin } from "../middleware/auth.js";
import { hasProjectPermission } from "../services/auth/permissionManager.js";

const router = Router();
let s3staticurl=await zcconfig.get("s3.staticurl");
async function validateBranchAndCommit(projectid, branch, commit, userid) {
  const project = await prisma.ow_projects.findFirst({
    where: { id: Number(projectid) },
  });

  if (!project) {
    throw new Error("项目不存在");
  }

  const hasPermission = await hasProjectPermission(projectid, userid, "read");
  if (!hasPermission) {
    throw new Error("无权访问该项目");
  }

  const targetBranch = branch || project.default_branch;

  const branchRecord = await prisma.ow_projects_branch.findFirst({
    where: {
      projectid: Number(projectid),
      name: targetBranch,
    },
  });

  if (!branchRecord) {
    throw new Error("分支不存在");
  }

  let targetCommit;
  if (!commit || commit === "latest") {
    //targetCommit = branchRecord.latest_commit_hash;
    targetCommit = "latest";
  } else {
    const commitRecord = await prisma.ow_projects_commits.findFirst({
      where: {
        id: commit,
        project_id: Number(projectid),
        branch: targetBranch,
      },
    });
    if (!commitRecord) {
      throw new Error("提交不存在");
    }
    targetCommit = commit;
  }

  return {
    project,
    branch: targetBranch,
    commit: targetCommit,
  };
}

router.post("/manager/create", needLogin, async (req, res, next) => {
  try {
    const { projectid, branch, commit, image, samples, docs, scratchCompatible } = req.body;

    if (!projectid) {
      return res.status(400).send({
        status: "error",
        message: "缺少项目ID",
      });
    }

    const project = await prisma.ow_projects.findFirst({
      where: {
        id: Number(projectid),
        authorid: res.locals.userid,
      },
    });

    if (!project) {
      return res.status(403).send({
        status: "error",
        message: "项目不存在或无权访问",
      });
    }

    const {
      project: validatedProject,
      branch: validatedBranch,
      commit: validatedCommit,
    } = await validateBranchAndCommit(
      projectid,
      branch,
      commit,
      res.locals.userid
    );

    let samplesProjectId = null;
    if (samples) {
      const samplesProject = await prisma.ow_projects.findFirst({
        where: {
          id: Number(samples),
          authorid: res.locals.userid,
        },
      });
      if (!samplesProject) {
        return res.status(400).send({
          status: "error",
          message: "示例项目不存在或无权访问",
        });
      }
      samplesProjectId = Number(samples);
    }

    const existingExtension = await prisma.ow_scratch_extensions.findFirst({
      where: { projectid: Number(projectid) },
    });

    if (existingExtension) {
      return res.status(400).send({
        status: "error",
        message: "该项目已存在扩展",
      });
    }

    const extension = await prisma.ow_scratch_extensions.create({
      data: {
        projectid: Number(projectid),
        branch: validatedBranch,
        commit: validatedCommit,
        image: image || "",
        samples: samplesProjectId,
        docs: docs || null,
        scratchCompatible: scratchCompatible || false,
        status: "developing",
      },
    });

    res.status(200).send({
      status: "success",
      message: "扩展创建成功",
      data: extension,
    });
  } catch (err) {
    logger.error("Error creating extension:", err);
    res.status(500).send({
      status: "error",
      message: err.message || "创建扩展时出错",
    });
  }
});

router.put("/manager/edit/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { branch, commit, image, samples, docs, scratchCompatible } = req.body;

    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      include: { project: true },
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }

    if (extension.project.authorid !== res.locals.userid) {
      return res.status(403).send({
        status: "error",
        message: "无权编辑该扩展",
      });
    }

    const updateData = {};

    if (branch !== undefined || commit !== undefined) {
      const { branch: validatedBranch, commit: validatedCommit } =
        await validateBranchAndCommit(
          extension.projectid,
          branch,
          commit,
          res.locals.userid
        );
      updateData.branch = validatedBranch;
      updateData.commit = validatedCommit;
    }

    if (image !== undefined) {
      updateData.image = image;
    }

    if (samples !== undefined) {
      if (samples) {
        const samplesProject = await prisma.ow_projects.findFirst({
          where: {
            id: Number(samples),
            authorid: res.locals.userid,
          },
        });
        if (!samplesProject) {
          return res.status(400).send({
            status: "error",
            message: "示例项目不存在或无权访问",
          });
        }
        updateData.samples = Number(samples);
      } else {
        updateData.samples = null;
      }
    }

    if (docs !== undefined) {
      updateData.docs = docs || null;
    }

    if (scratchCompatible !== undefined) {
      updateData.scratchCompatible = Boolean(scratchCompatible);
    }
    logger.debug(updateData);
    const updatedExtension = await prisma.ow_scratch_extensions.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.status(200).send({
      status: "success",
      message: "扩展更新成功",
      data: updatedExtension,
    });
  } catch (err) {
    logger.error("Error updating extension:", err);
    res.status(500).send({
      status: "error",
      message: err.message || "更新扩展时出错",
    });
  }
});

router.post("/manager/update/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      include: { project: true },
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }

    if (extension.project.authorid !== res.locals.userid) {
      return res.status(403).send({
        status: "error",
        message: "无权更新该扩展",
      });
    }

    // 如果当前commit已经是"latest"，则无需更新
    if (extension.commit === "latest") {
      return res.status(200).send({
        status: "success",
        message: "扩展已是最新提交",
        data: extension,
      });
    }

    // 获取当前分支的最新提交
    const branchRecord = await prisma.ow_projects_branch.findFirst({
      where: {
        projectid: extension.projectid,
        name: extension.branch,
      },
    });

    if (!branchRecord) {
      return res.status(400).send({
        status: "error",
        message: "无法获取分支最新提交",
      });
    }

    // 更新扩展的commit为最新提交
    const updatedExtension = await prisma.ow_scratch_extensions.update({
      where: { id: Number(id) },
      data: {
        commit: branchRecord.latest_commit_hash,
      },
    });

    res.status(200).send({
      status: "success",
      message: "扩展已更新到最新提交",
      data: updatedExtension,
    });
  } catch (err) {
    logger.error("Error updating extension commit:", err);
    res.status(500).send({
      status: "error",
      message: err.message || "更新扩展提交时出错",
    });
  }
});

router.post("/manager/submit/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;
    // 查找扩展及其项目作者
    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      include: { project: true },
    });
    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }
    if (extension.project.authorid !== res.locals.userid) {
      return res.status(403).send({
        status: "error",
        message: "无权提交该扩展",
      });
    }
    if (extension.status !== "developing") {
      return res.status(400).send({
        status: "error",
        message: "仅开发中的扩展可以提交审核",
      });
    }
    const updated = await prisma.ow_scratch_extensions.update({
      where: { id: Number(id) },
      data: { status: "pending" },
    });
    res.status(200).send({
      status: "success",
      message: "扩展已提交审核，待管理员审核",
      data: updated,
    });
  } catch (err) {
    logger.error("Error submitting extension for review:", err);
    res.status(500).send({
      status: "error",
      message: err.message || "提交扩展审核时出错",
    });
  }
});

router.get("/manager/my", needLogin, async (req, res, next) => {
  try {
    const extensions = await prisma.ow_scratch_extensions.findMany({
      where: {
        project: {
          authorid: res.locals.userid,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            title: true,
            description: true,
          },
        },
        sample_project: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
      },
    });

    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: extensions,
    });
  } catch (err) {
    logger.error("Error getting my extensions:", err);
    res.status(500).send({
      status: "error",
      message: "获取我的扩展时出错",
    });
  }
});

router.get("/manager/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      include: {
        project: {
          include: {
            author: {
              select: {
                username: true,
                display_name: true,
              },
            },
          },
        },
        sample_project: {
          include: {
            author: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }

    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: extension,
    });
  } catch (err) {
    logger.error("Error getting extension:", err);
    res.status(500).send({
      status: "error",
      message: "获取扩展时出错",
    });
  }
});

router.delete("/manager/:id", needLogin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      include: { project: true },
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }

    if (extension.project.authorid !== res.locals.userid) {
      return res.status(403).send({
        status: "error",
        message: "无权删除该扩展",
      });
    }

    await prisma.ow_scratch_extensions.delete({
      where: { id: Number(id) },
    });

    res.status(200).send({
      status: "success",
      message: "扩展删除成功",
    });
  } catch (err) {
    logger.error("Error deleting extension:", err);
    res.status(500).send({
      status: "error",
      message: "删除扩展时出错",
    });
  }
});

router.get("/marketplace", async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "created_at",
      order = "desc",
      search = "",
      category = "",
      author = "",
      has_docs = "",
      has_samples = "",
      tags = "",
      scratchCompatible = ""
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // 最大限制100
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    const where = {
      status: "verified"
    };

    // 构建项目查询条件
    const projectWhere = {};

    // 搜索条件
    if (search) {
      projectWhere.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { name: { contains: search } }
      ];
    }

    // 作者筛选
    if (author) {
      projectWhere.author = {
        username: { contains: author }
      };
    }

    // 标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tagArray.length > 0) {
        // tags字段是字符串，使用contains进行模糊匹配
        projectWhere.OR = projectWhere.OR || [];
        tagArray.forEach(tag => {
          projectWhere.OR.push({ tags: { contains: tag } });
        });
      }
    }

    // 如果有项目查询条件，添加到where中
    if (Object.keys(projectWhere).length > 0) {
      where.project = projectWhere;
    }

    // 文档筛选
    if (has_docs === "true") {
      where.docs = { not: null };
    } else if (has_docs === "false") {
      where.docs = null;
    }

    // 示例项目筛选
    if (has_samples === "true") {
      where.samples = { not: null };
    } else if (has_samples === "false") {
      where.samples = null;
    }

    // Scratch兼容性筛选
    if (scratchCompatible === "true") {
      where.scratchCompatible = true;
    } else if (scratchCompatible === "false") {
      where.scratchCompatible = false;
    }

    // 排序选项
    let orderBy = {};
    switch (sort) {
      case "created_at":
        orderBy.created_at = order;
        break;
      case "updated_at":
        orderBy.updated_at = order;
        break;
      case "stars":
        orderBy.project = { star_count: order };
        break;
      case "views":
        orderBy.project = { view_count: order };
        break;
      case "likes":
        orderBy.project = { like_count: order };
        break;
      case "name":
        orderBy.project = { title: order };
        break;
      case "author":
        orderBy.project = { author: { username: order } };
        break;
      case "popularity":
        // 综合排序：星标数 + 查看数 + 点赞数
        orderBy.project = {
          star_count: order,
          view_count: order,
          like_count: order
        };
        break;
      default:
        orderBy.created_at = "desc";
    }

    // 获取总数
    const total = await prisma.ow_scratch_extensions.count({ where });

    // 获取扩展列表
    const extensions = await prisma.ow_scratch_extensions.findMany({
      where,
      include: {
        project: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true
              }
            }
          }
        },
        sample_project: {
          include: {
            author: {
              select: {
                username: true,
                display_name: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limitNum
    });

    const frontendUrl = await zcconfig.get("urls.frontend");

    // 格式化返回数据
    const formattedExtensions = extensions.map(ext => ({
      id: ext.id,
      name: ext.project.title,
      description: ext.project.description,
      image: ext.image || `${s3staticurl}/scratch_slt/${ext.project.id}`,
      author: {
        id: ext.project.author.id,
        username: ext.project.author.username,
        display_name: ext.project.author.display_name,
        avatar: ext.project.author.avatar,
        profile_url: `${frontendUrl}/${ext.project.author.username}`
      },
      project: {
        id: ext.project.id,
        name: ext.project.name,
        url: `${frontendUrl}/${ext.project.author.username}/${ext.project.name}`,
        star_count: ext.project.star_count || 0,
        view_count: ext.project.view_count || 0,
        like_count: ext.project.like_count || 0,
        tags: ext.project.tags ? ext.project.tags.split(',').filter(tag => tag.trim()) : []
      },
      has_docs: !!ext.docs,
      docs_url: ext.docs,
      has_samples: !!ext.sample_project,
      sample_project: ext.sample_project ? {
        id: ext.sample_project.id,
        name: ext.sample_project.name,
        title: ext.sample_project.title,
        author: {
          username: ext.sample_project.author.username,
          display_name: ext.sample_project.author.display_name
        },
        url: `${frontendUrl}/${ext.sample_project.author.username}/${ext.sample_project.name}`
      } : null,
      scratchCompatible: ext.scratchCompatible,
      branch: ext.branch,
      commit: ext.commit,
      created_at: ext.created_at,
      updated_at: ext.updated_at
    }));

    res.status(200).send({
      status: "success",
      data: {
        extensions: formattedExtensions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
          has_next: pageNum < Math.ceil(total / limitNum),
          has_prev: pageNum > 1
        },
        filters: {
          search,
          category,
          author,
          has_docs,
          has_samples,
          tags,
          scratchCompatible
        },
        sort: {
          field: sort,
          order: order
        }
      }
    });
  } catch (err) {
    logger.error("Error getting marketplace extensions:", err);
    res.status(500).send({
      status: "error",
      message: "获取扩展市场时出错"
    });
  }
});

// 获取单个扩展详情
router.get("/marketplace/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const extension = await prisma.ow_scratch_extensions.findFirst({
      where: {
        id: Number(id),
        status: "verified"
      },
      select: {
        id: true,
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            tags: true,
            name: true,
            author: {
              select: {
                id: true,
                avatar: true,
                username: true,
                display_name: true
              }
            }
          }
        },
        sample_project: {
          select: {
            id: true,
            title: true,
            name: true,
            author: {
              select: {
                username: true,
                display_name: true
              }
            }
          }
        },
        docs: true,
        scratchCompatible: true,
        branch: true,
        commit: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在或未通过审核"
      });
    }

    res.status(200).send({
      status: "success",
      data: extension
    });
  } catch (err) {
    logger.error("Error getting extension detail:", err);
    res.status(500).send({
      status: "error",
      message: "获取扩展详情时出错"
    });
  }
});

// 获取扩展市场统计信息
router.get("/marketplace/stats", async (req, res, next) => {
  try {
    // 总扩展数
    const totalExtensions = await prisma.ow_scratch_extensions.count({
      where: { status: "verified" }
    });

    // 有文档的扩展数
    const extensionsWithDocs = await prisma.ow_scratch_extensions.count({
      where: {
        status: "verified",
        docs: { not: null }
      }
    });

    // 有示例的扩展数
    const extensionsWithSamples = await prisma.ow_scratch_extensions.count({
      where: {
        status: "verified",
        samples: { not: null }
      }
    });

    // Scratch兼容的扩展数
    const scratchCompatibleExtensions = await prisma.ow_scratch_extensions.count({
      where: {
        status: "verified",
        scratchCompatible: true
      }
    });

    // 最近7天新增的扩展数
    const recentExtensions = await prisma.ow_scratch_extensions.count({
      where: {
        status: "verified",
        created_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // 最活跃的作者（按扩展数量）
    const topAuthors = await prisma.ow_scratch_extensions.groupBy({
      by: ['project'],
      where: { status: "verified" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10
    });

    const authorStats = await Promise.all(
      topAuthors.map(async (item) => {
        const project = await prisma.ow_projects.findFirst({
          where: { id: item.project.projectid },
          include: {
            author: {
              select: {
                username: true,
                display_name: true
              }
            }
          }
        });
        return {
          author: project.author,
          extension_count: item._count.id
        };
      })
    );

    res.status(200).send({
      status: "success",
      data: {
        total_extensions: totalExtensions,
        extensions_with_docs: extensionsWithDocs,
        extensions_with_samples: extensionsWithSamples,
        scratchCompatible_extensions: scratchCompatibleExtensions,
        recent_extensions: recentExtensions,
        top_authors: authorStats
      }
    });
  } catch (err) {
    logger.error("Error getting marketplace stats:", err);
    res.status(500).send({
      status: "error",
      message: "获取市场统计时出错"
    });
  }
});

router.get("/", async (req, res, next) => {
  try {
    const frontendUrl = await zcconfig.get("urls.frontend");

    const extensions = await prisma.ow_scratch_extensions.findMany({
      where: { status: "verified" },
      include: {
        project: {
          include: {
            author: {
              select: {
                username: true,
                display_name: true,
              },
            },
          },
        },
        sample_project: {
          include: {
            author: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    const formattedExtensions = extensions.map((ext) => {
      const result = {
        slug: String(ext.id),
        id: String(ext.id),
        name: ext.project.title,
        description: ext.project.description,
        image: `${s3staticurl}/scratch_slt/${ext.project.id}`,
        by: [
          {
            name: ext.project.author.display_name,
            link: `${frontendUrl}/${ext.project.author.username}`,
          },
        ],
      };

      if (ext.sample_project) {
        result.samples = [
          `${ext.sample_project.author.username}/${ext.sample_project.name}`,
        ];
      }

      if (ext.docs) {
        result.docs = true;
      }

      if (ext.scratchCompatible) {
        result.scratchCompatible = true;
      }

      return result;
    });

    res.status(200).send({
      extensions: formattedExtensions,
    });
  } catch (err) {
    logger.error("Error listing extensions:", err);
    res.status(500).send({
      status: "error",
      message: "获取扩展列表时出错",
    });
  }
});
router.get("/{:id}.js", async (req, res, next) => {
  try {
    const { id } = req.params;
    let extension = await prisma.ow_scratch_extensions.findFirst({
      where: { id: Number(id) },
      select: {
        status: true,
        branch: true,
        commit: true,
        project: {
          select: {
            id: true,
            default_branch: true,
          },
        },
      },
    });
    if (extension.status !== "verified"&&extension.status !== "approved") {
      return res.status(404).send({
        status: "error",
        message: "扩展未审核",
      });
    }
    if (extension.branch == "") {
      extension.branch = extension.project.default_branch;
    }
    if (extension.commit == "latest") {
      const branchRecord = await prisma.ow_projects_branch.findFirst({
        where: {
            projectid: extension.project.id,
            name: extension.branch,
          },
        });
        if (branchRecord) {
            extension.commit = branchRecord.latest_commit_hash;
        }
    }
    const commitRecord = await prisma.ow_projects_commits.findFirst({
      where: {
        id: extension.commit,
        project_id: extension.project.id,
        branch: extension.branch,
      },
    });
    if (!commitRecord) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }
    logger.debug(commitRecord);
    const file=await prisma.ow_projects_file.findFirst({
      where: {
        sha256: commitRecord.commit_file,
      },
    });
    if (!file) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
      });
    }
    res.contentType("text/plain");
    res.status(200).send(file.source);
  } catch (err) {
    logger.error("Error getting extension:", err);
    res.status(500).send({
      status: "error",
      message: "获取扩展时出错",
    });
  }
});
router.get("/{:id}", async (req, res, next) => {
  try {
    const { id } = req.params;
    const frontendUrl = await zcconfig.get("urls.frontend");
    res.redirect(`${frontendUrl}/app/extensions/${id}`);
  } catch (err) {
    logger.error("Error getting extension:", err);
  }
});
export default router;
