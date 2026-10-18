import test, { beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

const state = { posts: [], calls: [], writes: [], restriction: null };
const noop = () => {};
const asyncNoop = async () => {};

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((clause) => matches(row, clause));
    if (key === "OR") return value.some((clause) => matches(row, clause));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      if ("not" in value) return row[key] !== value.not;
      if ("lt" in value) return row[key] < value.lt;
    }
    return row[key] === value;
  });
}

const db = {
  ow_posts: {
    async findMany(args) {
      state.calls.push(args);
      const rows = state.posts.filter((row) => matches(row, args.where));
      return rows.slice(0, args.take ?? rows.length);
    },
    async findFirst(args) { return (await this.findMany(args))[0] || null; },
    async count({ where }) { return state.posts.filter((row) => matches(row, where)).length; },
    async groupBy() { return []; },
    async create() { state.writes.push("create"); throw new Error("Unexpected content creation"); },
  },
  ow_analytics_event: { async groupBy() { return []; } },
  ow_posts_like: { async findMany() { return []; }, async groupBy() { return []; } },
  ow_posts_bookmark: { async findMany() { return []; }, async groupBy() { return []; } },
  ow_user_restrictions: { async findMany() { return []; } },
  async $transaction(callback) { return callback(db); },
};

mock.module("../services/prisma.js", { namedExports: { prisma: db } });
mock.module("twitter-text", { defaultExport: { parseTweet: (value) => ({ valid: true, weightedLength: value.length }) } });
mock.module("./notifications.js", { namedExports: { createNotification: asyncNoop } });
mock.module("./events.js", { namedExports: { createEvent: asyncNoop } });
mock.module("../services/config/zcconfig.js", { defaultExport: { get: async () => "https://static.example.test" } });
mock.module("../services/logger.js", { defaultExport: { debug: noop, error: noop, warn: noop } });
mock.module("../services/queue/queueManager.js", { defaultExport: { enqueueSocialPostSync: asyncNoop, enqueueUserEmbedding: asyncNoop } });
mock.module("../services/gorse.js", { defaultExport: {} });
mock.module("../services/embedding.js", { namedExports: {} });
mock.module("../services/analytics.js", { namedExports: { getAnalytics: asyncNoop } });
mock.module("../services/postPreview.js", { namedExports: { getPostUrlPreview: asyncNoop } });
mock.module("../utils/avatarUrl.js", { namedExports: { toAvatarURL: (avatar) => avatar || null } });
mock.module("../services/moderation/visibility.js", { namedExports: {
  visibleWhere: async (_kind, viewerId) => ({ AND: [
    { is_deleted: false, deleted_at: null },
    { OR: [{ hidden: false }, { author_id: viewerId }] },
  ] }),
  sanitizeProfile: async (user, viewerId) => user?.profile_hidden && user.id !== viewerId ? null : user,
} });
mock.module("../services/moderation/restrictions.js", { namedExports: {
  assertCanWrite: async () => { if (state.restriction) throw state.restriction; },
  activeRestrictionWhere: () => ({}),
} });
mock.module("../services/moderation/lifecycle.js", { namedExports: {
  softDeleteContent: async (...args) => { state.writes.push(args); },
  restoreContent: async (...args) => { state.writes.push(args); },
} });

const { getUserPosts, getPostById, createPost, likePost, deletePost, getDeletedPosts } = await import("./posts.js");

function post(id, authorId, extra = {}) {
  return {
    id, author_id: authorId, author: { id: authorId, username: `user${authorId}` },
    post_type: "normal", content: `post ${id}`, is_deleted: false, deleted_at: null,
    hidden: false, created_at: new Date(1000 + id), post_media: [], mentions: [],
    reply_count: 0, retweet_count: 0, like_count: 0, bookmark_count: 0,
    ...extra,
  };
}

beforeEach(() => {
  state.posts = [];
  state.calls = [];
  state.writes = [];
  state.restriction = null;
});

test("filters hidden posts before applying the requested page size", async () => {
  state.posts = [post(1, 2, { hidden: true }), post(2, 2), post(3, 2)];
  const result = await getUserPosts({ userId: 2, viewerId: 3, limit: 1 });
  assert.deepEqual(result.posts.map((item) => item.id), [2]);
  assert.equal(result.has_more, true);
  assert.ok(state.calls[0].where.AND, "the page query must carry live visibility");
});

test("forwards the viewer to quoted-post hydration and sanitizes author profiles", async () => {
  state.posts = [
    post(1, 2, { post_type: "quote", quoted_post_id: 2, author: { id: 2, profile_hidden: true, username: "hidden-profile" } }),
    post(2, 3, { hidden: true, post_media: [{ asset: { id: 9, md5: "secret", extension: "png" } }] }),
  ];
  const other = await getUserPosts({ userId: 2, viewerId: 4 });
  assert.deepEqual(other.includes.posts, {});
  assert.equal(other.posts[0].author, null);
  const owner = await getUserPosts({ userId: 2, viewerId: 3 });
  assert.equal(owner.includes.posts[2].content, "post 2");
  assert.equal(owner.includes.posts[2].media[0].id, 9);
});

test("deleted details and referenced media remain unavailable to the author", async () => {
  state.posts = [post(1, 2, { quoted_post_id: 2 }), post(2, 2, {
    is_deleted: true, deleted_at: new Date(), post_media: [{ asset: { id: 9, md5: "secret", extension: "png" } }],
  })];
  assert.equal(await getPostById(2, 2), null);
  const result = await getUserPosts({ userId: 2, viewerId: 2 });
  assert.deepEqual(result.includes.posts, {});
  assert.deepEqual(result.posts.map((item) => item.id), [1]);
});

test("read-only restrictions reject controller writes before any database mutation", async () => {
  state.restriction = Object.assign(new Error("read only"), { status: 403, code: "ACCOUNT_READ_ONLY" });
  await assert.rejects(createPost({ authorId: 2, content: "content" }), { code: "ACCOUNT_READ_ONLY" });
  await assert.rejects(likePost({ userId: 2, postId: 1 }), { code: "ACCOUNT_READ_ONLY" });
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.calls, []);
});

test("normal deletion uses the shared lifecycle and rejects unapproved foreign ownership", async () => {
  state.posts = [post(1, 2)];
  await assert.rejects(deletePost({ userId: 3, postId: 1 }), { status: 403 });
  assert.deepEqual(state.writes, []);
  await deletePost({ userId: 2, postId: 1 });
  assert.deepEqual(state.writes, [["post", 1, 2, { authorizationContext: {} }]]);
});

test("author recycle bin preserves content and marks administrative deletion non-restorable", async () => {
  state.posts = [
    post(1, 2, { is_deleted: true, deleted_at: new Date(), deletion_source: "admin" }),
    post(2, 3, { is_deleted: true, deleted_at: new Date(), deletion_source: "author" }),
  ];
  const result = await getDeletedPosts({ userId: 2 });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].content, "post 1");
  assert.equal(result.posts[0].can_restore, false);
  assert.equal(result.posts[0].is_deleted, true);
});
