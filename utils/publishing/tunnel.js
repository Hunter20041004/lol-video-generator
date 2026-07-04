const fs = require("fs");
const path = require("path");
const dns = require("dns");
const https = require("https");
const { spawn } = require("child_process");

const TRYCLOUDFLARE_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const PUBLIC_URL_PLATFORMS = new Set(["instagram", "threads"]);

function normalizePlatform(platform = "") {
  return String(platform || "").toLowerCase();
}

function needsPublicMediaUrl({ action = "queue", platforms = [] } = {}) {
  if (action !== "publish") return false;
  return platforms.map(normalizePlatform).some((platform) => PUBLIC_URL_PLATFORMS.has(platform));
}

function getPublicBaseUrl() {
  return process.env.PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "";
}

function buildPublicMediaUrl(baseUrl, videoUrl = "") {
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl;
  if (!baseUrl || !videoUrl) return "";
  return `${String(baseUrl).replace(/\/$/, "")}/${String(videoUrl).replace(/^\//, "")}`;
}

async function fetchWithTimeout(fetchImpl, url, { method, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method,
      signal: controller.signal,
      headers: method === "GET" ? { Range: "bytes=0-1" } : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkPublicMediaUrl({ url, fetchImpl, timeoutMs, method }) {
  try {
    const response = await fetchWithTimeout(fetchImpl, url, { method, timeoutMs });
    if (!response.ok) {
      return { ok: false, url, reason: `Public media URL returned HTTP ${response.status}.` };
    }
    const contentType = response.headers?.get?.("content-type") || "";
    return {
      ok: true,
      url,
      reason: contentType && !/video|octet-stream/i.test(contentType)
        ? `Reachable, but content type is ${contentType}.`
        : "",
    };
  } catch (error) {
    return {
      ok: false,
      url,
      reason: error.name === "AbortError" ? "Public media URL timed out." : error.message,
    };
  }
}

function requestWithFallbackDns(url, { method, timeoutMs } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const parsed = new URL(url);
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["1.1.1.1", "8.8.8.8"]);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, url, reason: "Fallback DNS request timed out." });
    }, timeoutMs);

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const lookup = async (_hostname, options, callback) => {
      try {
        const addresses = await resolver.resolve4(parsed.hostname);
        if (options?.all) {
          callback(null, addresses.map((address) => ({ address, family: 4 })));
          return;
        }
        callback(null, addresses[0], 4);
      } catch (error) {
        callback(error);
      }
    };

    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method,
      lookup,
      timeout: timeoutMs,
      headers: method === "GET" ? { Range: "bytes=0-1" } : undefined,
    }, (response) => {
      response.resume();
      const ok = response.statusCode >= 200 && response.statusCode < 400;
      finish({
        ok,
        url,
        reason: ok ? "" : `Fallback DNS request returned HTTP ${response.statusCode}.`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, url, reason: "Fallback DNS request timed out." });
    });
    req.on("error", (error) => finish({ ok: false, url, reason: error.message }));
    req.end();
  });
}

async function isPublicMediaUrlHealthy({
  baseUrl = getPublicBaseUrl(),
  videoUrl,
  fetchImpl = fetch,
  publicHttpRequestImpl = requestWithFallbackDns,
  timeoutMs = 8000,
} = {}) {
  const url = buildPublicMediaUrl(baseUrl, videoUrl);
  if (!url) return { ok: false, url, reason: "Missing public media URL." };

  const headResult = await checkPublicMediaUrl({ url, fetchImpl, timeoutMs, method: "HEAD" });
  if (headResult.ok) return headResult;
  const getResult = await checkPublicMediaUrl({ url, fetchImpl, timeoutMs, method: "GET" });
  if (getResult.ok) return getResult;
  if (/fetch failed|getaddrinfo|ENOTFOUND|NXDOMAIN/i.test(`${headResult.reason} ${getResult.reason}`)) {
    const fallbackResult = await publicHttpRequestImpl(url, { method: "GET", timeoutMs });
    if (fallbackResult.ok) {
      return {
        ...fallbackResult,
        reason: "Reachable via fallback DNS resolver.",
        fallbackDns: true,
      };
    }
    return {
      ...fallbackResult,
      reason: `System DNS failed and fallback DNS check failed: ${fallbackResult.reason}`,
    };
  }
  return getResult;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPublicMediaUrlHealthy({
  attempts = 5,
  retryDelayMs = 1200,
  ...options
} = {}) {
  const maxAttempts = Math.max(1, Number(attempts) || 1);
  let lastResult = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await isPublicMediaUrlHealthy(options);
    if (lastResult.ok) return { ...lastResult, attempts: attempt };
    if (attempt < maxAttempts) await wait(retryDelayMs);
  }
  return {
    ...(lastResult || { ok: false, reason: "Public media URL health check failed." }),
    attempts: maxAttempts,
  };
}

function updateEnvFileValue({
  cwd,
  fileName = ".env.local",
  key,
  value,
} = {}) {
  const envPath = cwd
    ? path.join(cwd, fileName)
    : path.join(/* turbopackIgnore: true */ process.cwd(), fileName);
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const lines = existing.split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.map((current) => {
    if (current.startsWith(`${key}=`)) {
      replaced = true;
      return line;
    }
    return current;
  });
  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") nextLines.push("");
    nextLines.push(line);
  }
  fs.writeFileSync(envPath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  return envPath;
}

