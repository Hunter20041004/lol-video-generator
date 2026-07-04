const {
  getInstagramConfig,
  getThreadsConfig,
  normalizeLocale,
} = require("./accounts");

const LINKABLE_PLATFORMS = new Set(["instagram", "threads"]);

function getPublishedRemoteId(job = {}) {
  if (job.platform === "instagram") {
    return job.result?.mediaId || job.mediaId || "";
  }
  if (job.platform === "threads") {
    return job.result?.postId || job.postId || "";
  }
  return "";
}

function getExistingPostUrl(job = {}) {
  return job.result?.url || job.url || "";
}

async function getJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Post link lookup failed (${response.status})`);
  }
  return json;
}

async function fetchPublishedPostUrl(job = {}, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const existingUrl = getExistingPostUrl(job);
  if (existingUrl) return existingUrl;
  if (!LINKABLE_PLATFORMS.has(job.platform)) return "";

  const locale = normalizeLocale(job.locale);
  const remoteId = getPublishedRemoteId(job);
  if (!remoteId) return "";

  if (job.platform === "instagram") {
    const { accessToken } = getInstagramConfig(locale);
    if (!accessToken) return "";
    const params = new URLSearchParams({
      fields: "permalink",
      access_token: accessToken,
    });
    const media = await getJson(`https://graph.instagram.com/v25.0/${remoteId}?${params.toString()}`, fetchImpl);
    return media.permalink || "";
  }

  const { accessToken } = getThreadsConfig(locale);
  if (!accessToken) return "";
  const params = new URLSearchParams({
    fields: "permalink",
    access_token: accessToken,
  });
  const thread = await getJson(`https://graph.threads.net/v1.0/${remoteId}?${params.toString()}`, fetchImpl);
  return thread.permalink || "";
}

async function hydratePublishedPostJob(job = {}, options = {}) {
  if (!LINKABLE_PLATFORMS.has(job.platform) || job.status !== "PUBLISHED") {
    return { job, changed: false };
  }

  let url = getExistingPostUrl(job);
  try {
    url = await fetchPublishedPostUrl(job, options);
  } catch (error) {
    console.warn(`[PostLinks] Could not fetch ${job.platform} permalink: ${error.message}`);
  }

  const nextResult = {
    ...(job.result || {}),
    ...(url ? { url } : {}),
  };
  const nextJob = {
    ...job,
    status: "PUBLISHED",
    result: Object.keys(nextResult).length > 0 ? nextResult : job.result || null,
    error: null,
  };

  const changed =
    Boolean(job.error) ||
    getExistingPostUrl(job) !== getExistingPostUrl(nextJob);

  return { job: nextJob, changed };
}

async function hydratePatchItemPostLinks(item = {}, options = {}) {
  const jobs = Array.isArray(item.publishResult?.jobs) ? item.publishResult.jobs : [];
  if (jobs.length === 0) return { item, changed: false };

  const hydratedJobs = await Promise.all(jobs.map((job) => hydratePublishedPostJob(job, options)));
  const anyJobChanged = hydratedJobs.some((entry) => entry.changed);
  const nextJobs = hydratedJobs.map((entry) => entry.job);

  if (!anyJobChanged) {
    return { item, changed: false };
  }

  const nextItem = {
    ...item,
    publishResult: {
      ...(item.publishResult || {}),
      jobs: nextJobs,
      summary: summarizeJobs(nextJobs),
    },
  };

  return { item: nextItem, changed: true };
}

function summarizeJobs(jobs = []) {
  return jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
}

module.exports = {
  getPublishedRemoteId,
  fetchPublishedPostUrl,
  hydratePublishedPostJob,
  hydratePatchItemPostLinks,
  summarizeJobs,
};
