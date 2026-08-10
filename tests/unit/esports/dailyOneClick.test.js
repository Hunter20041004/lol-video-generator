const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSampleAggregatedSeries } = require("../../../utils/esports/sampleData");

test("runDailyOneClick publishes yesterday zh recap videos directly to Instagram and Threads", async () => {
  const { runDailyOneClick } = require("../../../utils/esports/dailyOneClick");
  const calls = {
    render: [],
    publicMedia: [],
    publish: [],
    savedRuns: [],
  };

  const result = await runDailyOneClick({
    now: new Date("2026-07-05T18:00:00-07:00"),
    activeMode: "msi",
    maxSeries: 1,
  }, {
    fetchSeriesCandidates: async ({ date, activeMode }) => {
      assert.equal(date, "2026-07-04");
      assert.equal(activeMode.mode, "msi");
      return [makeSampleAggregatedSeries({
        seriesId: "msi-hle-g2-2026-07-04",
        date,
        league: "MSI",
        tournament: "Mid-Season Invitational 2026",
        teamA: "HLE",
        teamB: "G2",
        teams: ["HLE", "G2"],
        winningTeam: "HLE",
        seriesScore: "3-0",
        scoreLabel: "3-0",
      })];
    },
    renderSeriesVideos: async ({ languages, videoTypes }) => {
      calls.render.push({ languages, videoTypes });
      return [
        { type: "recap", locale: "zh", videoUrl: "/renders/hle-g2-recap-zh.mp4", exists: true },
      ];
    },
    ensurePublicMediaBaseUrl: async (request) => {
      calls.publicMedia.push(request);
      return { status: "READY", baseUrl: "https://example.test", sampleUrl: "https://example.test/renders/hle-g2-recap-zh.mp4" };
    },
    createPublishJobs: async (request) => {
      calls.publish.push(request);
      return {
        success: true,
        action: request.action,
        platforms: request.platforms,
        jobs: request.videos.flatMap((video) => request.platforms.map((platform) => ({
          id: `${video.locale}-${platform}`,
          status: "PUBLISHED",
          platform,
          locale: video.locale,
          videoUrl: video.videoUrl,
          result: { url: `https://${platform}.example/post` },
        }))),
      };
    },
    hasPublishedSeries: () => false,
    upsertRun: (run) => {
      calls.savedRuns.push(run);
      return run;
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.run.date, "2026-07-04");
  assert.deepEqual(calls.render[0], { languages: ["zh"], videoTypes: ["recap"] });
  assert.equal(calls.publicMedia.length, 1);
  assert.equal(calls.publicMedia[0].action, "publish");
  assert.deepEqual(calls.publicMedia[0].platforms, ["instagram", "threads"]);
  assert.equal(calls.publicMedia[0].sampleVideoUrl, "/renders/hle-g2-recap-zh.mp4");
  assert.equal(calls.publish.length, 1);
  assert.equal(calls.publish[0].action, "publish");
  assert.deepEqual(calls.publish[0].platforms, ["instagram", "threads"]);
  assert.deepEqual(calls.publish[0].videos.map((video) => `${video.type}:${video.locale}`), ["recap:zh"]);
  assert.equal(result.run.outputs[0].videos.length, 1);
  assert.equal(result.run.publishJobs.length, 2);
  assert.equal(result.run.status, "PUBLISHED");
  assert.equal(calls.savedRuns[0].status, "PUBLISHED");
});
