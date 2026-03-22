import logger from "../services/logger.js";
import { prisma } from "../services/prisma.js";
import embeddingService from "../services/embedding.js";
import gorseService from "../services/gorse.js";
import { projectSelectionFields } from "./projects.js";

function normalizeLimit(limit, fallback = 20) {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 50);
}

function normalizeOffset(offset, fallback = 0) {
  const parsed = Number(offset);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 500);
}

function normalizeMinSimilarity(minSimilarity) {
  if (minSimilarity === undefined || minSimilarity === null || minSimilarity === "") return null;
  const parsed = Number(minSimilarity);
  if (Number.isNaN(parsed)) return null;
  return Math.min(Math.max(parsed, 0), 1);
}

function visibilityWhere(userId) {
  if (userId) {
    return {
      state: { not: "deleted" },
      OR: [{ state: "public" }, { authorid: Number(userId) }],
    };
  }

  return {
    state: "public",
  };
}

async function ensureProjectVector(projectId) {
  const vector = await embeddingService.getEmbedding("project", projectId);
  if (vector) return vector;
  return null;
}

async function ensureUserVector(userId, triggerType = "project_recommend") {
  const vector = await embeddingService.getEmbedding("user", userId);
  if (vector) return vector;
  return null;
}

function mergeVectors(userVector, projectVector, userWeight = 0.65, projectWeight = 0.35) {
  if (!userVector && !projectVector) return null;
  if (!userVector) return projectVector;
  if (!projectVector) return userVector;
  if (userVector.length !== projectVector.length) return userVector;

  const total = userWeight + projectWeight;
  if (total <= 0) return userVector;

  const merged = new Array(userVector.length).fill(0);
  for (let i = 0; i < userVector.length; i++) {
    merged[i] = ((userVector[i] * userWeight) + (projectVector[i] * projectWeight)) / total;
  }

  return embeddingService.normalizeVector(merged);
}

async function findProjectRecommendationsByVector({
  vector,
  userId = null,
  limit = 20,
  offset = 0,
  minSimilarity = null,
  excludeProjectIds = [],
  excludeOwnProjects = false,
}) {
  const safeLimit = normalizeLimit(limit, 20);
  const safeOffset = normalizeOffset(offset, 0);
  const safeMinSimilarity = normalizeMinSimilarity(minSimilarity);
  const excludeIds = [...new Set((excludeProjectIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];

  const searchLimit = Math.min(600, safeLimit + safeOffset + 100);
  const similar = await embeddingService.searchSimilar("project", vector, searchLimit, excludeIds);

  if (!similar || similar.length === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: safeMinSimilarity,
    };
  }

  const filtered = safeMinSimilarity === null
    ? similar
    : similar.filter((item) => Number(item.similarity) >= safeMinSimilarity);

  if (filtered.length === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: safeMinSimilarity,
    };
  }

  const candidateIds = filtered.map((item) => Number(item.entityId));
  const similarityMap = new Map(filtered.map((item) => [Number(item.entityId), Number(item.similarity)]));

  const where = {
    ...visibilityWhere(userId),
    id: { in: candidateIds },
  };

  if (excludeOwnProjects && userId) {
    where.authorid = { not: Number(userId) };
  }

  const projects = await prisma.ow_projects.findMany({
    where,
    select: projectSelectionFields(),
  });

  projects.sort((a, b) => (similarityMap.get(Number(b.id)) || 0) - (similarityMap.get(Number(a.id)) || 0));

  const paged = projects.slice(safeOffset, safeOffset + safeLimit).map((project) => ({
    ...project,
    similarity: similarityMap.get(Number(project.id)) || 0,
  }));

  return {
    projects: paged,
    total_candidates: projects.length,
    offset: safeOffset,
    limit: safeLimit,
    has_more: safeOffset + safeLimit < projects.length,
    min_similarity: safeMinSimilarity,
  };
}

