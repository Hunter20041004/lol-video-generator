const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "esports-candidate-scans.json");
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function nowDate(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value : new Date(value);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) return { version: 1, scans: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
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
  fs.writeFileSync(STORE_PATH, JSON.stringify({
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

  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : DEFAULT_MAX_AGE_MS;
  const createdAt = new Date(scan.createdAt || 0);
  const ageMs = nowDate(options.now).getTime() - createdAt.getTime();
  if (Number.isFinite(ageMs) && ageMs > maxAgeMs) {
    throw new Error(`Candidate scan expired: ${id}`);
  }
  return scan;
}

module.exports = {
  DATA_DIR,
  STORE_PATH,
  DEFAULT_MAX_AGE_MS,
  readStore,
  writeStore,
  writeCandidateSnapshot,
  readCandidateSnapshot,
};
