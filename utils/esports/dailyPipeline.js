const { resolveActiveMode, mergeEsportsConfig } = require("./config");
const { aggregateSeries } = require("./seriesAggregator");
const { scoreSeries, selectDailySeries } = require("./matchScorer");
const { planSeriesContent } = require("./contentPlanner");
const { evaluateSeriesGate } = require("./gatekeeper");
const { createEsportsPublishJobs: defaultCreateEsportsPublishJobs } = require("./publishing");
const {
  hasPublishedSeries: defaultHasPublishedSeries,
  upsertRun: defaultUpsertRun,
} = require("./runStore");

function isoDate(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function defaultFetchSeriesCandidates() {
  throw new Error("fetchSeriesCandidates dependency is required for esports daily pipeline.");
}

function isAggregatedSeries(candidate = {}) {
  return Array.isArray(candidate.players) && Array.isArray(candidate.roleMatchups);
}

function prepareSeries(candidate = {}, config = {}) {
  const aggregated = isAggregatedSeries(candidate)
    ? candidate
    : aggregateSeries(candidate.games || []);
  const selectionScore = Number.isFinite(Number(candidate.selectionScore ?? candidate.priorityScore ?? candidate.score))
    ? Number(candidate.selectionScore ?? candidate.priorityScore ?? candidate.score)
    : scoreSeries({ ...aggregated, ...candidate }, config);
  const seriesScore = candidate.seriesScore || candidate.scoreLabel || (typeof aggregated.score === "string" ? aggregated.score : "");

  return {
    ...candidate,
    ...aggregated,
    score: selectionScore,
    selectionScore,
    seriesScore,
  };
}

function contentSeriesFor(selected = {}) {
  return {
    ...selected,
    score: selected.seriesScore || selected.scoreLabel || selected.matchScore || selected.score,
  };
}

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

async function defaultRenderSeriesVideos({ series }) {
  const base = String(series.seriesId || "series").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return [
    { type: "radar", locale: "zh", videoUrl: `/renders/${base}-radar-zh.mp4`, exists: true },
    { type: "radar", locale: "en", videoUrl: `/renders/${base}-radar-en.mp4`, exists: true },
    { type: "recap", locale: "zh", videoUrl: `/renders/${base}-recap-zh.mp4`, exists: true },
    { type: "recap", locale: "en", videoUrl: `/renders/${base}-recap-en.mp4`, exists: true },
  ];
}

async function runDailyEsportsPipeline(options = {}, deps = {}) {
  const date = isoDate(options.date || new Date());
  const config = mergeEsportsConfig({ ...options.config, activeMode: options.activeMode || options.config?.activeMode });
  const activeMode = resolveActiveMode(config, options.now || new Date(`${date}T15:30:00.000Z`));
  const dryRun = Boolean(options.dryRun);
  const languages = normalizeLanguages(options.languages);
  const fetchSeriesCandidates = deps.fetchSeriesCandidates || defaultFetchSeriesCandidates;
  const hasPublishedSeries = deps.hasPublishedSeries || defaultHasPublishedSeries;
  const renderSeriesVideos = deps.renderSeriesVideos || defaultRenderSeriesVideos;
  const createEsportsPublishJobs = deps.createEsportsPublishJobs || defaultCreateEsportsPublishJobs;
  const upsertRun = deps.upsertRun || defaultUpsertRun;

  const rawCandidates = await fetchSeriesCandidates({ date, activeMode, config });
  const candidates = rawCandidates
    .map((candidate) => prepareSeries(candidate, config))
    .filter((series) => options.allowRepublish || dryRun || !hasPublishedSeries(series.seriesId));
  const selected = options.seriesId
    ? candidates.filter((series) => series.seriesId === options.seriesId).slice(0, 1)
    : selectDailySeries(candidates, { ...config, activeMode: activeMode.mode });
  const outputs = [];
  const publishJobs = [];

  for (const selectedSeries of selected) {
    const series = contentSeriesFor(selectedSeries);
    const contentPlan = planSeriesContent(series);
    const videos = await renderSeriesVideos({ series, contentPlan, dryRun, languages });
    const requiredVideoCount = languages.length * 2;
    const seriesRun = {
      seriesId: series.seriesId,
      dryRun,
      languages,
      status: videos.length === requiredVideoCount ? "RENDERED" : "FAILED",
      series,
      semantic: contentPlan.semantic,
      localized: contentPlan.localized,
      videos,
      publishReady: true,
    };
    const gate = evaluateSeriesGate(seriesRun);
    const output = { ...seriesRun, gate };

    if (!dryRun && gate.passed) {
      const publishResult = await createEsportsPublishJobs({ ...output, gate });
      output.publishResult = publishResult;
      publishJobs.push(...(publishResult.jobs || []));
    }

    outputs.push(output);
  }

  const run = {
    runId: options.runId || `${dryRun ? "dry" : "daily"}-${date}`,
    date,
    dryRun,
    languages,
    activeMode,
    candidates,
    selected,
    outputs,
    publishJobs,
    status: dryRun ? "DRY_RUN_COMPLETE" : publishJobs.length > 0 ? "PUBLISHED" : "READY",
  };

  upsertRun(run);
  return run;
}

async function runSingleSeriesTest(options = {}, deps = {}) {
  const fetchSeriesCandidates = deps.fetchSeriesCandidates || defaultFetchSeriesCandidates;
  const candidates = await fetchSeriesCandidates({ seriesId: options.seriesId, date: options.date, singleSeries: true });
  const target = candidates.find((candidate) => !options.seriesId || candidate.seriesId === options.seriesId) || candidates[0];
  if (!target) throw new Error("No series candidate found for single-series test.");
  return runDailyEsportsPipeline({
    ...options,
    dryRun: true,
    allowRepublish: true,
    runId: `test-${target.seriesId || isoDate(options.date || new Date())}`,
  }, {
    ...deps,
    fetchSeriesCandidates: async () => [target],
  });
}

module.exports = {
  runDailyEsportsPipeline,
  runSingleSeriesTest,
  prepareSeries,
  normalizeLanguages,
};
