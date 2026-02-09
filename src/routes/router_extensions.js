import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { needLogin } from "../middleware/auth.js";
import { hasProjectPermission } from "../services/auth/permissionManager.js";
import { setReviewStatus, isAutoApproveUser } from "../services/extensionReview.js";

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

    // Check if user is in auto-approve list
    const user = await prisma.ow_users.findUnique({
      where: { id: res.locals.userid },
      select: { username: true },
    });
    if (user && await isAutoApproveUser(user.username)) {
      await setReviewStatus(projectid, "approved");
      await prisma.ow_scratch_extensions.update({
        where: { id: extension.id },
        data: { status: "verified" },
      });
      extension.status = "verified";
    }

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

    // Check if user is in auto-approve list
    const user = await prisma.ow_users.findUnique({
      where: { id: res.locals.userid },
      select: { username: true },
    });
    const autoApproved = user && await isAutoApproveUser(user.username);

    if (autoApproved) {
      await setReviewStatus(extension.projectid, "approved");
      const updated = await prisma.ow_scratch_extensions.update({
        where: { id: Number(id) },
        data: { status: "verified" },
      });
      return res.status(200).send({
        status: "success",
        message: "扩展已自动通过审核",
        data: updated,
      });
    }

    await setReviewStatus(extension.projectid, "pending");
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
            authorid: true,
            author: {
              select: { id: true, username: true, display_name: true, avatar: true },
            },
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


// 统一的单个扩展详情查询接口 - 支持查询公开扩展和用户自己的扩展
router.get("/detail/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scope = "public" } = req.query;

    // 构建查询条件
    const where = { id: Number(id) };


    const extension = await prisma.ow_scratch_extensions.findFirst({
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
      }
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: scope === "public" ? "扩展不存在或未通过审核" : "扩展不存在"
      });
    } if (extension.status !== "verified" && scope === "public"&&extension.project.author.id!== res.locals.userid) {
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

// 统一的单个扩展详情查询接口 - 支持查询公开扩展和用户自己的扩展
router.get("/detailbyprojectid/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // 构建查询条件



    const extension = await prisma.ow_scratch_extensions.findFirst({
      where:{
        projectid: Number(id)
      },
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
      }
    });

    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: scope === "public" ? "扩展不存在或未通过审核" : "扩展不存在"
      });
    }
    if (extension.status !== "verified" &&extension.project.author.id!== res.locals.userid) {
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

// 批量扩展详情查询接口 - 仅返回可见扩展信息，并标记是否已验证
router.post("/detail/batch", needLogin, async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send({
        status: "error",
        message: "缺少扩展ID列表",
      });
    }

    const numericIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    if (numericIds.length === 0) {
      return res.status(400).send({
        status: "error",
        message: "扩展ID列表无效",
      });
    }

    const extensions = await prisma.ow_scratch_extensions.findMany({
      where: { id: { in: numericIds } },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            title: true,
            description: true,
            authorid: true,
            author: {
              select: { id: true, username: true, display_name: true, avatar: true },
            },
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

    const extensionMap = new Map(
      extensions.map((ext) => [ext.id, ext])
    );

    const data = numericIds.map((id) => {
      const ext = extensionMap.get(id);
      if (!ext) {
        return { id, exists: false, verified: false };
      }

      const isVerified = ext.status === "verified";

      return {
        id,
        exists: true,
        verified: isVerified,
        data: ext,
      };
    });

    res.status(200).send({
      status: "success",
      data,
    });
  } catch (err) {
    logger.error("Error getting batch extension detail:", err);
    res.status(500).send({
      status: "error",
      message: "批量获取扩展详情时出错",
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
      logger.debug(ext)
      const result = {
        slug: String(ext.id),
        id: String(ext.id),
        name: ext.project.title,
        description: ext.project.description,
        image: `${s3staticurl}/assets/${ext.project.thumbnail.substring(0, 2)}/${ext.project.thumbnail.substring(2, 4)}/${ext.project.thumbnail}`,
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
    if (!extension) {
      return res.status(404).send({
        status: "error",
        message: "扩展不存在",
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
