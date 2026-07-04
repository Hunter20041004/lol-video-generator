const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const {
  buildPublicMediaUrl,
  ensurePublicMediaBaseUrl,
  isPublicMediaUrlHealthy,
  needsPublicMediaUrl,
  startTryCloudflareTunnel,
  stopManagedTunnel,
  updateEnvFileValue,
  waitForPublicMediaUrlHealthy,
} = require("../../../utils/publishing/tunnel");

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  stopManagedTunnel();
  process.env = { ...ORIGINAL_ENV };
}

test.afterEach(resetEnv);

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hvs-tunnel-"));
}

function okResponse(contentType = "video/mp4") {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : "") },
  };
}

function failedResponse(status = 502) {
  return {
    ok: false,
    status,
    headers: { get: () => "" },
  };
}

function fakeCloudflaredSpawn(outputUrl = "https://fresh-tunnel.trycloudflare.com") {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      child.emit("exit", 0);
    };
    child.unref = () => {};
    process.nextTick(() => {
      child.stderr.emit("data", Buffer.from(`Visit it at ${outputUrl}\n`));
    });
    return child;
  };
}

test("needsPublicMediaUrl only applies to immediate publishing on URL-pull platforms", () => {
  assert.equal(needsPublicMediaUrl({ action: "queue", platforms: ["instagram"] }), false);
  assert.equal(needsPublicMediaUrl({ action: "publish", platforms: ["youtube"] }), false);
  assert.equal(needsPublicMediaUrl({ action: "publish", platforms: ["threads"] }), true);
  assert.equal(needsPublicMediaUrl({ action: "publish", platforms: ["tiktok", "youtube"] }), false);
});

test("buildPublicMediaUrl joins public base and local render path", () => {
  assert.equal(
    buildPublicMediaUrl("https://example.trycloudflare.com/", "/renders/clip.mp4"),
    "https://example.trycloudflare.com/renders/clip.mp4"
  );
  assert.equal(
    buildPublicMediaUrl("", "/renders/clip.mp4"),
    ""
  );
  assert.equal(
    buildPublicMediaUrl("https://ignored.example", "https://cdn.example/video.mp4"),
    "https://cdn.example/video.mp4"
  );
});

test("isPublicMediaUrlHealthy reports reachable and unreachable public URLs", async () => {
  const healthy = await isPublicMediaUrlHealthy({
    baseUrl: "https://ok.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async () => okResponse(),
  });
  assert.equal(healthy.ok, true);
  assert.equal(healthy.url, "https://ok.trycloudflare.com/renders/clip.mp4");

  const failed = await isPublicMediaUrlHealthy({
    baseUrl: "https://bad.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async () => failedResponse(404),
  });
  assert.equal(failed.ok, false);
  assert.match(failed.reason, /HTTP 404/);

  const missing = await isPublicMediaUrlHealthy({
    baseUrl: "",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async () => okResponse(),
  });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /Missing/);
});

test("isPublicMediaUrlHealthy falls back to ranged GET when HEAD is rejected", async () => {
  const methods = [];
  const healthy = await isPublicMediaUrlHealthy({
    baseUrl: "https://ok.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      return options.method === "HEAD" ? failedResponse(405) : okResponse("video/mp4");
    },
  });

  assert.equal(healthy.ok, true);
  assert.deepEqual(methods, ["HEAD", "GET"]);
});

test("isPublicMediaUrlHealthy can validate trycloudflare URLs through fallback DNS", async () => {
  const calls = [];
  const healthy = await isPublicMediaUrlHealthy({
    baseUrl: "https://dns-lag.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async (_url, options) => {
      calls.push(options.method);
      throw new Error("fetch failed");
    },
    publicHttpRequestImpl: async (url, options) => {
      calls.push(`fallback:${options.method}`);
      return { ok: true, url, reason: "" };
    },
  });

  assert.equal(healthy.ok, true);
  assert.equal(healthy.fallbackDns, true);
  assert.deepEqual(calls, ["HEAD", "GET", "fallback:GET"]);
});

test("isPublicMediaUrlHealthy reports fallback DNS failures clearly", async () => {
  const failed = await isPublicMediaUrlHealthy({
    baseUrl: "https://dns-bad.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    fetchImpl: async () => {
      throw new Error("fetch failed");
    },
    publicHttpRequestImpl: async (url) => ({ ok: false, url, reason: "NXDOMAIN" }),
  });

  assert.equal(failed.ok, false);
  assert.match(failed.reason, /fallback DNS check failed/);
});

