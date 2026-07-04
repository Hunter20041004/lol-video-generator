const fs = require("fs");
const path = require("path");
const { isRemovedDataType } = require("./pipelineRegistry");

const RETAINED_PLATFORMS = new Set(["instagram", "threads"]);

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function itemDataType(item = {}) {
  return item.dataType || item.payload?.dataType || item.raw?.dataType || "";
}

function jobDataType(job = {}) {
  return job.analysis?.dataType || job.dataType || job.copy?.dataType || "";
}

function shouldRemoveJob(job = {}) {
  const platform = String(job.platform || "").toLowerCase();
  return isRemovedDataType(jobDataType(job)) || Boolean(platform && !RETAINED_PLATFORMS.has(platform));
}

function removePackageDir(job = {}) {
  const dir = job.package?.dir;
  if (!dir) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function pruneContentDb(cwd) {
  const dbPath = path.join(cwd, ".data", "patch-content-db.json");
  const db = readJson(dbPath, { version: 1, items: [] });
  const before = Array.isArray(db.items) ? db.items.length : 0;
  const items = (Array.isArray(db.items) ? db.items : []).filter((item) => !isRemovedDataType(itemDataType(item)));
  if (items.length !== before) writeJson(dbPath, { ...db, items });
  return before - items.length;
}

function pruneQueue(cwd) {
  const queuePath = path.join(cwd, ".data", "publish-queue.json");
  const queue = readJson(queuePath, []);
  const tasks = Array.isArray(queue) ? queue : Array.isArray(queue.tasks) ? queue.tasks : [];
  const kept = [];
  let removed = 0;
  for (const task of tasks) {
    if (shouldRemoveJob(task)) {
      removed += 1;
      removePackageDir(task);
    } else {
      kept.push(task);
    }
  }
  if (removed > 0) writeJson(queuePath, Array.isArray(queue) ? kept : { ...queue, tasks: kept });
  return removed;
}

function pruneRenderTemps(cwd) {
  const rendersDir = path.join(cwd, "public", "renders");
  if (!fs.existsSync(rendersDir)) return 0;
  let removed = 0;
  for (const file of fs.readdirSync(rendersDir)) {
    if (!/^props_.*\.json$/i.test(file)) continue;
    fs.rmSync(path.join(rendersDir, file), { force: true });
    removed += 1;
  }
  return removed;
}

function pruneCacheFiles(cwd) {
  const cachePath = path.join(cwd, "cache_meta.json");
  if (!fs.existsSync(cachePath)) return 0;
  fs.rmSync(cachePath, { force: true });
  return 1;
}

function pruneRemovedPipelineData(options = {}) {
  const cwd = options.cwd || process.cwd();
  return {
    contentItemsRemoved: pruneContentDb(cwd),
    publishJobsRemoved: pruneQueue(cwd),
    renderTempFilesRemoved: pruneRenderTemps(cwd),
    cacheFilesRemoved: pruneCacheFiles(cwd),
  };
}

module.exports = {
  pruneRemovedPipelineData,
  shouldRemoveJob,
};
