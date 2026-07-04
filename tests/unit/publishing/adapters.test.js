const test = require("node:test");
const assert = require("node:assert/strict");

const instagram = require("../../../utils/publishing/adapters/instagram");
const threads = require("../../../utils/publishing/adapters/threads");

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function reset() {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function task(overrides = {}) {
  return {
    locale: "zh",
    videoUrl: "/renders/video.mp4",
    publicVideoUrl: "https://cdn.example.com/renders/video.mp4",
    copy: { caption: "caption text" },
    ...overrides,
  };
}

test.afterEach(reset);

test("publishes Threads videos through the /me endpoint", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  process.env.THREADS_CONTAINER_POLL_MS = "0";
  const calls = [];
  let statusChecks = 0;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options?.body });
    if (String(url).endsWith("/me/threads")) return jsonResponse({ id: "container-1" });
    if (String(url).includes("/container-1?")) {
      statusChecks += 1;
      return jsonResponse(statusChecks === 1 ? { status: "IN_PROGRESS" } : { status: "FINISHED" });
    }
    if (String(url).endsWith("/me/threads_publish")) return jsonResponse({ id: "post-1", permalink: "https://threads.net/post/1" });
    return jsonResponse({ error: { message: "bad url" } }, { ok: false, status: 404 });
  };

  const result = await threads.publish(task());

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.postId, "post-1");
  assert.equal(calls[0].url, "https://graph.threads.net/v1.0/me/threads");
  assert.equal(calls[0].body.get("media_type"), "VIDEO");
  assert.equal(calls[0].body.get("video_url"), "https://cdn.example.com/renders/video.mp4");
  assert.equal(statusChecks, 2);
  assert.equal(calls[3].url, "https://graph.threads.net/v1.0/me/threads_publish");
});

test("publishes Threads text only when explicitly allowed", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  process.env.THREADS_ALLOW_TEXT_ONLY = "true";
  delete process.env.PUBLIC_MEDIA_BASE_URL;
  let createBody;
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/me/threads")) {
      createBody = options.body;
      return jsonResponse({ id: "container-1" });
    }
    return jsonResponse({ id: "post-1" });
  };

  const result = await threads.publish(task({ publicVideoUrl: "", videoUrl: "" }));

  assert.equal(result.status, "PUBLISHED");
  assert.equal(createBody.get("media_type"), "TEXT");
});

test("Threads returns NEEDS_AUTH when locale credentials are missing", async () => {
  delete process.env.THREADS_ZH_USER_ID;
  delete process.env.THREADS_ZH_ACCESS_TOKEN;

  const result = await threads.publish(task());

  assert.equal(result.status, "NEEDS_AUTH");
});

test("Threads returns NEEDS_PUBLIC_URL when video URL is private and text-only is disabled", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  delete process.env.THREADS_ALLOW_TEXT_ONLY;
  delete process.env.PUBLIC_MEDIA_BASE_URL;

  const result = await threads.publish(task({ publicVideoUrl: "", videoUrl: "" }));

  assert.equal(result.status, "NEEDS_PUBLIC_URL");
});

test("Threads surfaces media creation errors from the API", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  global.fetch = async () => jsonResponse({ error: { message: "create failed" } }, { ok: false, status: 400 });

  await assert.rejects(() => threads.publish(task()), /create failed/);
});

test("Threads surfaces container polling errors from the API", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  global.fetch = async (url) => {
    if (String(url).endsWith("/me/threads")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ error: { message: "poll failed" } }, { ok: false, status: 500 });
  };

  await assert.rejects(() => threads.publish(task()), /poll failed/);
});

test("Threads stops when the media container reports ERROR", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  global.fetch = async (url) => {
    if (String(url).endsWith("/me/threads")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ status: "ERROR", error_message: "video failed" });
  };

  await assert.rejects(() => threads.publish(task()), /video failed/);
});

test("Threads timeout includes container id and last status", async () => {
  process.env.THREADS_ZH_USER_ID = "threads-user";
  process.env.THREADS_ZH_ACCESS_TOKEN = "threads-token";
  process.env.THREADS_CONTAINER_MAX_ATTEMPTS = "2";
  process.env.THREADS_CONTAINER_POLL_MS = "0";
  global.fetch = async (url) => {
    if (String(url).endsWith("/me/threads")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ status: "IN_PROGRESS" });
  };

  await assert.rejects(
    () => threads.publish(task()),
    /Threads media container container-1 was not ready.*IN_PROGRESS/
  );
});