test("waitForPublicMediaUrlHealthy retries while a fresh tunnel warms up", async () => {
  let attempts = 0;
  const result = await waitForPublicMediaUrlHealthy({
    baseUrl: "https://warmup.trycloudflare.com",
    videoUrl: "/renders/clip.mp4",
    retryDelayMs: 1,
    attempts: 3,
    fetchImpl: async () => {
      attempts += 1;
      return attempts < 3 ? failedResponse(502) : okResponse();
    },
  });

  assert.equal(result.ok, true);
  assert.equal(attempts, 3);
});

test("startTryCloudflareTunnel parses the generated quick tunnel URL", async () => {
  let spawnedArgs = [];
  const tunnel = await startTryCloudflareTunnel({
    spawnImpl: (command, args) => {
      spawnedArgs = args;
      return fakeCloudflaredSpawn("https://beds-basically-easy-joan.trycloudflare.com")(command, args);
    },
    timeoutMs: 1000,
  });

  assert.equal(tunnel.baseUrl, "https://beds-basically-easy-joan.trycloudflare.com");
  assert.deepEqual(spawnedArgs, ["tunnel", "--url", "http://localhost:3000", "--protocol", "http2", "--no-autoupdate"]);
});

test("updateEnvFileValue replaces existing keys and appends missing keys", () => {
  const cwd = makeTempProject();
  fs.writeFileSync(path.join(cwd, ".env.local"), "A=1\nPUBLIC_MEDIA_BASE_URL=https://old.example\n", "utf8");

  updateEnvFileValue({ cwd, key: "PUBLIC_MEDIA_BASE_URL", value: "https://new.example" });
  updateEnvFileValue({ cwd, key: "EXTRA_KEY", value: "extra" });

  const envText = fs.readFileSync(path.join(cwd, ".env.local"), "utf8");
  assert.match(envText, /PUBLIC_MEDIA_BASE_URL=https:\/\/new\.example/);
  assert.match(envText, /EXTRA_KEY=extra/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test("updateEnvFileValue can write to the active project directory when cwd is omitted", () => {
  const originalCwd = process.cwd();
  const cwd = makeTempProject();
  try {
    process.chdir(cwd);
    updateEnvFileValue({ key: "PUBLIC_MEDIA_BASE_URL", value: "https://active-dir.trycloudflare.com" });

    const envText = fs.readFileSync(path.join(cwd, ".env.local"), "utf8");
    assert.match(envText, /PUBLIC_MEDIA_BASE_URL=https:\/\/active-dir\.trycloudflare\.com/);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("startTryCloudflareTunnel times out if cloudflared never prints a URL", async () => {
  await assert.rejects(
    () => startTryCloudflareTunnel({
      spawnImpl: () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.killed = false;
        child.kill = () => {
          child.killed = true;
        };
        return child;
      },
      timeoutMs: 5,
    }),
    /Timed out/
  );
});

test("ensurePublicMediaBaseUrl skips queues and keeps healthy existing URLs", async () => {
  process.env.PUBLIC_MEDIA_BASE_URL = "https://healthy.trycloudflare.com";

  const skipped = await ensurePublicMediaBaseUrl({
    action: "queue",
    platforms: ["instagram"],
    sampleVideoUrl: "/renders/clip.mp4",
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });
  assert.equal(skipped.status, "SKIPPED");

  const healthy = await ensurePublicMediaBaseUrl({
    action: "publish",
    platforms: ["instagram"],
    sampleVideoUrl: "/renders/clip.mp4",
    fetchImpl: async () => okResponse(),
    spawnImpl: () => {
      throw new Error("spawn should not run");
    },
  });
  assert.equal(healthy.status, "READY");
  assert.equal(healthy.refreshed, false);
  assert.equal(healthy.baseUrl, "https://healthy.trycloudflare.com");
});

test("ensurePublicMediaBaseUrl starts a new tunnel and updates env when current URL is dead", async () => {
  const cwd = makeTempProject();
  fs.writeFileSync(path.join(cwd, ".env.local"), "PUBLIC_MEDIA_BASE_URL=https://dead.trycloudflare.com\n", "utf8");
  process.env.PUBLIC_MEDIA_BASE_URL = "https://dead.trycloudflare.com";

  const result = await ensurePublicMediaBaseUrl({
    action: "publish",
    platforms: ["threads"],
    sampleVideoUrl: "/renders/clip.mp4",
    cwd,
    fetchImpl: async (url) => (String(url).includes("fresh-tunnel") ? okResponse() : failedResponse(502)),
    spawnImpl: fakeCloudflaredSpawn("https://fresh-tunnel.trycloudflare.com"),
    tunnelTimeoutMs: 1000,
  });

  assert.equal(result.status, "READY");
  assert.equal(result.refreshed, true);
  assert.equal(result.healthAttempts, 1);
  assert.equal(result.previousBaseUrl, "https://dead.trycloudflare.com");
  assert.equal(process.env.PUBLIC_MEDIA_BASE_URL, "https://fresh-tunnel.trycloudflare.com");
  assert.match(fs.readFileSync(path.join(cwd, ".env.local"), "utf8"), /fresh-tunnel/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test("ensurePublicMediaBaseUrl retries with a different tunnel when the first fresh URL is unreachable", async () => {
  const cwd = makeTempProject();
  fs.writeFileSync(path.join(cwd, ".env.local"), "PUBLIC_MEDIA_BASE_URL=https://dead.trycloudflare.com\n", "utf8");
  process.env.PUBLIC_MEDIA_BASE_URL = "https://dead.trycloudflare.com";
  const spawnedUrls = ["https://dns-bad.trycloudflare.com", "https://stable.trycloudflare.com"];
  let spawnCount = 0;

  const result = await ensurePublicMediaBaseUrl({
    action: "publish",
    platforms: ["instagram"],
    sampleVideoUrl: "/renders/clip.mp4",
    cwd,
    fetchImpl: async (url) => (String(url).includes("stable") ? okResponse() : failedResponse(502)),
    spawnImpl: () => fakeCloudflaredSpawn(spawnedUrls[spawnCount++])(),
    healthAttempts: 1,
    tunnelRetryDelayMs: 1,
    tunnelTimeoutMs: 1000,
  });

  assert.equal(result.status, "READY");
  assert.equal(result.refreshed, true);
  assert.equal(result.tunnelAttempts, 2);
  assert.equal(process.env.PUBLIC_MEDIA_BASE_URL, "https://stable.trycloudflare.com");
  const envText = fs.readFileSync(path.join(cwd, ".env.local"), "utf8");
  assert.match(envText, /stable\.trycloudflare\.com/);
  assert.doesNotMatch(envText, /dns-bad\.trycloudflare\.com/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test("ensurePublicMediaBaseUrl keeps checking a fresh tunnel while DNS warms up", async () => {
  const cwd = makeTempProject();
  fs.writeFileSync(path.join(cwd, ".env.local"), "PUBLIC_MEDIA_BASE_URL=https://dead.trycloudflare.com\n", "utf8");
  process.env.PUBLIC_MEDIA_BASE_URL = "https://dead.trycloudflare.com";
  let checks = 0;

  const result = await ensurePublicMediaBaseUrl({
    action: "publish",
    platforms: ["instagram"],
    sampleVideoUrl: "/renders/clip.mp4",
    cwd,
    fetchImpl: async (url) => {
      if (!String(url).includes("fresh-slow-dns")) return failedResponse(502);
      checks += 1;
      return checks < 11 ? failedResponse(502) : okResponse();
    },
    spawnImpl: fakeCloudflaredSpawn("https://fresh-slow-dns.trycloudflare.com"),
    healthRetryDelayMs: 1,
    tunnelStartAttempts: 1,
    tunnelTimeoutMs: 1000,
  });

  assert.equal(result.status, "READY");
  assert.equal(result.refreshed, true);
  assert.equal(result.healthAttempts, 6);
  assert.equal(process.env.PUBLIC_MEDIA_BASE_URL, "https://fresh-slow-dns.trycloudflare.com");
  fs.rmSync(cwd, { recursive: true, force: true });
});

test("ensurePublicMediaBaseUrl rejects if the refreshed tunnel cannot serve the rendered video", async () => {
  process.env.PUBLIC_MEDIA_BASE_URL = "https://dead.trycloudflare.com";

  await assert.rejects(
    () => ensurePublicMediaBaseUrl({
      action: "publish",
      platforms: ["instagram"],
      sampleVideoUrl: "/renders/clip.mp4",
      fetchImpl: async () => failedResponse(503),
      spawnImpl: fakeCloudflaredSpawn("https://fresh-but-bad.trycloudflare.com"),
      healthAttempts: 1,
      tunnelStartAttempts: 1,
      tunnelTimeoutMs: 1000,
      updateEnv: false,
    }),
    /New trycloudflare tunnel is not reachable/
  );
});

test("ensurePublicMediaBaseUrl surfaces cloudflared startup failures", async () => {
  process.env.PUBLIC_MEDIA_BASE_URL = "https://dead.trycloudflare.com";

  await assert.rejects(
    () => ensurePublicMediaBaseUrl({
      action: "publish",
      platforms: ["instagram"],
      sampleVideoUrl: "/renders/clip.mp4",
      fetchImpl: async () => failedResponse(502),
      spawnImpl: () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => {};
        process.nextTick(() => child.emit("error", new Error("cloudflared missing")));
        return child;
      },
      tunnelTimeoutMs: 1000,
    }),
    /cloudflared missing/
  );
});
