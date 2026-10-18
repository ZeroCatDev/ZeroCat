import test, { beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

const state = { projectVisible: true, token: null, commits: [], filesRead: 0, type: "scratch", writes: [] };
const routes = [];
const guards = [];
const router = { use(handler) { guards.push(handler); } };
for (const method of ["get", "post", "put", "delete"]) router[method] = (path, ...handlers) => routes.push({ method, path, handlers });
const noop = () => {};
const pass = (_req, _res, next) => next();
const argsMatch = (record, where) => Object.entries(where).every(([key, value]) => record[key] === value);

mock.module("express", { namedExports: { Router: () => router } });
mock.module("../services/logger.js", { defaultExport: { error: noop, debug: noop, warn: noop } });
mock.module("../services/config/zcconfig.js", { defaultExport: { get: async () => "test-secret" } });
mock.module("../services/prisma.js", { namedExports: { prisma: {
  ow_projects: { findFirst: async () => state.projectVisible ? { id: 1, type: state.type } : null },
  ow_projects_branch: { findMany: async () => [{ latest_commit_hash: "fork-tip" }] },
  ow_projects_commits: { findUnique: async ({ where }) => state.commits.find((commit) => argsMatch(commit, where)) || null },
  ow_projects_file: { findFirst: async ({ where }) => { state.filesRead++; return { sha256: where.sha256, source: "protected source" }; } },
} } });
mock.module("../default_project.js", { defaultExport: {} });
mock.module("../controllers/projects.js", { namedExports: {
  authorSelectionFields: noop, extractProjectData: noop, handleTagsChange: noop,
  projectSelectionFields: noop, sanitizeProjectAuthors: async (projects) => projects,
} });
mock.module("jsonwebtoken", { defaultExport: { verify: () => state.token } });
mock.module("../services/auth/tokenUtils.js", { namedExports: { createTypedJWT: async () => "signed" } });
mock.module("../services/auth/tokenManager.js", { namedExports: { verifyFileAccessToken: async () => state.token.data.sha256 } });
mock.module("../controllers/projectRecommendations.js", { namedExports: {
  getContextRecommendedProjects: noop, getRecommendedProjectsForUser: noop, getSimilarProjectsByProject: noop,
} });
mock.module("../middleware/auth.js", { namedExports: { needLogin: pass } });
mock.module("../middleware/scope.js", { namedExports: { requireScope: () => pass, requireResource: () => pass } });
mock.module("../services/auth/permissionManager.js", { namedExports: { hasProjectPermission: async () => true } });
mock.module("../services/projectCollaborationService.js", { namedExports: { userCanActOnProject: async () => true } });
mock.module("../controllers/users.js", { namedExports: { getUserByUsername: noop } });
mock.module("../controllers/events.js", { namedExports: { createEvent: noop } });
mock.module("../services/analytics.js", { namedExports: { getAnalytics: noop } });
mock.module("../services/redis.js", { defaultExport: {} });
mock.module("../services/queue/queueManager.js", { defaultExport: {} });
mock.module("../services/gorse.js", { defaultExport: {} });
mock.module("../services/commitService.js", { namedExports: {
  createBranchIfNotExists: noop, getCommitParentId: noop, updateBranchLatestCommit: noop,
} });
mock.module("../services/moderation/visibility.js", { namedExports: {
  visibleWhere: async () => ({}), sanitizeProfile: async (user) => user,
} });
mock.module("../services/moderation/restrictions.js", { namedExports: { assertCanWrite: async (userId, category, action) => {
  state.writes.push({ userId, category, action });
} } });
mock.module("../services/moderation/lifecycle.js", { namedExports: { softDeleteContent: noop, restoreContent: noop } });
mock.module("../middleware/sudo.js", { namedExports: { requireSudo: pass } });
await import("./router_project.js");

async function download(sha256 = "file-a") {
  const req = { params: { sha256 }, query: { accessFileToken: "signed", content: "true" } };
  const res = {
    locals: { userid: 2 }, statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; }, contentType() { return this; },
  };
  const handler = routes.find((route) => route.path === "/files/:sha256").handlers.at(-1);
  await handler(req, res, (error) => { throw error; });
  return res;
}

beforeEach(() => {
  state.projectVisible = true;
  state.type = "scratch";
  state.writes = [];
  state.filesRead = 0;
  state.token = { type: "file", data: { project_id: 1, sha256: "file-a", userid: 2 } };
  state.commits = [{ id: "fork-tip", project_id: 99, commit_file: "file-a", parent_commit_id: null }];
});

test("unsupported delegated project enumeration is rejected, including empty headers", () => {
  const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  guards[0]({ method: "GET", path: "/public", headers: { "x-zerocat-delegation": "" } }, res, () => assert.fail("must deny"));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "ZC_ERROR_DELEGATION_NOT_SUPPORTED");
  let advanced = false;
  guards[0]({ method: "GET", path: "/id/7", headers: { "x-zerocat-delegation": "12" } }, res, () => { advanced = true; });
  assert.equal(advanced, true);
});

test("article writes recheck both categories for the actual actor and delegated owner", async () => {
  state.type = "article";
  const route = routes.find(route => route.method === "put" && route.path === "/id/:id");
  const res = { locals: { userid: 2, authorization: { allowed: true, actorId: 2, principalId: 3 } } };
  let advanced = false;
  await route.handlers[2]({ params: { id: 1 }, headers: {} }, res, () => { advanced = true; });
  assert.equal(advanced, true);
  assert.deepEqual(state.writes, [
    { userId: 2, category: "project", action: "update" }, { userId: 2, category: "blog", action: "update" },
    { userId: 3, category: "project", action: "update" }, { userId: 3, category: "blog", action: "update" },
  ]);
});

test("rejects signed-token hash substitution before opening a file", async () => {
  const result = await download("file-b");
  assert.equal(result.statusCode, 404);
  assert.equal(state.filesRead, 0);
});

test("checks current project visibility for an already-issued token", async () => {
  state.projectVisible = false;
  const result = await download();
  assert.equal(result.statusCode, 404);
  assert.equal(state.filesRead, 0);
});

test("rejects legacy file tokens without a bound project", async () => {
  delete state.token.data.project_id;
  const result = await download();
  assert.equal(result.statusCode, 404);
  assert.equal(state.filesRead, 0);
});

test("permits retained fork content through the visible fork's reachable commit graph", async () => {
  const result = await download();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, "protected source");
  assert.equal(state.filesRead, 1);
});

test("rejects an unrelated file despite a valid project and signature", async () => {
  state.commits = [{ id: "fork-tip", commit_file: "different-file", parent_commit_id: null }];
  const result = await download();
  assert.equal(result.statusCode, 404);
  assert.equal(state.filesRead, 0);
});
