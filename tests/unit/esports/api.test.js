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

test("handleDailyApiRequest honors requested recap-only video types", async () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const ROOT = path.resolve(__dirname, "../../..");
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-recap-only-"));
  process.chdir(dir);
  [
    "utils/esports/apiHandlers.js",
    "utils/esports/candidateStore.js",
  ].forEach((file) => delete require.cache[path.join(ROOT, file)]);

  try {
    const { makeSampleAggregatedSeries } = require(path.join(ROOT, "utils/esports/sampleData.js"));
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot({
      scanId: "recap-only-scan",
      createdAt: new Date().toISOString(),
      candidates: [makeSampleAggregatedSeries({
        seriesId: "MSI 2026::2026-07-06::T1::FURIA",
        date: "2026-07-06",
        tournament: "MSI 2026",
        teamA: "T1",
        teamB: "FURIA",
        teams: ["T1", "FURIA"],
        winningTeam: "T1",
        seriesScore: "3-0",
        scoreLabel: "3-0",
      })],
    });

    const { handleDailyApiRequest } = require(path.join(ROOT, "utils/esports/apiHandlers.js"));
    const result = await handleDailyApiRequest({
      scanId: "recap-only-scan",
      seriesId: "MSI 2026::2026-07-06::T1::FURIA",
      dryRun: true,
      date: "2026-07-06",
      activeMode: "msi",
      languages: ["zh"],
      videoTypes: ["recap"],
      allowRepublish: true,
    });

    assert.deepEqual(
      result.run.outputs[0].videos.map((video) => `${video.type}:${video.locale}`),
      ["recap:zh"]
    );
  } finally {
    process.chdir(originalCwd);
    [
      "utils/esports/apiHandlers.js",
      "utils/esports/candidateStore.js",
    ].forEach((file) => delete require.cache[path.join(ROOT, file)]);
    fs.rmSync(dir, { recursive: true, force: true });
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

test("handleDailyOneClickApiRequest returns compact publish links and public media status", async () => {
  const { handleDailyOneClickApiRequest } = require("../../../utils/esports/apiHandlers");

  const result = await handleDailyOneClickApiRequest({
    date: "2026-07-04",
    activeMode: "msi",
    maxSeries: 2,
  }, {
    runDailyOneClick: async (body) => {
      assert.equal(body.date, "2026-07-04");
      assert.equal(body.activeMode, "msi");
      assert.equal(body.maxSeries, 2);
      return {
        success: true,
        publicMedia: [{ status: "READY", sampleUrl: "https://example.test/renders/recap.mp4" }],
        run: {
          runId: "one-click-2026-07-04",
          date: "2026-07-04",
          dryRun: false,
          languages: ["zh"],
          videoTypes: ["recap"],
          candidates: [],
          selected: [],
          outputs: [{
            seriesId: "series-1",
            dryRun: false,
            status: "RENDERED",
            series: { teams: ["HLE", "G2"], scoreLabel: "3-0" },
            semantic: { matchupEdges: [], recapPoints: [{}, {}, {}], contentConfidence: "high" },
            videos: [{ type: "recap", locale: "zh", videoUrl: "/renders/recap.mp4" }],
            gate: { passed: true, reasons: [] },
            publishReady: true,
            publishResult: {
              jobs: [
                { id: "ig-1", platform: "instagram", status: "PUBLISHED", result: { url: "https://instagram.example/reel" } },
                { id: "th-1", platform: "threads", status: "PUBLISHED", result: { url: "https://threads.example/post" } },
              ],
            },
          }],
          publishJobs: [
            { id: "ig-1", platform: "instagram", status: "PUBLISHED", result: { url: "https://instagram.example/reel" } },
            { id: "th-1", platform: "threads", status: "PUBLISHED", result: { url: "https://threads.example/post" } },
          ],
          status: "PUBLISHED",
        },
      };
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.publicMedia[0].status, "READY");
  assert.equal(result.run.date, "2026-07-04");
  assert.equal(result.run.outputs[0].videos.length, 1);
  assert.deepEqual(result.publishLinks, [
    { platform: "instagram", url: "https://instagram.example/reel", status: "PUBLISHED" },
    { platform: "threads", url: "https://threads.example/post", status: "PUBLISHED" },
  ]);
});
