const {
  getInstagramConfig,
  getThreadsConfig,
} = require("./accounts");
const { getPublishedRemoteId } = require("./postLinks");
const { readQueue, writeQueue } = require("./queueStore");

const TRACKED_PLATFORMS = new Set(["instagram", "threads"]);
const PLATFORM_METRICS = {
  instagram: [
    "views",
    "reach",
    "likes",
    "comments",
    "saved",
    "shares",
    "ig_reels_avg_watch_time",
  ],
  threads: [
    "views",
    "likes",
    "replies",
    "reposts",
    "quotes",
    "shares",
  ],
};

class InsightsError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "InsightsError";
    this.status = details.status || 0;
    this.code = details.code || 0;
    this.needsAuth = Boolean(details.needsAuth);
  }
}

function toDate(value, fallback = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMetricValue(metric = {}) {
  if (metric.total_value && Object.hasOwn(metric.total_value, "value")) {
    return toNumber(metric.total_value.value);
  }
  if (Array.isArray(metric.values) && metric.values.length > 0) {
    return toNumber(metric.values[metric.values.length - 1]?.value);
  }
  return 0;
}

function normalizeGraphMetrics(data = []) {
  return (Array.isArray(data) ? data : []).reduce((metrics, metric) => {
    if (metric?.name) metrics[metric.name] = getMetricValue(metric);
    return metrics;
  }, {});
}

function buildInsightSnapshot(platform, data = [], capturedAt = new Date().toISOString()) {
  const metrics = normalizeGraphMetrics(data);
  const views = toNumber(metrics.views);
  const engagements = platform === "instagram"
    ? toNumber(metrics.likes) + toNumber(metrics.comments) + toNumber(metrics.saved) + toNumber(metrics.shares)
    : toNumber(metrics.likes) + toNumber(metrics.replies) + toNumber(metrics.reposts) + toNumber(metrics.quotes) + toNumber(metrics.shares);

  return {
    capturedAt,
    metrics,
    views,
    engagements,
    engagementRate: views > 0 ? Number((engagements / views).toFixed(6)) : 0,
  };
}

function getPlatformConfig(job = {}) {
  return job.platform === "instagram"
    ? getInstagramConfig(job.locale)
    : getThreadsConfig(job.locale);
}

function getPlatformEndpoint(job = {}, remoteId) {
  return job.platform === "instagram"
    ? `https://graph.instagram.com/v25.0/${remoteId}/insights`
    : `https://graph.threads.net/v1.0/${remoteId}/insights`;
}

function isAuthError(status, code) {
  return status === 401 || status === 403 || [10, 190, 200].includes(Number(code));
}

async function fetchPostInsights(job = {}, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (!TRACKED_PLATFORMS.has(job.platform)) {
    throw new InsightsError(`Unsupported insights platform: ${job.platform}`);
  }

  const remoteId = getPublishedRemoteId(job);
  if (!remoteId) {
    throw new InsightsError(`Missing published ${job.platform} post ID.`);
  }

  const { accessToken } = getPlatformConfig(job);
  if (!accessToken) {
    throw new InsightsError(`Missing ${job.platform} access token for ${job.locale || "zh"}.`, {
      needsAuth: true,
    });
  }

  const params = new URLSearchParams({
    metric: PLATFORM_METRICS[job.platform].join(","),
    access_token: accessToken,
  });
  const response = await fetchImpl(`${getPlatformEndpoint(job, remoteId)}?${params.toString()}`);
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.error) {
    const status = response.status || 0;
    const code = json.error?.code || 0;
    throw new InsightsError(json.error?.message || `${job.platform} insights request failed (${status})`, {
      status,
      code,
      needsAuth: isAuthError(status, code),
    });
  }

  return buildInsightSnapshot(
    job.platform,
    json.data,
    options.capturedAt || new Date().toISOString()
  );
}

