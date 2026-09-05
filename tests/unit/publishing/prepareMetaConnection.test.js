const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { prepareMetaConnection, verifyPublicGateway } = require("../../../utils/publishing/prepareMetaConnection");

test("connection preparation updates neither origin when any public gateway check fails", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-connect-"));
  fs.writeFileSync(path.join(cwd, ".env.local"), "META_REDIRECT_BASE_URL=https://old.callback\nPUBLIC_MEDIA_BASE_URL=https://old.media\n");
  let stopped = 0;
  await assert.rejects(() => prepareMetaConnection({
    cwd,
    sampleVideoUrl: "/renders/clip.mp4",
    startTemporaryPublishingTunnelImpl: async () => ({
      baseUrl: "https://fresh.trycloudflare.com",
      stop: async () => { stopped += 1; },
    }),
    verifyPublicGatewayImpl: async () => ({ ok: false, reason: "root was exposed" }),
  }), /root was exposed/);

  assert.equal(stopped, 1);
  assert.equal(fs.readFileSync(path.join(cwd, ".env.local"), "utf8"),
    "META_REDIRECT_BASE_URL=https://old.callback\nPUBLIC_MEDIA_BASE_URL=https://old.media\n");
});

test("public gateway verification waits for a new tunnel to become reachable", async () => {
  let calls = 0;
  const response = (status, contentType = "text/plain", bytes = 0) => ({
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  });
  const fetchImpl = async (url, options = {}) => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    if (url.endsWith("/")) return response(404);
    if (url.includes("/callback")) return response(400, "application/json");
    if (options.method === "HEAD") return response(200, "video/mp4");
    return response(206, "video/mp4", 2);
  };
  const result = await verifyPublicGateway({
    baseUrl: "https://warming.trycloudflare.com",
    sampleVideoUrl: "/renders/clip.mp4",
    fetchImpl,
    attempts: 2,
    retryDelayMs: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

test("connection preparation updates both origins and returns exact callback URLs after all checks", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-connect-"));
  const managed = { baseUrl: "https://safe-window.trycloudflare.com", stop: async () => {} };
  const result = await prepareMetaConnection({
    cwd,
    sampleVideoUrl: "/renders/clip.mp4",
    startTemporaryPublishingTunnelImpl: async ({ studioOrigin }) => {
      assert.equal(studioOrigin, "http://localhost:49761");
      return managed;
    },
    verifyPublicGatewayImpl: async (request) => ({
      ok: true,
      mediaUrl: `${request.baseUrl}${request.sampleVideoUrl}`,
    }),
  });

  const env = fs.readFileSync(path.join(cwd, ".env.local"), "utf8");
  assert.match(env, /^META_REDIRECT_BASE_URL=https:\/\/safe-window\.trycloudflare\.com$/m);
  assert.match(env, /^PUBLIC_MEDIA_BASE_URL=https:\/\/safe-window\.trycloudflare\.com$/m);
  assert.deepEqual(result.callbacks, {
    instagram: "https://safe-window.trycloudflare.com/api/auth/meta/instagram/callback",
    threads: "https://safe-window.trycloudflare.com/api/auth/meta/threads/callback",
  });
  assert.equal(result.mediaUrl, "https://safe-window.trycloudflare.com/renders/clip.mp4");
});
