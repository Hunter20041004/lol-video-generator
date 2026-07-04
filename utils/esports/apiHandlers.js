const { runDailyEsportsPipeline, runSingleSeriesTest } = require("./dailyPipeline");
const { fetchCompletedSeriesForDate } = require("./seriesFetcher");
const { readCandidateSnapshot } = require("./candidateStore");
const { renderVideosFromRequest } = require("../render/renderService");

function normalizeLanguages(languages = ["zh", "en"]) {
  const values = Array.isArray(languages) && languages.length > 0 ? languages : ["zh", "en"];
  return [...new Set(values.map((language) => String(language || "zh").toLowerCase().startsWith("en") ? "en" : "zh"))];
}

async function renderPlannedVideos({ series, languages = ["zh", "en"] }) {
  const base = String(series.seriesId || "sample-series").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return normalizeLanguages(languages).flatMap((locale) => [
    { type: "radar", locale, videoUrl: `/renders/${base}-radar-${locale}.mp4`, exists: true },
    { type: "recap", locale, videoUrl: `/renders/${base}-recap-${locale}.mp4`, exists: true },
  ]);
}

function buildDeps(body = {}) {
  if (body.useSample) {
    throw new Error("useSample is not supported for esports daily API.");
  }
  if (body.scanId) {
    const snapshot = readCandidateSnapshot(body.scanId);
    return {
      fetchSeriesCandidates: async () => snapshot.candidates || [],
      renderSeriesVideos: body.dryRun !== false ? renderPlannedVideos : renderActualVideos,
    };
  }
  return {
    fetchSeriesCandidates: fetchCompletedSeriesForDate,
    renderSeriesVideos: body.dryRun !== false ? renderPlannedVideos : renderActualVideos,
  };
}

async function renderActualVideos({ contentPlan, languages = ["zh", "en"] }) {
  const payloads = normalizeLanguages(languages).flatMap((locale) => [
    { type: "radar", locale, payload: contentPlan.localized[locale].radar },
    { type: "recap", locale, payload: contentPlan.localized[locale].recap },
  ]);
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

function summarizeSeriesForApi(series = {}) {
  return {
    seriesId: series.seriesId,
    date: series.date,
    league: series.league,
    tournament: series.tournament,
    teams: series.teams,
    teamA: series.teamA || series.teams?.[0],
    teamB: series.teamB || series.teams?.[1],
    winningTeam: series.winningTeam,
    seriesScore: series.seriesScore || series.scoreLabel || series.matchScore,
    score: series.score,
    selectionScore: series.selectionScore,
    importanceScore: series.importanceScore,
    trafficScore: series.trafficScore,
    anomalyScore: series.anomalyScore,
  };
}

function summarizeVideoForApi(video = {}) {
  return {
    type: video.type,
    locale: video.locale,
    videoUrl: video.videoUrl,
    fileName: video.fileName,
    exists: video.exists,
  };
}

function summarizeOutputForApi(output = {}) {
  return {
    seriesId: output.seriesId,
    dryRun: output.dryRun,
    status: output.status,
    series: summarizeSeriesForApi(output.series),
    semanticSummary: {
      matchupEdgeCount: output.semantic?.matchupEdges?.length || 0,
      recapPointCount: output.semantic?.recapPoints?.length || 0,
      contentConfidence: output.semantic?.contentConfidence,
    },
    videos: Array.isArray(output.videos) ? output.videos.map(summarizeVideoForApi) : [],
    gate: output.gate,
    publishReady: output.publishReady,
    publishResult: output.publishResult,
  };
}

function summarizeRunForApi(run = {}) {
  return {
    runId: run.runId,
    date: run.date,
    dryRun: run.dryRun,
    activeMode: run.activeMode,
    candidates: Array.isArray(run.candidates) ? run.candidates.map(summarizeSeriesForApi) : [],
    selected: Array.isArray(run.selected) ? run.selected.map(summarizeSeriesForApi) : [],
    outputs: Array.isArray(run.outputs) ? run.outputs.map(summarizeOutputForApi) : [],
    publishJobs: Array.isArray(run.publishJobs) ? run.publishJobs : [],
    status: run.status,
  };
}

async function handleDailyApiRequest(body = {}) {
  const run = await runDailyEsportsPipeline({
    dryRun: body.dryRun !== false,
    seriesId: body.seriesId,
    scanId: body.scanId,
    languages: normalizeLanguages(body.languages),
    date: body.date,
    activeMode: body.activeMode || "regular",
    allowRepublish: Boolean(body.allowRepublish),
    config: body.config || {},
  }, buildDeps(body));

  return {
    success: true,
    run: summarizeRunForApi(run),
  };
}

async function handleSingleSeriesApiRequest(body = {}) {
  if (body.useSample) {
    throw new Error("useSample is not supported for esports single-series API.");
  }
  const run = await runSingleSeriesTest({
    seriesId: body.seriesId,
    date: body.date,
    activeMode: body.activeMode || "regular",
    config: body.config || {},
  }, buildDeps({ ...body, useSample: body.useSample !== false }));

  return {
    success: true,
    run: summarizeRunForApi(run),
  };
}

module.exports = {
  handleDailyApiRequest,
  handleSingleSeriesApiRequest,
  renderPlannedVideos,
  renderActualVideos,
  summarizeRunForApi,
};
