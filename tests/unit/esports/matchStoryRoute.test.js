const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatchStoryPost } = require("../../../utils/esports/matchStoryApi");

function request(body, headers = {}) {
  return new Request("http://127.0.0.1/api/esports/story", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
}
test("malformed JSON returns a safe 400 without executing service", async () => {
  let calls = 0;
  const post = createMatchStoryPost({ execute: async () => { calls += 1; } });
  const response = await post(request("{bad"));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "MATCH_STORY_INVALID_REQUEST");
  assert.equal(calls, 0);
});

test("an external Host cannot turn an internal loopback URL into an allowed origin", async () => {
  let calls = 0;
  const post = createMatchStoryPost({ execute: async () => { calls++; return {}; } });
  const req = new Request("http://localhost:49765/api/esports/story", { method: "POST", headers: {
    "content-type": "application/json", host: "synthetic-attacker.example:49765", origin: "http://synthetic-attacker.example:49765",
  }, body: "{}" });
  assert.equal((await post(req)).status, 403);
  assert.equal(calls, 0);
});

test("Next internal localhost URL does not reject the browser's actual Host origin", async () => {
  const post = createMatchStoryPost({ execute: async () => ({ id: "synthetic" }) });
  const req = new Request("http://localhost:49765/api/esports/story", { method: "POST", headers: {
    "content-type": "application/json", host: "127.0.0.1:49765", origin: "http://127.0.0.1:49765",
  }, body: "{}" });
  assert.equal((await post(req)).status, 200);
});

test("oversized streamed body returns 400 before service execution", async () => {
  let calls = 0;
  const post = createMatchStoryPost({ execute: async () => { calls += 1; return {}; } });
  const response = await post(request(JSON.stringify({ text: "x".repeat(1024 * 1024) })));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "MATCH_STORY_REQUEST_TOO_LARGE");
  assert.equal(calls, 0);
});

test("unexpected service errors never expose private text", async () => {
  const post = createMatchStoryPost({ execute: async () => { throw new Error("/private/synthetic-secret"); } });
  const response = await post(request("{}"));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, "MATCH_STORY_FAILED");
  assert.ok(!JSON.stringify(body).includes("private"));
});

test("cross-origin browser writes are rejected before execution", async () => {
  let calls = 0;
  const post = createMatchStoryPost({ execute: async () => { calls += 1; return {}; } });
  const response = await post(request("{}", { origin: "https://example.com" }));
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});

test("non-JSON browser form submissions cannot mutate drafts", async () => {
  let calls = 0;
  const post = createMatchStoryPost({ execute: async () => { calls += 1; return {}; } });
  const response = await post(request("{}", { "content-type": "text/plain" }));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("unknown action maps to 400 and known errors use fixed safe text", async () => {
  const { createMatchStoryService } = require("../../../utils/esports/matchStoryService");
  const post = createMatchStoryPost(createMatchStoryService());
  assert.equal((await post(request('{"action":"publish"}'))).status, 400);
  const safe = createMatchStoryPost({ execute: async () => { throw Object.assign(new Error("synthetic-secret"), { code: "MATCH_STORY_VERSION_CONFLICT" }); } });
  const response = await safe(request("{}"));
  assert.equal(response.status, 409);
  assert.ok(!(await response.text()).includes("secret"));
});

test("same-origin JSON request reaches service and returns its draft", async () => {
  const post = createMatchStoryPost({ execute: async () => ({ id: "synthetic" }) });
  const response = await post(request("{}", { origin: "http://127.0.0.1" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft.id, "synthetic");
});
