const fs = require("fs");
const path = require("path");

const META_API_VERSION = "v25.0";

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

const THREADS_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_insights",
  "threads_delete",
];

function normalizeLocale(locale = "zh") {
  return String(locale || "zh").toLowerCase().startsWith("en") ? "en" : "zh";
}

function normalizeUsername(username = "") {
  return String(username || "").trim().replace(/^@/, "").toLowerCase();
}

function getBaseUrl() {
  return (
    process.env.META_REDIRECT_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getMetaAppConfig() {
  return {
    appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "",
  };
}

function getInstagramAppConfig() {
  const metaConfig = getMetaAppConfig();
  return {
    appId: process.env.INSTAGRAM_APP_ID || metaConfig.appId,
    appSecret: process.env.INSTAGRAM_APP_SECRET || metaConfig.appSecret,
  };
}

function getThreadsAppConfig() {
  const metaConfig = getMetaAppConfig();
  return {
    appId: process.env.THREADS_APP_ID || metaConfig.appId,
    appSecret: process.env.THREADS_APP_SECRET || metaConfig.appSecret,
  };
}

function getInstagramRedirectUri() {
  return `${getBaseUrl()}/api/auth/meta/instagram/callback`;
}

function getThreadsRedirectUri() {
  return `${getBaseUrl()}/api/auth/meta/threads/callback`;
}

function buildInstagramAuthUrl(locale = "zh") {
  const { appId } = getInstagramAppConfig();
  const state = `instagram:${normalizeLocale(locale)}`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES.join(","),
    state,
    force_reauth: "true",
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

function buildThreadsAuthUrl(locale = "zh") {
  const { appId } = getThreadsAppConfig();
  const state = `threads:${normalizeLocale(locale)}`;
  const params = new URLSearchParams({
    client_id: appId,
    app_id: appId,
    platform_app_id: appId,
    redirect_uri: getThreadsRedirectUri(),
    response_type: "code",
    scope: THREADS_SCOPES.join(","),
    state,
  });
  return `https://threads.net/oauth/authorize?${params.toString()}`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Meta API failed (${response.status})`);
  }
  return json;
}

async function exchangeInstagramCode(code) {
  const { appId, appSecret } = getInstagramAppConfig();
  const shortToken = await fetchJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: getInstagramRedirectUri(),
      code,
    }),
  });

  const longToken = await fetchJson(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortToken.access_token,
    }).toString()}`
  );

  return {
    accessToken: longToken.access_token || shortToken.access_token,
    userId: shortToken.user_id ? String(shortToken.user_id) : "",
  };
}

async function exchangeThreadsCode(code) {
  const { appId, appSecret } = getThreadsAppConfig();
  const shortToken = await fetchJson("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: getThreadsRedirectUri(),
      code,
      grant_type: "authorization_code",
    }),
  });

  const longToken = await fetchJson(
    `https://graph.threads.net/access_token?${new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: appSecret,
      access_token: shortToken.access_token,
    }).toString()}`
  );

  return longToken.access_token || shortToken.access_token;
}

async function getInstagramProfile(accessToken) {
  const params = new URLSearchParams({
    fields: "id,username,account_type",
    access_token: accessToken,
  });
  return fetchJson(`https://graph.instagram.com/me?${params.toString()}`);
}

async function getThreadsProfile(accessToken) {
  const params = new URLSearchParams({
    fields: "id,username",
    access_token: accessToken,
  });
  return fetchJson(`https://graph.threads.net/v1.0/me?${params.toString()}`);
}

function getExpectedInstagramUsername(locale = "zh") {
  const suffix = normalizeLocale(locale).toUpperCase();
  return normalizeUsername(process.env[`INSTAGRAM_${suffix}_EXPECTED_USERNAME`]);
}

function assertExpectedInstagramUsername(locale, actualUsername) {
  const expected = getExpectedInstagramUsername(locale);
  const actual = normalizeUsername(actualUsername);
  if (expected && actual !== expected) {
    throw new Error(`Expected Instagram ${normalizeLocale(locale)} account ${expected}, got ${actual || "unknown"}`);
  }
}

function getExpectedThreadsUsername(locale = "zh") {
  const suffix = normalizeLocale(locale).toUpperCase();
  return normalizeUsername(process.env[`THREADS_${suffix}_EXPECTED_USERNAME`]);
}

function assertExpectedThreadsUsername(locale, actualUsername) {
  const expected = getExpectedThreadsUsername(locale);
  const actual = normalizeUsername(actualUsername);
  if (expected && actual !== expected) {
    throw new Error(`Expected Threads ${normalizeLocale(locale)} account ${expected}, got ${actual || "unknown"}`);
  }
}

function upsertEnv(content, key, value) {
  if (content.match(new RegExp(`^${key}=.*`, "m"))) {
    return content.replace(new RegExp(`^${key}=.*`, "m"), `${key}=${value}`);
  }
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

function persistEnv(values) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    if (value) content = upsertEnv(content, key, value);
  }
  fs.writeFileSync(envPath, content, "utf8");
}

module.exports = {
  INSTAGRAM_SCOPES,
  THREADS_SCOPES,
  normalizeLocale,
  normalizeUsername,
  getMetaAppConfig,
  getInstagramAppConfig,
  getThreadsAppConfig,
  getInstagramRedirectUri,
  getThreadsRedirectUri,
  buildInstagramAuthUrl,
  buildThreadsAuthUrl,
  exchangeInstagramCode,
  exchangeThreadsCode,
  getInstagramProfile,
  getThreadsProfile,
  getExpectedInstagramUsername,
  assertExpectedInstagramUsername,
  getExpectedThreadsUsername,
  assertExpectedThreadsUsername,
  upsertEnv,
  persistEnv,
};
