const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FALLBACK_MAX_AGE_MS = 7 * DEFAULT_MAX_AGE_MS;

function getDataDir(cwd = process.cwd()) {
  return path.join(cwd, ".data");
}

function getStorePath(cwd = process.cwd()) {
  return path.join(getDataDir(cwd), "esports-candidate-scans.json");
}

function nowDate(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value : new Date(value);
}

function ensureDataDir() {
  fs.mkdirSync(getDataDir(), { recursive: true });
}

function readStore() {
  ensureDataDir();
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) return { version: 1, scans: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return {
      version: 1,
      scans: Array.isArray(parsed.scans) ? parsed.scans : [],
    };
  } catch (error) {
    return { version: 1, scans: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(getStorePath(), JSON.stringify({
    version: 1,
    scans: Array.isArray(store.scans) ? store.scans : [],
  }, null, 2), "utf8");
}

function writeCandidateSnapshot(snapshot = {}) {
  const store = readStore();
  const scanId = snapshot.scanId;
  if (!scanId) throw new Error("scanId is required.");
  const index = store.scans.findIndex((scan) => scan.scanId === scanId);
  const next = {
    ...snapshot,
    createdAt: snapshot.createdAt || new Date().toISOString(),
  };
  if (index >= 0) store.scans[index] = next;
  else store.scans.unshift(next);
  writeStore(store);
  return next;
}

function readCandidateSnapshot(scanId, options = {}) {
  const id = String(scanId || "").trim();
  const scan = readStore().scans.find((entry) => entry.scanId === id);
  if (!scan) throw new Error(`Candidate scan not found: ${id || "UNKNOWN"}`);

  const fallbackAllowed = isRateLimitFallback(scan) && isCompleteSnapshot(scan) && isHistoricalDate(scan.date, options.now);
  const defaultMaxAgeMs = fallbackAllowed ? FALLBACK_MAX_AGE_MS : DEFAULT_MAX_AGE_MS;
  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : defaultMaxAgeMs;
  const createdAt = new Date(scan.createdAt || 0);
  const ageMs = nowDate(options.now).getTime() - createdAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
    throw new Error(`Candidate scan expired: ${id}`);
  }
  return scan;
}

function normalizedSet(values) {
  return JSON.stringify([...new Set((Array.isArray(values) ? values : []).map((value) => String(value).toLowerCase()))].sort());
}

function isHistoricalDate(date, now = () => new Date()) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    && date < nowDate(now).toISOString().slice(0, 10);
}

function isRateLimitFallback(scan) {
  return scan?.sourceStatus?.status === "cached" && scan.sourceStatus.cacheReason === "rate_limit"
    && scan.sourceStatus.cachedAt === scan.createdAt;
}

function isCompleteSnapshot(scan) {
  return (scan?.sourceStatus?.status === "ready" || isRateLimitFallback(scan))
    && Array.isArray(scan.candidates) && scan.candidates.length > 0
    && scan.candidates.every((candidate) => candidate?.completeness?.hasTenPlayers === true
      && candidate.completeness.hasFiveRoleMatchups === true
      && candidate.players?.length === 10
      && candidate.roleMatchups?.length === 5
      && candidate.roleMatchups.every((matchup) => matchup.left && matchup.right));
}

function findLatestCompatibleSnapshot(criteria, options = {}) {
  const nowMs = nowDate(options.now).getTime();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  return readStore().scans.filter((scan) => {
    const ageMs = nowMs - Date.parse(scan?.createdAt);
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs
      && isCompleteSnapshot(scan)
      && scan.date === criteria.date && scan.activeMode === criteria.activeMode
      && scan.tournamentScope === criteria.tournamentScope
      && normalizedSet(scan.languages) === normalizedSet(criteria.languages)
      && (!criteria.activeModeDetails || normalizedSet(scan.activeModeDetails?.tournaments) === normalizedSet(criteria.activeModeDetails.tournaments));
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null;
}

const candidateStore = {
  DEFAULT_MAX_AGE_MS,
  FALLBACK_MAX_AGE_MS,
  getDataDir,
  getStorePath,
  readStore,
  writeStore,
  writeCandidateSnapshot,
  readCandidateSnapshot,
  findLatestCompatibleSnapshot,
  isHistoricalDate,
};

Object.defineProperties(candidateStore, {
  DATA_DIR: { enumerable: true, get: () => getDataDir() },
  STORE_PATH: { enumerable: true, get: () => getStorePath() },
});

module.exports = candidateStore;
