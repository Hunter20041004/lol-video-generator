const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const ALLOWED_PLATFORMS = new Set(["instagram", "threads"]);

function normalizePlatform(value) {
  const platform = String(value || "").toLowerCase();
  if (!ALLOWED_PLATFORMS.has(platform)) throw challengeError("OAUTH_STATE_PLATFORM_INVALID");
  return platform;
}

function normalizeLocale(value = "zh") {
  return String(value || "zh").toLowerCase().startsWith("en") ? "en" : "zh";
}

function challengeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function storePath(cwd = process.cwd()) {
  return path.join(cwd, ".data", "meta-oauth-challenges.json");
}

function readStore(cwd) {
  const filename = storePath(cwd);
  try {
    const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
    return { version: 1, challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [] };
  } catch {
    return { version: 1, challenges: [] };
  }
}

function writeStore(cwd, store) {
  const filename = storePath(cwd);
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filename);
  fs.chmodSync(filename, 0o600);
}

function hashNonce(nonce) {
  return crypto.createHash("sha256").update(nonce).digest("hex");
}

function createOAuthChallenge({
  platform,
  locale = "zh",
  now = () => new Date(),
  randomBytesImpl = crypto.randomBytes,
  cwd = process.cwd(),
} = {}) {
  const safePlatform = normalizePlatform(platform);
  const safeLocale = normalizeLocale(locale);
  const nonceBuffer = randomBytesImpl(32);
  if (!Buffer.isBuffer(nonceBuffer) || nonceBuffer.length < 32) {
    throw challengeError("OAUTH_STATE_RANDOM_INVALID");
  }
  const nonce = nonceBuffer.toString("base64url");
  const createdAt = new Date(now());
  const expiresAt = new Date(createdAt.getTime() + CHALLENGE_TTL_MS);
  const store = readStore(cwd);
  store.challenges = store.challenges
    .filter((entry) => new Date(entry.expiresAt).getTime() > createdAt.getTime())
    .concat({
      nonceHash: hashNonce(nonce),
      platform: safePlatform,
      locale: safeLocale,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  writeStore(cwd, store);
  return { state: `${safePlatform}.${safeLocale}.${nonce}`, expiresAt: expiresAt.toISOString() };
}

function consumeOAuthChallenge(state, {
  platform,
  now = () => new Date(),
  cwd = process.cwd(),
} = {}) {
  const safePlatform = normalizePlatform(platform);
  const match = String(state || "").match(/^(instagram|threads)\.(zh|en)\.([A-Za-z0-9_-]{43})$/);
  if (!match) throw challengeError("OAUTH_STATE_INVALID");
  const [, statePlatform, locale, nonce] = match;
  if (statePlatform !== safePlatform) throw challengeError("OAUTH_STATE_PLATFORM_INVALID");

  const store = readStore(cwd);
  const entry = store.challenges.find((candidate) => candidate.nonceHash === hashNonce(nonce));
  if (!entry || entry.platform !== statePlatform || entry.locale !== locale) {
    throw challengeError("OAUTH_STATE_INVALID");
  }
  if (entry.consumedAt) throw challengeError("OAUTH_STATE_REPLAYED");
  const current = new Date(now());
  if (!Number.isFinite(current.getTime()) || new Date(entry.expiresAt).getTime() <= current.getTime()) {
    throw challengeError("OAUTH_STATE_EXPIRED");
  }
  entry.consumedAt = current.toISOString();
  writeStore(cwd, store);
  return { platform: entry.platform, locale: entry.locale };
}

module.exports = {
  CHALLENGE_TTL_MS,
  consumeOAuthChallenge,
  createOAuthChallenge,
  normalizeLocale,
  normalizePlatform,
};
