const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "meta-factory-snapshots.json");
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
  if (!fs.existsSync(STORE_PATH)) return { version: 1, snapshots: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { version: 1, snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [] };
  } catch {
    return { version: 1, snapshots: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify({
    version: 1,
    snapshots: Array.isArray(store.snapshots) ? store.snapshots : [],
  }, null, 2), "utf8");
}

function writeMetaSnapshot(snapshot = {}) {
  if (!snapshot.snapshotId) throw new Error("snapshotId is required.");
  const store = readStore();
  const next = { ...snapshot, createdAt: snapshot.createdAt || new Date().toISOString() };
  const index = store.snapshots.findIndex((entry) => entry.snapshotId === snapshot.snapshotId);
  if (index >= 0) store.snapshots[index] = next;
  else store.snapshots.unshift(next);
  writeStore(store);
  return next;
}

function readMetaSnapshot(snapshotId, options = {}) {
  const id = String(snapshotId || "").trim();
  const snapshot = readStore().snapshots.find((entry) => entry.snapshotId === id);
  if (!snapshot) throw new Error(`Meta snapshot not found: ${id || "UNKNOWN"}`);
  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : DEFAULT_MAX_AGE_MS;
  const createdAtMs = new Date(snapshot.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) throw new Error(`Meta snapshot has invalid createdAt: ${id}`);
  const ageMs = nowDate(options.now).getTime() - createdAtMs;
  if (Number.isFinite(ageMs) && ageMs > maxAgeMs) throw new Error(`Meta snapshot expired: ${id}`);
  return snapshot;
}

module.exports = {
  STORE_PATH,
  DEFAULT_MAX_AGE_MS,
  readStore,
  writeMetaSnapshot,
  readMetaSnapshot,
};
