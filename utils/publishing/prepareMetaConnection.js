const path = require("node:path");
const dns = require("node:dns");
const https = require("node:https");
const {
  startTemporaryPublishingTunnel,
  updateEnvFileValue,
} = require("./tunnel");

function fetchWithPublicDns(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      reject(new Error("Public gateway fallback requires HTTPS."));
      return;
    }
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["1.1.1.1", "8.8.8.8"]);
    const lookup = async (_hostname, lookupOptions, callback) => {
      try {
        const addresses = await resolver.resolve4(parsed.hostname);
        if (lookupOptions?.all) {
          callback(null, addresses.map((address) => ({ address, family: 4 })));
          return;
        }
        callback(null, addresses[0], 4);
      } catch (error) {
        callback(error);
      }
    };
    const request = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers: options.headers,
      lookup,
      timeout: 10000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode || 0,
          headers: { get: (name) => response.headers[String(name).toLowerCase()] || "" },
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    request.on("timeout", () => request.destroy(new Error("Public DNS fallback timed out.")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchStatus(fetchImpl, fallbackFetchImpl, url, options = {}) {
  try {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) });
    return response;
  } catch (error) {
    const message = `${error?.message || ""} ${error?.cause?.code || ""} ${error?.cause?.message || ""}`;
    if (/fetch failed|getaddrinfo|ENOTFOUND|EAI_AGAIN/i.test(message)) {
      try {
        return await fallbackFetchImpl(url, options);
      } catch (fallbackError) {
        return { status: 0, ok: false, error: fallbackError };
      }
    }
    return { status: 0, ok: false, error };
  }
}

async function verifyPublicGatewayOnce({ baseUrl, sampleVideoUrl, fetchImpl, fallbackFetchImpl }) {
  const root = await fetchStatus(fetchImpl, fallbackFetchImpl, `${baseUrl}/`);
  if (root.status !== 404) return { ok: false, reason: `Public root returned HTTP ${root.status}.` };
  for (const platform of ["instagram", "threads"]) {
    const callback = await fetchStatus(fetchImpl, fallbackFetchImpl, `${baseUrl}/api/auth/meta/${platform}/callback`);
    if (callback.status !== 400) {
      return { ok: false, reason: `${platform} callback guard returned HTTP ${callback.status}.` };
    }
  }
  const mediaUrl = `${baseUrl.replace(/\/$/, "")}/${String(sampleVideoUrl || "").replace(/^\//, "")}`;
  const head = await fetchStatus(fetchImpl, fallbackFetchImpl, mediaUrl, { method: "HEAD" });
  if (head.status !== 200 || !/video\/mp4/i.test(head.headers?.get?.("content-type") || "")) {
    return { ok: false, reason: `Public MP4 HEAD returned HTTP ${head.status}.` };
  }
  const range = await fetchStatus(fetchImpl, fallbackFetchImpl, mediaUrl, { headers: { range: "bytes=0-1" } });
  if (range.status !== 206 || (await range.arrayBuffer()).byteLength !== 2) {
    return { ok: false, reason: `Public MP4 range returned HTTP ${range.status}.` };
  }
  return { ok: true, mediaUrl };
}

async function verifyPublicGateway({
  attempts = 12,
  retryDelayMs = 2000,
  fallbackFetchImpl = fetchWithPublicDns,
  ...options
} = {}) {
  let lastResult;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await verifyPublicGatewayOnce({
      ...options,
      fetchImpl: options.fetchImpl || fetch,
      fallbackFetchImpl,
    });
    if (lastResult.ok) return { ...lastResult, attempts: attempt };
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  return { ...lastResult, attempts };
}

async function prepareMetaConnection({
  cwd = process.cwd(),
  studioOrigin = "http://localhost:49761",
  sampleVideoUrl,
  startTemporaryPublishingTunnelImpl = startTemporaryPublishingTunnel,
  verifyPublicGatewayImpl = verifyPublicGateway,
  updateEnvFileValueImpl = updateEnvFileValue,
} = {}) {
  if (!/^\/renders\/[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/.test(String(sampleVideoUrl || ""))) {
    throw new Error("A safe sample MP4 path is required.");
  }
  const managed = await startTemporaryPublishingTunnelImpl({ studioOrigin });
  const verification = await verifyPublicGatewayImpl({ baseUrl: managed.baseUrl, sampleVideoUrl });
  if (!verification.ok) {
    await managed.stop();
    throw new Error(`Temporary publishing gateway verification failed: ${verification.reason}`);
  }
  const envPath = path.join(cwd, ".env.local");
  updateEnvFileValueImpl({ envPath, key: "META_REDIRECT_BASE_URL", value: managed.baseUrl });
  updateEnvFileValueImpl({ envPath, key: "PUBLIC_MEDIA_BASE_URL", value: managed.baseUrl });
  process.env.META_REDIRECT_BASE_URL = managed.baseUrl;
  process.env.PUBLIC_MEDIA_BASE_URL = managed.baseUrl;
  return {
    ...managed,
    mediaUrl: verification.mediaUrl,
    callbacks: {
      instagram: `${managed.baseUrl}/api/auth/meta/instagram/callback`,
      threads: `${managed.baseUrl}/api/auth/meta/threads/callback`,
    },
  };
}

module.exports = { prepareMetaConnection, verifyPublicGateway };
