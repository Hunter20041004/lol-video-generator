const { runDailyEsportsPipeline } = require("./dailyPipeline");
const { createEsportsPublishJobs: defaultCreateEsportsPublishJobs, ESPORTS_PLATFORMS } = require("./publishing");
const { fetchCompletedSeriesForDate } = require("./seriesFetcher");
const { hasPublishedSeries, upsertRun } = require("./runStore");
const { ensurePublicMediaBaseUrl: defaultEnsurePublicMediaBaseUrl } = require("../publishing/tunnel");
const { renderVideosFromRequest } = require("../render/renderService");

const DEFAULT_ONE_CLICK_LANGUAGES = ["zh"];
const DEFAULT_ONE_CLICK_VIDEO_TYPES = ["recap"];
const DEFAULT_DAILY_TIME_ZONE = "America/Los_Angeles";

function localDateOffset(daysAgo = 1, nowInput = new Date(), timeZone = DEFAULT_DAILY_TIME_ZONE) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const target = new Date(now.getTime() - Math.max(0, Number(daysAgo) || 0) * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeActiveMode(value = "auto") {
  return value === "daily" ? "auto" : value;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function renderSelectedVideos({ contentPlan, languages = DEFAULT_ONE_CLICK_LANGUAGES, videoTypes = DEFAULT_ONE_CLICK_VIDEO_TYPES }) {
  const payloads = languages.flatMap((locale) =>
    videoTypes.map((type) => ({
      type,
      locale,
      payload: contentPlan.localized?.[locale]?.[type],
    }))
  ).filter((entry) => entry.payload);

  const videos = [];
  for (const entry of payloads) {
    const result = await renderVideosFromRequest({
      ...entry.payload,
      locale: entry.locale,
      renderLanguages: [entry.locale],
    });
    const video = Array.isArray(result.videos) ? result.videos[0] : {
      locale: entry.locale,
      videoUrl: result.videoUrl,
      fileName: result.fileName,
    };
    videos.push({ ...video, type: entry.type, locale: entry.locale });
  }
  return videos;
}

async function runDailyOneClick(options = {}, deps = {}) {
  const now = options.now || new Date();
  const date = options.date || localDateOffset(1, now, options.timeZone);
  const languages = DEFAULT_ONE_CLICK_LANGUAGES;
  const videoTypes = DEFAULT_ONE_CLICK_VIDEO_TYPES;
  const platforms = Array.isArray(options.platforms) && options.platforms.length > 0
    ? options.platforms
    : ESPORTS_PLATFORMS;
  const maxSeries = normalizePositiveInteger(options.maxSeries, 2);
  const publicMediaResults = [];

  const ensurePublicMediaBaseUrl = deps.ensurePublicMediaBaseUrl || defaultEnsurePublicMediaBaseUrl;
  const createEsportsPublishJobs = async (seriesRun) => {
    const sampleVideoUrl = seriesRun.videos?.find((video) => video?.videoUrl)?.videoUrl || "";
    if (sampleVideoUrl) {
      publicMediaResults.push(await ensurePublicMediaBaseUrl({
        action: "publish",
        platforms,
        sampleVideoUrl,
      }));
    }
    return defaultCreateEsportsPublishJobs({
      ...seriesRun,
      platforms,
      publishAction: "publish",
    }, {
      createPublishJobs: deps.createPublishJobs,
    });
  };

  const run = await runDailyEsportsPipeline({
    dryRun: false,
    allowRepublish: Boolean(options.allowRepublish),
    date,
    now,
    activeMode: normalizeActiveMode(options.activeMode || "auto"),
    languages,
    videoTypes,
    config: {
      ...(options.config || {}),
      maxDailySeries: maxSeries,
    },
  }, {
    fetchSeriesCandidates: deps.fetchSeriesCandidates || fetchCompletedSeriesForDate,
    hasPublishedSeries: deps.hasPublishedSeries || hasPublishedSeries,
    renderSeriesVideos: deps.renderSeriesVideos || renderSelectedVideos,
    createEsportsPublishJobs,
    upsertRun: deps.upsertRun || upsertRun,
  });

  return {
    success: true,
    date,
    publicMedia: publicMediaResults,
    run,
  };
}

module.exports = {
  DEFAULT_DAILY_TIME_ZONE,
  DEFAULT_ONE_CLICK_LANGUAGES,
  DEFAULT_ONE_CLICK_VIDEO_TYPES,
  localDateOffset,
  renderSelectedVideos,
  runDailyOneClick,
};