test("publishes Instagram Reels after polling container readiness", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.INSTAGRAM_CONTAINER_MAX_ATTEMPTS = "3";
  process.env.INSTAGRAM_CONTAINER_POLL_MS = "0";
  const calls = [];
  let statusChecks = 0;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (String(url).endsWith("/ig-user/media")) return jsonResponse({ id: "container-1" });
    if (String(url).includes("/container-1?")) {
      statusChecks += 1;
      return jsonResponse(statusChecks === 1 ? { status_code: "IN_PROGRESS" } : { status_code: "FINISHED" });
    }
    if (String(url).endsWith("/ig-user/media_publish")) return jsonResponse({ id: "media-1" });
    if (String(url).includes("/media-1?")) return jsonResponse({ permalink: "https://instagram.com/reel/1" });
    return jsonResponse({ error: { message: "bad url" } }, { ok: false, status: 404 });
  };

  const result = await instagram.publish(task());

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.mediaId, "media-1");
  assert.equal(result.url, "https://instagram.com/reel/1");
  assert.equal(calls[0].url, "https://graph.instagram.com/v25.0/ig-user/media");
  assert.equal(calls[0].body.get("media_type"), "REELS");
  assert.equal(statusChecks, 2);
});

test("Instagram publishing still succeeds if permalink lookup fails", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.INSTAGRAM_CONTAINER_POLL_MS = "0";
  global.fetch = async (url) => {
    if (String(url).endsWith("/ig-user/media")) return jsonResponse({ id: "container-1" });
    if (String(url).includes("/container-1?")) return jsonResponse({ status_code: "FINISHED" });
    if (String(url).endsWith("/ig-user/media_publish")) return jsonResponse({ id: "media-1" });
    if (String(url).includes("/media-1?")) {
      return jsonResponse({ error: { message: "permalink denied" } }, { ok: false, status: 403 });
    }
    return jsonResponse({ error: { message: "bad url" } }, { ok: false, status: 404 });
  };

  const result = await instagram.publish(task());

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.mediaId, "media-1");
  assert.equal(result.url, "");
});

test("Instagram returns NEEDS_AUTH when locale credentials are missing", async () => {
  delete process.env.INSTAGRAM_ZH_USER_ID;
  delete process.env.INSTAGRAM_ZH_ACCESS_TOKEN;

  const result = await instagram.publish(task());

  assert.equal(result.status, "NEEDS_AUTH");
});

test("Instagram returns NEEDS_PUBLIC_URL when the render has no public URL", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  delete process.env.PUBLIC_MEDIA_BASE_URL;

  const result = await instagram.publish(task({ publicVideoUrl: "", videoUrl: "" }));

  assert.equal(result.status, "NEEDS_PUBLIC_URL");
});

test("Instagram surfaces media creation errors from the API", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  global.fetch = async () => jsonResponse({ error: { message: "create failed" } }, { ok: false, status: 400 });

  await assert.rejects(() => instagram.publish(task()), /create failed/);
});

test("Instagram surfaces container polling errors from the API", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  global.fetch = async (url) => {
    if (String(url).endsWith("/ig-user/media")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ error: { message: "poll failed" } }, { ok: false, status: 500 });
  };

  await assert.rejects(() => instagram.publish(task()), /poll failed/);
});

test("Instagram stops when the media container reports ERROR", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  global.fetch = async (url) => {
    if (String(url).endsWith("/ig-user/media")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ status_code: "ERROR", status: "video failed" });
  };

  await assert.rejects(() => instagram.publish(task()), /video failed/);
});

test("Instagram timeout includes container id and last status", async () => {
  process.env.INSTAGRAM_ZH_USER_ID = "ig-user";
  process.env.INSTAGRAM_ZH_ACCESS_TOKEN = "ig-token";
  process.env.INSTAGRAM_CONTAINER_MAX_ATTEMPTS = "2";
  process.env.INSTAGRAM_CONTAINER_POLL_MS = "0";
  global.fetch = async (url) => {
    if (String(url).endsWith("/ig-user/media")) return jsonResponse({ id: "container-1" });
    return jsonResponse({ status_code: "IN_PROGRESS" });
  };

  await assert.rejects(
    () => instagram.publish(task()),
    /Instagram media container container-1 was not ready.*IN_PROGRESS/
  );
});