async function findProjectRecommendationsByMultiVector({
  vectors,
  userId = null,
  limit = 20,
  offset = 0,
  minSimilarity = null,
  excludeProjectIds = [],
  excludeOwnProjects = false,
}) {
  const safeLimit = normalizeLimit(limit, 20);
  const safeOffset = normalizeOffset(offset, 0);
  const safeMinSimilarity = normalizeMinSimilarity(minSimilarity);
  const excludeIds = [...new Set((excludeProjectIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];

  const activeVectors = (vectors || [])
    .map((entry) => ({
      vector: Array.isArray(entry?.vector) ? entry.vector : null,
      weight: Number(entry?.weight) > 0 ? Number(entry.weight) : 0,
    }))
    .filter((entry) => Array.isArray(entry.vector) && entry.vector.length > 0 && entry.weight > 0);

  if (activeVectors.length === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: safeMinSimilarity,
    };
  }

  const perVectorSearchLimit = Math.min(800, safeLimit + safeOffset + 200);
  const searchResults = await Promise.all(
    activeVectors.map((entry) => embeddingService.searchSimilar("project", entry.vector, perVectorSearchLimit, excludeIds))
  );

  const scoreMap = new Map();
  for (let i = 0; i < searchResults.length; i++) {
    const rows = searchResults[i] || [];
    const weight = activeVectors[i].weight;
    for (const row of rows) {
      const entityId = Number(row.entityId);
      if (!Number.isInteger(entityId) || entityId <= 0) continue;

      const similarity = Number(row.similarity);
      if (Number.isNaN(similarity)) continue;

      const prev = scoreMap.get(entityId) || { weighted: 0, weight: 0 };
      prev.weighted += similarity * weight;
      prev.weight += weight;
      scoreMap.set(entityId, prev);
    }
  }

  if (scoreMap.size === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: safeMinSimilarity,
    };
  }

  const scoredCandidates = Array.from(scoreMap.entries())
    .map(([entityId, score]) => ({
      entityId,
      similarity: score.weight > 0 ? score.weighted / score.weight : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const filtered = safeMinSimilarity === null
    ? scoredCandidates
    : scoredCandidates.filter((item) => Number(item.similarity) >= safeMinSimilarity);

  if (filtered.length === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: safeMinSimilarity,
    };
  }

  const candidateIds = filtered.map((item) => Number(item.entityId));
  const similarityMap = new Map(filtered.map((item) => [Number(item.entityId), Number(item.similarity)]));

  const where = {
    ...visibilityWhere(userId),
    id: { in: candidateIds },
  };

  if (excludeOwnProjects && userId) {
    where.authorid = { not: Number(userId) };
  }

  const projects = await prisma.ow_projects.findMany({
    where,
    select: projectSelectionFields(),
  });

  projects.sort((a, b) => (similarityMap.get(Number(b.id)) || 0) - (similarityMap.get(Number(a.id)) || 0));

  const paged = projects.slice(safeOffset, safeOffset + safeLimit).map((project) => ({
    ...project,
    similarity: similarityMap.get(Number(project.id)) || 0,
  }));

  return {
    projects: paged,
    total_candidates: projects.length,
    offset: safeOffset,
    limit: safeLimit,
    has_more: safeOffset + safeLimit < projects.length,
    min_similarity: safeMinSimilarity,
  };
}

export async function getRecommendedProjectsForUser({ userId, limit = 20, offset = 0, minSimilarity = null }) {
  const nUserId = Number(userId);
  if (!Number.isInteger(nUserId) || nUserId <= 0) {
    throw new Error("无效的用户 ID");
  }

  const safeLimit = normalizeLimit(limit, 20);
  const safeOffset = normalizeOffset(offset, 0);
  const projectIds = await gorseService.getRecommendedProjectIds(nUserId, {
    limit: safeLimit,
    offset: safeOffset,
  });

  if (!projectIds || projectIds.length === 0) {
    return {
      projects: [],
      total_candidates: 0,
      offset: safeOffset,
      limit: safeLimit,
      has_more: false,
      min_similarity: normalizeMinSimilarity(minSimilarity),
      message: "Gorse 暂无推荐结果",
    };
  }

  const projects = await prisma.ow_projects.findMany({
    where: {
      ...visibilityWhere(nUserId),
      authorid: { not: nUserId },
      id: { in: projectIds },
    },
    select: projectSelectionFields(),
  });

  const projectMap = new Map(projects.map((project) => [Number(project.id), project]));
  const ordered = projectIds.map((id) => projectMap.get(Number(id))).filter(Boolean);

  return {
    projects: ordered,
    total_candidates: ordered.length,
    offset: safeOffset,
    limit: safeLimit,
    has_more: ordered.length === safeLimit,
    min_similarity: normalizeMinSimilarity(minSimilarity),
  };
}

export async function getContextRecommendedProjects({
  userId,
  projectId,
  limit = 20,
  offset = 0,
  minSimilarity = null,
}) {
  const nUserId = Number(userId);
  const nProjectId = Number(projectId);

  if (!Number.isInteger(nUserId) || nUserId <= 0) {
    throw new Error("无效的用户 ID");
  }

  if (!Number.isInteger(nProjectId) || nProjectId <= 0) {
    throw new Error("无效的项目 ID");
  }

  const sourceProject = await prisma.ow_projects.findFirst({
    where: {
      id: nProjectId,
      ...visibilityWhere(nUserId),
    },
    select: { id: true },
  });

  if (!sourceProject) {
    throw new Error("项目不存在或无权访问");
  }

  const [userVector, projectVector] = await Promise.all([
    ensureUserVector(nUserId, "project_recommend_context"),
    ensureProjectVector(nProjectId),
  ]);

  if (!userVector && !projectVector) {
    return {
      projects: [],
      total_candidates: 0,
      offset: normalizeOffset(offset, 0),
      limit: normalizeLimit(limit, 20),
      has_more: false,
      min_similarity: normalizeMinSimilarity(minSimilarity),
      source_project_id: nProjectId,
      message: "用户或项目向量尚未就绪，请手动触发 embedding 生成后重试",
    };
  }

  const result = await findProjectRecommendationsByMultiVector({
    vectors: [
      { vector: userVector, weight: 0.65 },
      { vector: projectVector, weight: 0.35 },
    ],
    userId: nUserId,
    limit,
    offset,
    minSimilarity,
    excludeProjectIds: [nProjectId],
    excludeOwnProjects: true,
  });

  return {
    ...result,
    source_project_id: nProjectId,
  };
}

export async function getSimilarProjectsByProject({
  projectId,
  userId = null,
  limit = 20,
  offset = 0,
  minSimilarity = null,
}) {
  const nProjectId = Number(projectId);
  const nUserId = userId ? Number(userId) : null;

  if (!Number.isInteger(nProjectId) || nProjectId <= 0) {
    throw new Error("无效的项目 ID");
  }

  const sourceProject = await prisma.ow_projects.findFirst({
    where: {
      id: nProjectId,
      ...visibilityWhere(nUserId),
    },
    select: { id: true },
  });

  if (!sourceProject) {
    throw new Error("项目不存在或无权访问");
  }

  const projectVector = await ensureProjectVector(nProjectId);
  if (!projectVector) {
    return {
      projects: [],
      total_candidates: 0,
      offset: normalizeOffset(offset, 0),
      limit: normalizeLimit(limit, 20),
      has_more: false,
      min_similarity: normalizeMinSimilarity(minSimilarity),
      source_project_id: nProjectId,
      message: "项目向量尚未就绪，请手动触发 embedding 生成后重试",
    };
  }

  const result = await findProjectRecommendationsByVector({
    vector: projectVector,
    userId: nUserId,
    limit,
    offset,
    minSimilarity,
    excludeProjectIds: [nProjectId],
  });

  return {
    ...result,
    source_project_id: nProjectId,
  };
}
