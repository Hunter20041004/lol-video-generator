const test = require("node:test");
const assert = require("node:assert/strict");

test("handleDailyApiRequest rejects runtime sample mode", async () => {
  const { handleDailyApiRequest } = require("../../../utils/esports/apiHandlers");

  await assert.rejects(
    () => handleDailyApiRequest({
      dryRun: true,
      useSample: true,
      date: "2026-06-20",
      activeMode: "regular",
    }),
    /useSample is not supported/
  );
});

test("handleSingleSeriesApiRequest rejects sample mode", async () => {
  const { handleSingleSeriesApiRequest, renderPlannedVideos } = require("../../../utils/esports/apiHandlers");

  await assert.rejects(
    () => handleSingleSeriesApiRequest({
      date: "2026-06-20",
      activeMode: "regular",
      useSample: true,
    }),
    /useSample is not supported/
  );
  const videos = await renderPlannedVideos({ series: { seriesId: "T1 vs GEN!" }, languages: ["zh"] });

  assert.equal(videos[0].videoUrl, "/renders/t1-vs-gen--radar-zh.mp4");
  assert.equal(videos.length, 2);
});

test("handleDailyApiRequest returns an empty compact UI payload when production data has no candidates", async () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const ROOT = path.resolve(__dirname, "../../..");
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-empty-scan-"));
  process.chdir(dir);
  delete require.cache[path.join(ROOT, "utils/esports/apiHandlers.js")];
  delete require.cache[path.join(ROOT, "utils/esports/candidateStore.js")];
  try {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot({
      scanId: "empty-scan",
      createdAt: new Date().toISOString(),
      candidates: [],
    });
    const { handleDailyApiRequest } = require(path.join(ROOT, "utils/esports/apiHandlers.js"));

    const result = await handleDailyApiRequest({
      scanId: "empty-scan",
      dryRun: true,
      date: "2026-06-20",
      activeMode: "regular",
    });

    assert.equal(result.success, true);
    assert.equal(result.run.candidates.length, 0);
    assert.equal(result.run.selected.length, 0);
    assert.equal(result.run.outputs.length, 0);
    assert.equal(result.run.publishJobs.length, 0);
  } finally {
    process.chdir(originalCwd);
    delete require.cache[path.join(ROOT, "utils/esports/apiHandlers.js")];
    delete require.cache[path.join(ROOT, "utils/esports/candidateStore.js")];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("renderActualVideos converts render service results into four typed video outputs", async () => {
  const path = require("path");
  const ROOT = path.resolve(__dirname, "../../..");
  const apiPath = path.join(ROOT, "utils/esports/apiHandlers.js");
  const renderPath = path.join(ROOT, "utils/render/renderService.js");
  delete require.cache[apiPath];
  const originalRenderModule = require.cache[renderPath];
  require.cache[renderPath] = {
    id: renderPath,
    filename: renderPath,
    loaded: true,
    exports: {
      renderVideosFromRequest: async (payload) => payload.locale === "zh"
        ? { videos: [{ locale: payload.locale, videoUrl: `/renders/${payload.dataType}-${payload.locale}.mp4`, fileName: "from-videos.mp4" }] }
        : { videoUrl: `/renders/${payload.dataType}-${payload.locale}.mp4`, fileName: "from-single.mp4" },
    },
  };

  try {
    const { renderActualVideos } = require(apiPath);
    const videos = await renderActualVideos({
      contentPlan: {
        localized: {
          zh: {
            radar: { dataType: "ESPORTS_H2H_RADAR" },
            recap: { dataType: "ESPORTS_MATCH_RECAP" },
          },
          en: {
            radar: { dataType: "ESPORTS_H2H_RADAR" },
            recap: { dataType: "ESPORTS_MATCH_RECAP" },
          },
        },
      },
    });

    assert.deepEqual(videos.map((video) => `${video.type}:${video.locale}`), ["radar:zh", "recap:zh", "radar:en", "recap:en"]);
    assert.equal(videos[0].fileName, "from-videos.mp4");
    assert.equal(videos[2].fileName, "from-single.mp4");
  } finally {
    delete require.cache[apiPath];
    if (originalRenderModule) require.cache[renderPath] = originalRenderModule;
    else delete require.cache[renderPath];
  }
});

test("handleDailyApiRequest can use the production dependency path with compact output", async () => {
  const path = require("path");
  const ROOT = path.resolve(__dirname, "../../..");
  const apiPath = path.join(ROOT, "utils/esports/apiHandlers.js");
  const fetcherPath = path.join(ROOT, "utils/esports/seriesFetcher.js");
  const samplePath = path.join(ROOT, "utils/esports/sampleData.js");
  const renderPath = path.join(ROOT, "utils/render/renderService.js");
  delete require.cache[apiPath];
  const originalFetcherModule = require.cache[fetcherPath];
  const originalRenderModule = require.cache[renderPath];
  const { makeSampleAggregatedSeries } = require(samplePath);

  require.cache[fetcherPath] = {
    id: fetcherPath,
    filename: fetcherPath,
    loaded: true,
    exports: {
      fetchCompletedSeriesForDate: async () => [makeSampleAggregatedSeries({
        seriesId: "prod-path-series",
        seriesScore: "3-2",
        scoreLabel: "3-2",
      })],
    },
  };
  require.cache[renderPath] = {
    id: renderPath,
    filename: renderPath,
    loaded: true,
    exports: {
      renderVideosFromRequest: async (payload) => ({
        videoUrl: `/renders/${payload.dataType}-${payload.locale}.mp4`,
        fileName: `${payload.dataType}-${payload.locale}.mp4`,
        exists: true,
      }),
    },
  };

  try {
    const { handleDailyApiRequest } = require(apiPath);
    const result = await handleDailyApiRequest({
      dryRun: true,
      useSample: false,
      date: "2026-06-20",
      activeMode: "regular",
      config: { regularTournaments: ["LCK"] },
    });

    assert.equal(result.success, true);
    assert.equal(result.run.selected[0].seriesId, "prod-path-series");
    assert.equal(result.run.selected[0].seriesScore, "3-2");
    assert.equal(result.run.outputs[0].semanticSummary.matchupEdgeCount, 5);
    assert.equal(result.run.outputs[0].videos.length, 4);
  } finally {
    delete require.cache[apiPath];
    if (originalFetcherModule) require.cache[fetcherPath] = originalFetcherModule;
    else delete require.cache[fetcherPath];
    if (originalRenderModule) require.cache[renderPath] = originalRenderModule;
    else delete require.cache[renderPath];
  }
});

test("summarizeRunForApi handles missing arrays and series fallback fields", () => {
  const { summarizeRunForApi } = require("../../../utils/esports/apiHandlers");

  const result = summarizeRunForApi({
    runId: "run-1",
    outputs: [{
      seriesId: "series-1",
      series: { teams: ["A", "B"], scoreLabel: "2-1" },
      videos: null,
      semantic: null,
    }],
    selected: [{ teams: ["A", "B"], matchScore: "1-0" }],
    publishJobs: null,
  });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.selected[0].teamA, "A");
  assert.equal(result.selected[0].seriesScore, "1-0");
  assert.equal(result.outputs[0].series.teamB, "B");
  assert.equal(result.outputs[0].videos.length, 0);
  assert.equal(result.outputs[0].semanticSummary.matchupEdgeCount, 0);
  assert.equal(result.publishJobs.length, 0);
});