function readPositiveMinutes(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSyncIntervalMs(job = {}, now = new Date()) {
  const publishedAt = toDate(job.createdAt || job.publishedAt || job.updatedAt, now);
  const ageMs = Math.max(0, now.getTime() - publishedAt.getTime());
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (ageMs < day) {
    return readPositiveMinutes("INSIGHTS_FRESH_INTERVAL_MINUTES", 60) * 60 * 1000;
  }
  if (ageMs < 7 * day) {
    return readPositiveMinutes("INSIGHTS_RECENT_INTERVAL_MINUTES", 360) * 60 * 1000;
  }
  return readPositiveMinutes("INSIGHTS_ARCHIVE_INTERVAL_MINUTES", 1440) * 60 * 1000;
}

function isInsightsSyncDue(job = {}, now = new Date()) {
  if (!job.insights?.nextSyncAt) return true;
  const nextSyncAt = toDate(job.insights.nextSyncAt, new Date(0));
  return nextSyncAt.getTime() <= now.getTime();
}

function appendSnapshot(insights = {}, snapshot) {
  const maxSnapshots = Math.max(1, Number(process.env.INSIGHTS_MAX_SNAPSHOTS) || 30);
  return [...(Array.isArray(insights.snapshots) ? insights.snapshots : []), snapshot].slice(-maxSnapshots);
}

function buildSuccessfulInsights(job, snapshot, now) {
  return {
    ...(job.insights || {}),
    status: "SYNCED",
    latest: snapshot,
    snapshots: appendSnapshot(job.insights, snapshot),
    lastAttemptAt: now.toISOString(),
    syncedAt: now.toISOString(),
    nextSyncAt: new Date(now.getTime() + getSyncIntervalMs(job, now)).toISOString(),
    error: null,
  };
}

function buildFailedInsights(job, error, now) {
  const needsAuth = Boolean(error.needsAuth);
  const retryMinutes = needsAuth
    ? readPositiveMinutes("INSIGHTS_AUTH_RETRY_MINUTES", 1440)
    : readPositiveMinutes("INSIGHTS_ERROR_RETRY_MINUTES", 60);

  return {
    ...(job.insights || {}),
    status: needsAuth ? "NEEDS_AUTH" : "ERROR",
    lastAttemptAt: now.toISOString(),
    nextSyncAt: new Date(now.getTime() + retryMinutes * 60 * 1000).toISOString(),
    error: {
      message: error.message,
      status: error.status || 0,
      code: error.code || 0,
      at: now.toISOString(),
    },
  };
}

function matchesFilter(task, filter = {}) {
  if (task.status !== "PUBLISHED") return false;
  if (!TRACKED_PLATFORMS.has(task.platform)) return false;
  if (filter.platform && task.platform !== filter.platform) return false;
  if (filter.locale && task.locale !== filter.locale) return false;
  return true;
}

async function syncPublishedInsights(options = {}) {
  const now = toDate(options.now);
  const tasks = readQueue();
  const limit = Number(options.limit) > 0 ? Number(options.limit) : Infinity;
  const results = [];
  let considered = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let needsAuth = 0;
  let changed = false;

  for (let index = 0; index < tasks.length && considered < limit; index += 1) {
    const task = tasks[index];
    if (!matchesFilter(task, options)) continue;
    considered += 1;

    if (!options.force && !isInsightsSyncDue(task, now)) {
      skipped += 1;
      results.push({ id: task.id, platform: task.platform, locale: task.locale, status: "SKIPPED" });
      continue;
    }

    try {
      const snapshot = await fetchPostInsights(task, {
        fetchImpl: options.fetchImpl,
        capturedAt: now.toISOString(),
      });
      tasks[index] = {
        ...task,
        insights: buildSuccessfulInsights(task, snapshot, now),
        updatedAt: now.toISOString(),
      };
      synced += 1;
      changed = true;
      results.push({
        id: task.id,
        platform: task.platform,
        locale: task.locale,
        status: "SYNCED",
        latest: snapshot,
      });
    } catch (error) {
      tasks[index] = {
        ...task,
        insights: buildFailedInsights(task, error, now),
        updatedAt: now.toISOString(),
      };
      if (error.needsAuth) needsAuth += 1;
      else failed += 1;
      changed = true;
      results.push({
        id: task.id,
        platform: task.platform,
        locale: task.locale,
        status: error.needsAuth ? "NEEDS_AUTH" : "ERROR",
        error: error.message,
      });
    }
  }

  if (changed) writeQueue(tasks);

  return {
    success: true,
    considered,
    synced,
    skipped,
    failed,
    needsAuth,
    results,
  };
}

function mergePatchItemInsightsFromQueue(item = {}, tasks = readQueue()) {
  const jobs = Array.isArray(item.publishResult?.jobs) ? item.publishResult.jobs : [];
  if (jobs.length === 0) return item;
  const tasksById = tasks instanceof Map ? tasks : new Map(tasks.map((task) => [task.id, task]));
  const nextJobs = jobs.map((job) => {
    const task = tasksById.get(job.id);
    return task?.insights ? { ...job, insights: task.insights } : job;
  });

  return {
    ...item,
    publishResult: {
      ...(item.publishResult || {}),
      jobs: nextJobs,
    },
  };
}

function summarizeTrackedInsights(tasks = readQueue()) {
  return tasks.filter((task) => matchesFilter(task)).reduce((summary, task) => {
    const status = task.insights?.status || "PENDING";
    summary.total += 1;
    summary.byPlatform[task.platform] = (summary.byPlatform[task.platform] || 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    return summary;
  }, { total: 0, byPlatform: {}, byStatus: {} });
}

function getPreviousSnapshot(insights = {}) {
  const snapshots = Array.isArray(insights.snapshots) ? insights.snapshots : [];
  if (snapshots.length < 2) return null;
  return snapshots[snapshots.length - 2] || null;
}

function buildTrackedPost(task = {}) {
  const latest = task.insights?.latest || null;
  const previous = getPreviousSnapshot(task.insights);
  const latestViews = toNumber(latest?.views);
  const latestEngagements = toNumber(latest?.engagements);
  const previousViews = toNumber(previous?.views);
  const previousEngagements = toNumber(previous?.engagements);

  return {
    id: task.id,
    platform: task.platform,
    locale: task.locale || "zh",
    status: task.insights?.status || "PENDING",
    title: task.copy?.title || task.copy?.caption?.split("\n").find(Boolean) || task.fileName || task.id,
    description: task.copy?.description || "",
    url: task.result?.url || task.url || "",
    publishedAt: task.publishedAt || task.createdAt || task.updatedAt || null,
    syncedAt: task.insights?.syncedAt || null,
    nextSyncAt: task.insights?.nextSyncAt || null,
    error: task.insights?.error || null,
    latest,
    delta: {
      views: previous ? latestViews - previousViews : null,
      engagements: previous ? latestEngagements - previousEngagements : null,
    },
  };
}

function summarizeReportPosts(posts = []) {
  const summary = {
    posts: posts.length,
    synced: 0,
    views: 0,
    engagements: 0,
    engagementRate: 0,
    metrics: {},
    lastSyncedAt: null,
  };

  for (const post of posts) {
    if (post.status === "SYNCED") summary.synced += 1;
    summary.views += toNumber(post.latest?.views);
    summary.engagements += toNumber(post.latest?.engagements);
    for (const [name, value] of Object.entries(post.latest?.metrics || {})) {
      summary.metrics[name] = (summary.metrics[name] || 0) + toNumber(value);
    }
    if (post.syncedAt && (!summary.lastSyncedAt || post.syncedAt > summary.lastSyncedAt)) {
      summary.lastSyncedAt = post.syncedAt;
    }
  }

  summary.engagementRate = summary.views > 0
    ? Number((summary.engagements / summary.views).toFixed(6))
    : 0;
  return summary;
}

function buildInsightsReport(tasks = readQueue()) {
  const posts = tasks
    .filter((task) => matchesFilter(task))
    .map(buildTrackedPost)
    .sort((a, b) => toNumber(b.latest?.views) - toNumber(a.latest?.views));

  const groupBy = (key, values) => values.reduce((groups, value) => {
    groups[value] = summarizeReportPosts(posts.filter((post) => post[key] === value));
    return groups;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: summarizeReportPosts(posts),
    byPlatform: groupBy("platform", ["instagram", "threads"]),
    byLocale: groupBy("locale", ["zh", "en"]),
    posts,
  };
}

module.exports = {
  TRACKED_PLATFORMS,
  PLATFORM_METRICS,
  InsightsError,
  normalizeGraphMetrics,
  buildInsightSnapshot,
  fetchPostInsights,
  getSyncIntervalMs,
  isInsightsSyncDue,
  syncPublishedInsights,
  mergePatchItemInsightsFromQueue,
  summarizeTrackedInsights,
  buildInsightsReport,
};
