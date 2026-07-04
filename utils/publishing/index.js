const fs = require("fs");
const path = require("path");
const { buildSocialCopy } = require("./copy");
const { getPublicVideoUrl, normalizeLocale } = require("./accounts");
const { createTaskId, upsertTask, updateTask, listTasks } = require("./queueStore");
const { normalizeScheduledAt, filterDueTasks } = require("./schedule");

const threads = require("./adapters/threads");
const instagram = require("./adapters/instagram");

const PLATFORM_ADAPTERS = {
  threads,
  instagram,
};

const DEFAULT_PLATFORMS = ["instagram", "threads"];
const PACKAGE_ROOT = path.join(process.cwd(), "public", "publish-packages");

const normalizePlatform = (platform) => String(platform || "instagram").toLowerCase();
const isSupportedPlatform = (platform) => Object.hasOwn(PLATFORM_ADAPTERS, normalizePlatform(platform));

function unsupportedPlatformMessage(platform) {
  return `Unsupported platform: ${normalizePlatform(platform)}`;
}

function assertSupportedPlatform(platform) {
  const normalized = normalizePlatform(platform);
  if (!isSupportedPlatform(normalized)) {
    throw new Error(unsupportedPlatformMessage(normalized));
  }
  return normalized;
}

function filterSupportedPlatforms(platforms = []) {
  return platforms.map(normalizePlatform).filter(isSupportedPlatform);
}

function resolveVideoEntries({ videoUrl, videos, locale = "zh" }) {
  if (Array.isArray(videos) && videos.length > 0) {
    return videos
      .filter((video) => video?.videoUrl)
      .map((video) => ({
        locale: normalizeLocale(video.locale || locale),
        label: video.label || (normalizeLocale(video.locale) === "en" ? "English" : "中文版"),
        videoUrl: video.videoUrl,
        fileName: video.fileName || path.basename(video.videoUrl),
      }));
  }
  if (!videoUrl) return [];
  return [
    {
      locale: normalizeLocale(locale),
      label: normalizeLocale(locale) === "en" ? "English" : "中文版",
      videoUrl,
      fileName: path.basename(videoUrl),
    },
  ];
}

function resolveLocalVideoPath(videoUrl = "") {
  const relativePath = String(videoUrl).startsWith("/") ? String(videoUrl).slice(1) : String(videoUrl);
  return path.join(process.cwd(), "public", relativePath);
}

function writePublishPackage(task) {
  fs.mkdirSync(PACKAGE_ROOT, { recursive: true });
  const dir = path.join(PACKAGE_ROOT, task.id);
  fs.mkdirSync(dir, { recursive: true });

  const captionPath = path.join(dir, `${task.platform}_${task.locale}_caption.txt`);
  const manifestPath = path.join(dir, "manifest.json");
  fs.writeFileSync(captionPath, task.copy?.caption || "", "utf8");
  fs.writeFileSync(manifestPath, JSON.stringify(task, null, 2), "utf8");

  return {
    dir,
    captionPath,
    manifestPath,
    publicDir: `/publish-packages/${task.id}`,
    publicCaptionPath: `/publish-packages/${task.id}/${task.platform}_${task.locale}_caption.txt`,
    publicManifestPath: `/publish-packages/${task.id}/manifest.json`,
  };
}

function createTask({ entry, platform, analysis, action = "queue", scheduledAt }) {
  const normalizedPlatform = normalizePlatform(platform);
  assertSupportedPlatform(normalizedPlatform);
  const locale = normalizeLocale(entry.locale);
  const filePath = resolveLocalVideoPath(entry.videoUrl);
  const copy = buildSocialCopy({ analysis, locale, platform: normalizedPlatform });
  const id = createTaskId(normalizedPlatform, locale);
  const publicVideoUrl = getPublicVideoUrl(entry.videoUrl);

  const task = {
    id,
    platform: normalizedPlatform,
    locale,
    accountSet: locale === "en" ? "EN_ACCOUNT_SET" : "ZH_ACCOUNT_SET",
    status: action === "publish" ? "PENDING" : "QUEUED",
    videoUrl: entry.videoUrl,
    publicVideoUrl,
    scheduledAt: normalizeScheduledAt(scheduledAt),
    fileName: entry.fileName || path.basename(entry.videoUrl),
    filePath,
    copy,
    result: null,
    error: null,
  };

  task.package = writePublishPackage(task);
  return upsertTask(task);
}

