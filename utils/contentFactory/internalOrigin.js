const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

function trimTrailingSlash(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getConfiguredInternalOrigin() {
  return trimTrailingSlash(
    process.env.CONTENT_FACTORY_INTERNAL_ORIGIN ||
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_INTERNAL_BASE_URL ||
    ""
  );
}

function isLoopbackHost(hostname = "") {
  const normalized = String(hostname || "").toLowerCase();
  return LOOPBACK_HOSTS.has(normalized) || /^127\./.test(normalized);
}

function resolveInternalOrigin(requestUrl, options = {}) {
  const configured = options.configuredOrigin || getConfiguredInternalOrigin();
  if (configured) return trimTrailingSlash(configured);

  const url = new URL(requestUrl);
  if (isLoopbackHost(url.hostname)) return url.origin;

  const port = options.port || process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

module.exports = {
  resolveInternalOrigin,
  isLoopbackHost,
};
