const fs = require("fs");
const path = require("path");

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const BACKOFF_RESET_MS = 6 * 60 * 60 * 1000;
const BACKOFF_COOLDOWN_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
];
const cooldowns = new Map();

function dataDir() {
  return path.join(process.cwd(), ".data");
}

function storePath() {
  return path.join(dataDir(), "esports-source-cooldowns.json");
}

function normalizeSource(source) {
  return String(source || "").trim().toLowerCase();
}

function getNowMs(options = {}) {
  return Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
}

function ensureDataDir() {
  fs.mkdirSync(dataDir(), { recursive: true });
}

function readStore() {
  ensureDataDir();
  const filePath = storePath();
  if (!fs.existsSync(filePath)) return { version: 1, cooldowns: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      version: 1,
      cooldowns: Array.isArray(parsed.cooldowns) ? parsed.cooldowns : [],
    };
  } catch (error) {
    console.warn(`[SourceCooldownStore] Could not parse store: ${error.message}`);
    return { version: 1, cooldowns: [] };
  }
}

function writeStore(records) {
  ensureDataDir();
  fs.writeFileSync(storePath(), JSON.stringify({
    version: 1,
    cooldowns: Array.from(records.values()).map((record) => ({
      source: record.source,
      untilMs: record.untilMs,
      reason: record.reason || "rate_limit",
      createdAt: record.createdAt || new Date().toISOString(),
      attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : 1,
    })),
  }, null, 2), "utf8");
}

function hydrateCooldowns() {
  cooldowns.clear();
  for (const record of readStore().cooldowns) {
    const source = normalizeSource(record.source);
    const untilMs = Number(record.untilMs);
    if (!source || !Number.isFinite(untilMs)) continue;
    cooldowns.set(source, {
      source,
      untilMs,
      reason: record.reason || "rate_limit",
      createdAt: record.createdAt || new Date().toISOString(),
      attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : 1,
    });
  }
}

function resolveAttempts(existing, nowMs, reason) {
  if (!existing || existing.reason !== reason) return 1;
  const previousCreatedAtMs = Date.parse(existing.createdAt || "");
  if (!Number.isFinite(previousCreatedAtMs)) return 1;
  if (nowMs - previousCreatedAtMs > BACKOFF_RESET_MS) return 1;
  return Math.max(1, Number(existing.attempts) || 1) + 1;
}

function defaultCooldownMsForAttempts(attempts) {
  const index = Math.max(0, Math.min(BACKOFF_COOLDOWN_MS.length - 1, attempts - 1));
  return BACKOFF_COOLDOWN_MS[index];
}

function readSourceCooldown(source, options = {}) {
  hydrateCooldowns();
  const key = normalizeSource(source);
  const record = cooldowns.get(key);
  const nowMs = getNowMs(options);

  if (!record || !Number.isFinite(record.untilMs)) {
    return { active: false, source: key };
  }

  if (record.untilMs <= nowMs) {
    return {
      active: false,
      source: key,
      reason: record.reason || "rate_limit",
      cooldownUntil: new Date(record.untilMs).toISOString(),
      cooldownUntilMs: record.untilMs,
      retryAfterSeconds: 0,
      attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : 1,
    };
  }

  return {
    active: true,
    source: key,
    reason: record.reason || "rate_limit",
    cooldownUntil: new Date(record.untilMs).toISOString(),
    cooldownUntilMs: record.untilMs,
    retryAfterSeconds: Math.max(1, Math.ceil((record.untilMs - nowMs) / 1000)),
    attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : 1,
  };
}

function recordSourceCooldown(source, options = {}) {
  hydrateCooldowns();
  const key = normalizeSource(source);
  const nowMs = getNowMs(options);
  const reason = options.reason || "rate_limit";
  const existing = cooldowns.get(key);
  const attempts = Number.isFinite(Number(options.attempts))
    ? Number(options.attempts)
    : resolveAttempts(existing, nowMs, reason);
  const cooldownMs = Number.isFinite(options.cooldownMs)
    ? options.cooldownMs
    : defaultCooldownMsForAttempts(attempts);
  const untilMs = Number.isFinite(options.untilMs) ? options.untilMs : nowMs + cooldownMs;

  cooldowns.set(key, {
    source: key,
    untilMs,
    reason,
    createdAt: new Date(nowMs).toISOString(),
    attempts,
  });

  writeStore(cooldowns);
  return readSourceCooldown(key, { nowMs });
}

function clearSourceCooldown(source) {
  hydrateCooldowns();
  cooldowns.delete(normalizeSource(source));
  writeStore(cooldowns);
}

function createSourceCooldownError(source, cooldown, message) {
  const activeCooldown = cooldown?.active ? cooldown : readSourceCooldown(source);
  const label = normalizeSource(source) === "leaguepedia" ? "Leaguepedia API" : `${source} source`;
  const error = new Error(message || `${label} cooldown active until ${activeCooldown.cooldownUntil || "unknown"}`);
  error.code = normalizeSource(source) === "leaguepedia" ? "LEAGUEPEDIA_RATE_LIMITED" : "SOURCE_COOLDOWN_ACTIVE";
  error.status = 429;
  error.recoverable = true;
  error.source = normalizeSource(source);
  error.cooldownUntil = activeCooldown.cooldownUntil || "";
  error.retryAfterSeconds = activeCooldown.retryAfterSeconds || 0;
  return error;
}

module.exports = {
  BACKOFF_COOLDOWN_MS,
  BACKOFF_RESET_MS,
  DEFAULT_COOLDOWN_MS,
  clearSourceCooldown,
  createSourceCooldownError,
  readStore,
  readSourceCooldown,
  recordSourceCooldown,
  storePath,
};
