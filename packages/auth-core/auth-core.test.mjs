import assert from "node:assert/strict";
import { test } from "node:test";

import { createBrowserAuthClient } from "./index.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("coalesces forced refresh across two page clients sharing storage", async () => {
  const storage = createMemoryStorage({
    token: "old-token",
    tokenExpiresAt: String(Date.now() - 1000),
    refreshTokenExpiresAt: String(Date.now() + 60_000),
  });

  let refreshCalls = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/account/refresh-token")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(
        JSON.stringify({
          status: "success",
          token: "new-token",
          expires_at: Date.now() + 60_000,
          refresh_expires_at: Date.now() + 120_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const first = createBrowserAuthClient({ apiUrl: "https://api.example.test", storage, fetch: fetchImpl });
  const second = createBrowserAuthClient({ apiUrl: "https://api.example.test", storage, fetch: fetchImpl });

  const [firstToken, secondToken] = await Promise.all([
    first.getFreshAuthToken(null, { force: true }),
    second.getFreshAuthToken(null, { force: true }),
  ]);

  assert.equal(firstToken, "new-token");
  assert.equal(secondToken, "new-token");
  assert.equal(storage.getItem("token"), "old-token");
  assert.equal(refreshCalls, 1);
});

test("authedFetch retries once with a refreshed token after 401", async () => {
  const storage = createMemoryStorage({
    token: "stale-token",
    tokenExpiresAt: String(Date.now() + 180_000),
    refreshTokenExpiresAt: String(Date.now() + 120_000),
  });

  const seenAuthHeaders = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).endsWith("/protected")) {
      seenAuthHeaders.push(init.headers?.Authorization);
      return new Response("{}", { status: seenAuthHeaders.length === 1 ? 401 : 200 });
    }

    if (String(url).endsWith("/account/refresh-token")) {
      return new Response(
        JSON.stringify({
          status: "success",
          token: "fresh-token",
          expires_at: Date.now() + 60_000,
          refresh_expires_at: Date.now() + 120_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  };

  const client = createBrowserAuthClient({ apiUrl: "https://api.example.test", storage, fetch: fetchImpl });

  const response = await client.authedFetch("/protected");

  assert.equal(response.status, 200);
  assert.deepEqual(seenAuthHeaders, ["Bearer stale-token", "Bearer fresh-token"]);
});
