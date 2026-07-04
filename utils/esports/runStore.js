const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "esports-daily-runs.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) return { version: 1, runs: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return {
      version: 1,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch (error) {
    console.warn(`[EsportsRunStore] Could not parse store: ${error.message}`);
    return { version: 1, runs: [] };
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify({
    version: 1,
    runs: Array.isArray(store.runs) ? store.runs : [],
  }, null, 2), "utf8");
}

function createRunId(run = {}) {
  if (run.runId) return run.runId;
  const kind = run.dryRun ? "dry" : "daily";
  const date = run.date || new Date().toISOString().slice(0, 10);
  return `${kind}-${date}`;
}

function upsertRun(run = {}) {
  const store = readStore();
  const runId = createRunId(run);
  const index = store.runs.findIndex((item) => item.runId === runId);
  const nextRun = {
    ...run,
    runId,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) {
    store.runs[index] = { ...store.runs[index], ...nextRun };
  } else {
    store.runs.unshift({ ...nextRun, createdAt: new Date().toISOString() });
  }
  writeStore(store);
  return nextRun;
}

function listRuns(filter = {}) {
  const runs = readStore().runs;
  return runs.filter((run) => {
    if (filter.date && run.date !== filter.date) return false;
    if (filter.status && run.status !== filter.status) return false;
    if (filter.dryRun !== undefined && run.dryRun !== filter.dryRun) return false;
    return true;
  });
}

function hasPublishedSeries(seriesId) {
  if (!seriesId) return false;
  return readStore().runs.some((run) => {
    if (run.dryRun) return false;
    const publishedStatus = ["PUBLISHED", "QUEUED", "READY"].includes(run.status);
    const hasSeries = (run.selected || []).some((item) => item.seriesId === seriesId) ||
      (run.outputs || []).some((item) => item.seriesId === seriesId);
    const hasJobs = Array.isArray(run.publishJobs) && run.publishJobs.length > 0;
    return publishedStatus && hasSeries && hasJobs;
  });
}

function appendManualAction(seriesId, action = {}) {
  const store = readStore();
  const targetRun = store.runs.find((run) =>
    (run.selected || []).some((item) => item.seriesId === seriesId) ||
    (run.outputs || []).some((item) => item.seriesId === seriesId)
  );
  if (!targetRun) return null;
  targetRun.manualActions = [
    ...(Array.isArray(targetRun.manualActions) ? targetRun.manualActions : []),
    {
      ...action,
      seriesId,
      createdAt: action.createdAt || new Date().toISOString(),
    },
  ];
  targetRun.updatedAt = new Date().toISOString();
  writeStore(store);
  return targetRun;
}

module.exports = {
  DATA_DIR,
  STORE_PATH,
  readStore,
  writeStore,
  upsertRun,
  listRuns,
  hasPublishedSeries,
  appendManualAction,
};