function stopManagedTunnel() {
  const managed = globalThis.__HVS_TRYCLOUDFLARE_PROCESS__;
  if (managed && !managed.killed) {
    managed.kill("SIGTERM");
  }
  globalThis.__HVS_TRYCLOUDFLARE_PROCESS__ = null;
}

function startTryCloudflareTunnel({
  localUrl = "http://localhost:3000",
  spawnImpl = spawn,
  timeoutMs = 25000,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl("cloudflared", ["tunnel", "--url", localUrl, "--protocol", "http2", "--no-autoupdate"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let output = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill?.("SIGTERM");
      reject(new Error("Timed out while waiting for trycloudflare tunnel URL."));
    }, timeoutMs);

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const inspectChunk = (chunk) => {
      output += chunk.toString();
      const match = output.match(TRYCLOUDFLARE_URL_REGEX);
      if (match) {
        globalThis.__HVS_TRYCLOUDFLARE_PROCESS__ = child;
        child.unref?.();
        settle(resolve, { baseUrl: match[0], process: child });
      }
    };

    child.stdout?.on?.("data", inspectChunk);
    child.stderr?.on?.("data", inspectChunk);
    child.on?.("error", (error) => settle(reject, error));
    child.on?.("exit", (code) => {
      if (!settled) settle(reject, new Error(`cloudflared exited before tunnel URL was ready (code ${code}).`));
    });
  });
}

async function ensurePublicMediaBaseUrl({
  action = "queue",
  platforms = [],
  sampleVideoUrl,
  cwd,
  localUrl = "http://localhost:3000",
  fetchImpl = fetch,
  spawnImpl = spawn,
  updateEnv = true,
  healthTimeoutMs = 10000,
  healthAttempts = 12,
  healthRetryDelayMs = 2000,
  tunnelTimeoutMs = 25000,
  tunnelStartAttempts = 5,
  tunnelRetryDelayMs = 2500,
} = {}) {
  if (!needsPublicMediaUrl({ action, platforms })) {
    return { status: "SKIPPED", refreshed: false, baseUrl: getPublicBaseUrl(), reason: "No public-media platform selected." };
  }

  const currentBaseUrl = getPublicBaseUrl();
  const currentHealth = await isPublicMediaUrlHealthy({
    baseUrl: currentBaseUrl,
    videoUrl: sampleVideoUrl,
    fetchImpl,
    timeoutMs: healthTimeoutMs,
  });
  if (currentHealth.ok) {
    return { status: "READY", refreshed: false, baseUrl: currentBaseUrl, sampleUrl: currentHealth.url };
  }

  const maxTunnelAttempts = Math.max(1, Number(tunnelStartAttempts) || 1);
  let lastFailure = null;
  let lastTunnelBaseUrl = "";

  for (let attempt = 1; attempt <= maxTunnelAttempts; attempt += 1) {
    stopManagedTunnel();
    const tunnel = await startTryCloudflareTunnel({
      localUrl,
      spawnImpl,
      timeoutMs: tunnelTimeoutMs,
    });
    lastTunnelBaseUrl = tunnel.baseUrl;

    const refreshedHealth = await waitForPublicMediaUrlHealthy({
      baseUrl: tunnel.baseUrl,
      videoUrl: sampleVideoUrl,
      fetchImpl,
      timeoutMs: healthTimeoutMs,
      attempts: healthAttempts,
      retryDelayMs: healthRetryDelayMs,
    });
    if (refreshedHealth.ok) {
      process.env.PUBLIC_MEDIA_BASE_URL = tunnel.baseUrl;
      if (updateEnv) {
        updateEnvFileValue({ cwd, key: "PUBLIC_MEDIA_BASE_URL", value: tunnel.baseUrl });
      }

      return {
        status: "READY",
        refreshed: true,
        previousBaseUrl: currentBaseUrl,
        previousFailure: currentHealth.reason,
        baseUrl: tunnel.baseUrl,
        sampleUrl: refreshedHealth.url,
        healthAttempts: refreshedHealth.attempts,
        tunnelAttempts: attempt,
      };
    }

    lastFailure = refreshedHealth;
    stopManagedTunnel();
    if (attempt < maxTunnelAttempts) await wait(tunnelRetryDelayMs);
  }

  const failureReason = lastFailure?.reason || "Public media URL health check failed.";
  throw new Error(
    `New trycloudflare tunnel is not reachable after ${maxTunnelAttempts} tunnel attempt(s)`
    + `${lastTunnelBaseUrl ? `; last tunnel: ${lastTunnelBaseUrl}` : ""}: ${failureReason}`
  );
}

module.exports = {
  TRYCLOUDFLARE_URL_REGEX,
  buildPublicMediaUrl,
  ensurePublicMediaBaseUrl,
  isPublicMediaUrlHealthy,
  needsPublicMediaUrl,
  startTryCloudflareTunnel,
  stopManagedTunnel,
  updateEnvFileValue,
  waitForPublicMediaUrlHealthy,
};
