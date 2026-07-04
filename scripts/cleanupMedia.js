#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_RETENTION_HOURS = 24;
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const ACTIVE_STATUSES = new Set([
  "READY",
  "FAILED",
  "QUEUED",
  "RENDERING",
  "PUBLISHING",
  "NEEDS_AUTH",
  "NEEDS_PUBLIC_URL",
  "MANUAL_DELETE_REQUIRED",
]);

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function toTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function newestTimestamp(values = []) {
  return Math.max(0, ...values.map(toTimestamp));
}

function normalizeRenderPath(cwd, value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  if (text.startsWith("/renders/")) {
    return path.resolve(cwd, "public", text.slice(1));
  }

  if (text.startsWith("renders/")) {
    return path.resolve(cwd, "public", text);
  }

  if (path.isAbsolute(text)) {
    const marker = `${path.sep}public${path.sep}`;
    const publicIndex = text.indexOf(marker);
    if (publicIndex >= 0) {
      const publicRelativePath = text.slice(publicIndex + marker.length);
      return path.resolve(cwd, "public", publicRelativePath);
    }
    return path.resolve(text);
  }

  return "";
}

function addReference(referenceMap, filePath, timestamp, reason) {
  if (!filePath) return;
  const current = referenceMap.get(filePath);
  if (!current || timestamp > current.timestamp) {
    referenceMap.set(filePath, { timestamp, reason });
  }
}

function collectMediaReferences({ cwd, cutoffMs }) {
  const activeProtectedPaths = new Map();
  const recentReferencePaths = new Map();
  const queue = readJson(path.join(cwd, ".data", "publish-queue.json"), []);
  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : Array.isArray(queue) ? queue : [];

  for (const task of tasks) {
    const taskPaths = [
      normalizeRenderPath(cwd, task?.videoUrl),
      normalizeRenderPath(cwd, task?.filePath),
    ].filter(Boolean);
    const taskTimestamp = newestTimestamp([task?.updatedAt, task?.createdAt, task?.publishedAt]);
    const isActive = task?.status !== "PUBLISHED";

    for (const filePath of taskPaths) {
      if (isActive) addReference(activeProtectedPaths, filePath, taskTimestamp, `active publish task: ${task?.status || "UNKNOWN"}`);
      if (taskTimestamp >= cutoffMs) addReference(recentReferencePaths, filePath, taskTimestamp, "recent publish task");
    }
  }

  const database = readJson(path.join(cwd, ".data", "patch-content-db.json"), { items: [] });
  const items = Array.isArray(database?.items) ? database.items : [];

  for (const item of items) {
    const videos = Array.isArray(item?.renderResult?.videos)
      ? item.renderResult.videos
      : item?.renderResult?.videoUrl
        ? [item.renderResult]
        : [];
    const itemTimestamp = newestTimestamp([item?.updatedAt, item?.renderedAt, item?.publishedAt, item?.createdAt]);
    const isActive = item?.status !== "PUBLISHED";

    for (const video of videos) {
      const filePath = normalizeRenderPath(cwd, video?.videoUrl || video?.filePath);
      if (isActive) addReference(activeProtectedPaths, filePath, itemTimestamp, `active content item: ${item?.status || "UNKNOWN"}`);
      if (itemTimestamp >= cutoffMs) addReference(recentReferencePaths, filePath, itemTimestamp, "recent content item");
    }
  }

  return { activeProtectedPaths, recentReferencePaths };
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function cleanupRenderMedia({
  cwd = process.cwd(),
  retentionHours = DEFAULT_RETENTION_HOURS,
  deleteFiles = false,
  now = new Date(),
} = {}) {
  const cutoffMs = now.getTime() - (Number(retentionHours) || DEFAULT_RETENTION_HOURS) * 60 * 60 * 1000;
  const rendersDir = path.join(cwd, "public", "renders");
  const { activeProtectedPaths, recentReferencePaths } = collectMediaReferences({ cwd, cutoffMs });
  const files = listFilesRecursive(rendersDir)
    .filter((filePath) => VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return {
        filePath,
        relativePath: path.relative(cwd, filePath),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      };
    });

  const summary = {
    cwd,
    retentionHours: Number(retentionHours) || DEFAULT_RETENTION_HOURS,
    cutoff: new Date(cutoffMs).toISOString(),
    dryRun: !deleteFiles,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    keptRecent: [],
    keptProtected: [],
    keptRecentReference: [],
    deleted: [],
    candidates: [],
  };

  for (const file of files) {
    const protectedReference = activeProtectedPaths.get(file.filePath);
    const recentReference = recentReferencePaths.get(file.filePath);

    if (file.mtimeMs >= cutoffMs) {
      summary.keptRecent.push(file);
    } else if (protectedReference) {
      summary.keptProtected.push({ ...file, reason: protectedReference.reason });
    } else if (recentReference) {
      summary.keptRecentReference.push({ ...file, reason: recentReference.reason });
    } else {
      summary.candidates.push(file);
    }
  }

  if (deleteFiles) {
    for (const file of summary.candidates) {
      fs.rmSync(file.filePath, { force: true });
      summary.deleted.push(file);
    }
  }

  return summary;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { retentionHours: DEFAULT_RETENTION_HOURS, deleteFiles: false, json: false };
  for (const arg of argv) {
    if (arg === "--delete") options.deleteFiles = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("--hours=")) options.retentionHours = Number(arg.slice("--hours=".length));
    else if (arg === "--help" || arg === "-h") options.help = true;
  }
  return options;
}

function printSummary(summary) {
  const candidateBytes = summary.candidates.reduce((sum, file) => sum + file.size, 0);
  const deletedBytes = summary.deleted.reduce((sum, file) => sum + file.size, 0);
  console.log(`Media cleanup ${summary.dryRun ? "dry run" : "delete run"}`);
  console.log(`Project: ${summary.cwd}`);
  console.log(`Retention: ${summary.retentionHours} hours`);
  console.log(`Cutoff: ${summary.cutoff}`);
  console.log(`Total render videos: ${summary.totalFiles} (${formatBytes(summary.totalBytes)})`);
  console.log(`Kept recent files: ${summary.keptRecent.length}`);
  console.log(`Kept active/failed/queued references: ${summary.keptProtected.length}`);
  console.log(`Kept recent publish/content references: ${summary.keptRecentReference.length}`);
  console.log(`Cleanup candidates: ${summary.candidates.length} (${formatBytes(candidateBytes)})`);
  if (!summary.dryRun) console.log(`Deleted: ${summary.deleted.length} (${formatBytes(deletedBytes)})`);
  if (summary.dryRun && summary.candidates.length > 0) {
    console.log("Run with --delete to remove candidates.");
  }
  for (const file of summary.candidates.slice(0, 20)) {
    console.log(`- ${file.relativePath} (${formatBytes(file.size)})`);
  }
  if (summary.candidates.length > 20) {
    console.log(`...and ${summary.candidates.length - 20} more`);
  }
}

function main() {
  const options = parseArgs();
  if (options.help) {
    console.log("Usage: node scripts/cleanupMedia.js [--hours=24] [--delete] [--json]");
    process.exit(0);
  }
  const summary = cleanupRenderMedia(options);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanupRenderMedia,
  collectMediaReferences,
  normalizeRenderPath,
  formatBytes,
};