async function publishTask(task) {
  const adapter = PLATFORM_ADAPTERS[task.platform];
  if (!adapter) {
    return updateTask(task.id, {
      status: "FAILED",
      error: `Unsupported platform: ${task.platform}`,
    });
  }

  updateTask(task.id, { status: "UPLOADING", error: null });

  try {
    const result = await adapter.publish(task);
    const nextStatus = result.status || "PUBLISHED";
    return updateTask(task.id, {
      status: nextStatus,
      result,
      error: result.status === "FAILED" ? result.message : null,
    });
  } catch (error) {
    return updateTask(task.id, {
      status: "FAILED",
      error: error.message,
      result: null,
    });
  }
}

async function createPublishJobs({
  videoUrl,
  videos,
  analysis = {},
  socialCopy,
  locale = "zh",
  platform = "instagram",
  platforms,
  action = "queue",
  scheduledAt,
}) {
  const entries = resolveVideoEntries({ videoUrl, videos, locale });
  if (entries.length === 0) {
    throw new Error("videoUrl or videos[] is required.");
  }

  const normalizedPlatforms = Array.isArray(platforms) && platforms.length > 0
    ? platforms.map(assertSupportedPlatform)
    : normalizePlatform(platform) === "all"
      ? DEFAULT_PLATFORMS
      : [assertSupportedPlatform(platform)];

  const analysisWithCopy = socialCopy ? { ...analysis, socialCopy } : analysis;
  const jobs = [];

  for (const entry of entries) {
    if (!fs.existsSync(resolveLocalVideoPath(entry.videoUrl))) {
      throw new Error(`Video file not found: ${resolveLocalVideoPath(entry.videoUrl)}`);
    }
    for (const targetPlatform of normalizedPlatforms) {
      const task = createTask({
        entry,
        platform: targetPlatform,
        analysis: analysisWithCopy,
        action,
        scheduledAt,
      });
      jobs.push(action === "publish" ? await publishTask(task) : task);
    }
  }

  return {
    success: true,
    action,
    platforms: normalizedPlatforms,
    jobs,
    summary: summarizeJobs(jobs),
  };
}

async function retryFailedPublishJobs({
  jobs = [],
} = {}) {
  const results = [];
  for (const job of jobs) {
    if (job.status === "PUBLISHED") {
      results.push(job);
      continue;
    }
    const task = upsertTask({
      ...job,
      status: "PENDING",
      error: null,
      result: null,
      publicVideoUrl: getPublicVideoUrl(job.videoUrl),
    });
    results.push(await publishTask(task));
  }

  return {
    success: true,
    action: "publish",
    platforms: [...new Set(results.map((job) => job.platform))],
    jobs: results,
    summary: summarizeJobs(results),
    retriedExistingJobs: true,
  };
}

function summarizeJobs(jobs = []) {
  return jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
}

async function processQueuedTasks(filter = {}) {
  const tasks = listTasks({ ...filter, status: filter.status || "QUEUED" });
  const publishableTasks = filter.dueOnly
    ? filterDueTasks(tasks, filter.now ? new Date(filter.now) : new Date())
    : tasks;
  const results = [];
  for (const task of publishableTasks) {
    results.push(await publishTask(task));
  }
  return {
    success: true,
    processed: results.length,
    jobs: results,
    summary: summarizeJobs(results),
  };
}

module.exports = {
  DEFAULT_PLATFORMS,
  assertSupportedPlatform,
  filterSupportedPlatforms,
  resolveVideoEntries,
  createPublishJobs,
  retryFailedPublishJobs,
  publishTask,
  processQueuedTasks,
  summarizeJobs,
};
