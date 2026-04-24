import { prisma } from "../prisma.js";
import logger from "../logger.js";
import * as cachekv from "../cachekv.js";
import {
  createCommit,
  getLatestCommit,
  writeSourceFile,
} from "../commitService.js";
import { createEvent } from "../../controllers/events.js";
import queueManager from "../queue/queueManager.js";

const DRAFT_PREFIX = "blog.draft.";

const draftKey = (projectId) => `${DRAFT_PREFIX}${Number(projectId)}`;

const assertProjectId = (projectId) => {
  const num = Number(projectId);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error("无效的文章 ID");
    err.statusCode = 400;
    throw err;
  }
  return num;
};

const ensureArticleOwner = async (projectId, userId) => {
  const numericId = assertProjectId(projectId);
  const project = await prisma.ow_projects.findFirst({
    where: { id: numericId },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      type: true,
      state: true,
      authorid: true,
      default_branch: true,
    },
  });
  if (!project) {
    const err = new Error("文章不存在");
    err.statusCode = 404;
    throw err;
  }
  if (project.authorid !== Number(userId)) {
    const err = new Error("无权编辑此文章");
    err.statusCode = 403;
    throw err;
  }
  return project;
};

export async function getDraft(userId, projectId) {
  assertProjectId(projectId);
  const record = await cachekv.get(Number(userId), draftKey(projectId));
  if (!record) return null;
  return {
    ...record.value,
    savedAt: record.updated_at,
  };
}

export async function saveDraft(userId, projectId, patch, { creatorIp = "" } = {}) {
  const project = await ensureArticleOwner(projectId, userId);
  const existing = (await cachekv.get(Number(userId), draftKey(projectId)))?.value || {};

  let baseCommitId = existing.baseCommitId;
  if (!baseCommitId) {
    const latest = await getLatestCommit(project.id, project.default_branch || "main");
    baseCommitId = latest?.id || null;
  }

  const merged = {
    title: patch.title ?? existing.title ?? project.title,
    description: patch.description ?? existing.description ?? project.description,
    content: patch.content ?? existing.content ?? "",
    tags: Array.isArray(patch.tags) ? patch.tags : existing.tags ?? [],
    cover: patch.cover ?? existing.cover ?? null,
    slug: patch.slug ?? existing.slug ?? project.name,
    baseCommitId,
    updatedAt: new Date().toISOString(),
  };

  const saved = await cachekv.set(
    Number(userId),
    draftKey(projectId),
    merged,
    creatorIp
  );
  return { ...merged, savedAt: saved.updated_at };
}

export async function discardDraft(userId, projectId) {
  await ensureArticleOwner(projectId, userId);
  return cachekv.remove(Number(userId), draftKey(projectId));
}

export async function listDrafts(userId) {
  const items = await prisma.ow_cache_kv.findMany({
    where: {
      user_id: Number(userId),
      key: { startsWith: DRAFT_PREFIX },
    },
    orderBy: { updated_at: "desc" },
  });
  const projectIds = items
    .map((item) => Number(item.key.slice(DRAFT_PREFIX.length)))
    .filter((id) => Number.isInteger(id));
  if (!projectIds.length) return [];

  const projects = await prisma.ow_projects.findMany({
    where: { id: { in: projectIds }, authorid: Number(userId), type: "article" },
    select: { id: true, name: true, title: true, state: true, time: true },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return items
    .map((item) => {
      const projectId = Number(item.key.slice(DRAFT_PREFIX.length));
      const project = projectMap.get(projectId);
      if (!project) return null;
      return {
        projectId,
        project,
        draft: item.value,
        savedAt: item.updated_at,
      };
    })
    .filter(Boolean);
}

export async function publishDraft(userId, projectId, { message = "发布" } = {}) {
  const project = await ensureArticleOwner(projectId, userId);
  const draftRecord = await cachekv.get(Number(userId), draftKey(projectId));
  if (!draftRecord) {
    const err = new Error("没有草稿可发布");
    err.statusCode = 400;
    throw err;
  }
  const draft = draftRecord.value || {};
  const branch = project.default_branch || "main";

  const sha256 = await writeSourceFile(draft.content ?? "", Number(userId));

  const commit = await createCommit({
    projectid: project.id,
    userid: Number(userId),
    branch,
    sha256,
    message,
    commit_description: draft.description || "",
    parent_commit: draft.baseCommitId,
  });

  const metaUpdates = {};
  if (draft.title !== undefined && draft.title !== project.title) {
    metaUpdates.title = String(draft.title).slice(0, 1000);
  }
  if (draft.description !== undefined && draft.description !== project.description) {
    metaUpdates.description = String(draft.description);
  }
  if (Object.keys(metaUpdates).length) {
    await prisma.ow_projects.update({
      where: { id: project.id },
      data: metaUpdates,
    });
  }

  // 同步标签
  if (Array.isArray(draft.tags)) {
    const existingTags = await prisma.ow_projects_tags.findMany({
      where: { projectid: project.id },
      select: { id: true, name: true },
    });

    const incomingTags = new Set(draft.tags.filter(Boolean).map(t => String(t).trim()));
    const toDelete = existingTags.filter(t => !incomingTags.has(t.name));
    const existingNames = new Set(existingTags.map(t => t.name));
    const toCreate = Array.from(incomingTags).filter(t => !existingNames.has(t));

    if (toDelete.length > 0) {
      await prisma.ow_projects_tags.deleteMany({
        where: { id: { in: toDelete.map(t => t.id) } },
      });
    }
    if (toCreate.length > 0) {
      await prisma.ow_projects_tags.createMany({
        data: toCreate.map(name => ({ projectid: project.id, name })),
      });
    }
  }

  await cachekv.remove(Number(userId), draftKey(projectId));

  try {
    await createEvent(
      "project_commit",
      Number(userId),
      "project",
      project.id,
      {
        event_type: "project_commit",
        actor_id: Number(userId),
        target_type: "project",
        target_id: project.id,
        commit_id: commit.id,
        commit_message: message,
        branch,
        default_branch: project.default_branch || "main",
        commit_file: sha256,
        project_name: project.name,
        project_title: metaUpdates.title || project.title,
        project_type: project.type,
        project_description: metaUpdates.description || project.description,
        project_state: project.state,
        notification_title: `发布了文章《${metaUpdates.title || project.title}》`,
        notification_content: message,
      },
      project.state === "private"
    );
  } catch (err) {
    logger.warn(`[blog-draft] createEvent failed project=${project.id}: ${err.message}`);
  }

  try {
    await queueManager.enqueueGitSyncCommit(project.id, commit.id, {
      triggeredBy: "blog-publish",
      actorId: Number(userId),
    });
  } catch (err) {
    logger.warn(`[git-sync] enqueue failed project=${project.id}: ${err.message}`);
  }

  if (String(project.type || "").toLowerCase() === "article") {
    try {
      await queueManager.enqueueBlogSyncArticle(project.id, project.authorid, {
        reason: "blog-publish",
        commitId: commit.id,
      });
    } catch (err) {
      logger.warn(`[blog-sync] enqueue failed project=${project.id}: ${err.message}`);
    }
  }

  return { commit, project: { ...project, ...metaUpdates } };
}
