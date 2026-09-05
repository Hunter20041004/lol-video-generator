const path = require("node:path");
const {
  startTemporaryPublishingTunnel,
  updateEnvFileValue,
} = require("./tunnel");

async function fetchStatus(fetchImpl, url, options = {}) {
  try {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) });
    return response;
  } catch (error) {
    return { status: 0, ok: false, error };
  }
}

async function verifyPublicGatewayOnce({ baseUrl, sampleVideoUrl, fetchImpl }) {
  const root = await fetchStatus(fetchImpl, `${baseUrl}/`);
  if (root.status !== 404) return { ok: false, reason: `Public root returned HTTP ${root.status}.` };
  for (const platform of ["instagram", "threads"]) {
    const callback = await fetchStatus(fetchImpl, `${baseUrl}/api/auth/meta/${platform}/callback`);
    if (callback.status !== 400) {
      return { ok: false, reason: `${platform} callback guard returned HTTP ${callback.status}.` };
    }
  }
  const mediaUrl = `${baseUrl.replace(/\/$/, "")}/${String(sampleVideoUrl || "").replace(/^\//, "")}`;
  const head = await fetchStatus(fetchImpl, mediaUrl, { method: "HEAD" });
  if (head.status !== 200 || !/video\/mp4/i.test(head.headers?.get?.("content-type") || "")) {
    return { ok: false, reason: `Public MP4 HEAD returned HTTP ${head.status}.` };
  }
  const range = await fetchStatus(fetchImpl, mediaUrl, { headers: { range: "bytes=0-1" } });
  if (range.status !== 206 || (await range.arrayBuffer()).byteLength !== 2) {
    return { ok: false, reason: `Public MP4 range returned HTTP ${range.status}.` };
  }
  return { ok: true, mediaUrl };
}

async function verifyPublicGateway({
  attempts = 12,
  retryDelayMs = 2000,
  ...options
} = {}) {
  let lastResult;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await verifyPublicGatewayOnce({ ...options, fetchImpl: options.fetchImpl || fetch });
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
