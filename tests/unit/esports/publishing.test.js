const test = require("node:test");
const assert = require("node:assert/strict");

function makeSeriesRun(overrides = {}) {
  return {
    seriesId: "lck-t1-gen-2026-06-20",
    dryRun: false,
    gate: { passed: true, reasons: [] },
    semantic: {
      match: { league: "LCK", teams: ["T1", "GEN"], score: "2-0" },
    },
    videos: [
      { type: "radar", locale: "zh", videoUrl: "/renders/radar-zh.mp4" },
      { type: "radar", locale: "en", videoUrl: "/renders/radar-en.mp4" },
      { type: "recap", locale: "zh", videoUrl: "/renders/recap-zh.mp4" },
      { type: "recap", locale: "en", videoUrl: "/renders/recap-en.mp4" },
    ],
    ...overrides,
  };
}

test("createEsportsPublishJobs queues only Instagram and Threads jobs for localized esports videos", async () => {
  const { createEsportsPublishJobs } = require("../../../utils/esports/publishing");
  const calls = [];

  const result = await createEsportsPublishJobs(makeSeriesRun(), {
    createPublishJobs: async (request) => {
      calls.push(request);
      return {
        success: true,
        jobs: request.videos.flatMap((video) => request.platforms.map((platform) => ({
          platform,
          locale: video.locale,
          videoUrl: video.videoUrl,
        }))),
      };
    },
  });

  assert.deepEqual(calls[0].platforms, ["instagram", "threads"]);
  assert.deepEqual([...new Set(result.jobs.map((job) => job.platform))].sort(), ["instagram", "threads"]);
  assert.deepEqual([...new Set(result.jobs.map((job) => job.locale))].sort(), ["en", "zh"]);
  assert.equal(result.jobs.length, 8);
});

test("createEsportsPublishJobs skips dry runs, failed gates, and empty video sets", async () => {
  const { createEsportsPublishJobs } = require("../../../utils/esports/publishing");

  const dryRun = await createEsportsPublishJobs(makeSeriesRun({ dryRun: true }));
  const gateFailed = await createEsportsPublishJobs(makeSeriesRun({ gate: { passed: false, reasons: ["missing players"] } }));
  const noVideos = await createEsportsPublishJobs(makeSeriesRun({ videos: [] }));

  assert.equal(dryRun.reason, "dry_run");
  assert.equal(gateFailed.reason, "gate_failed");
  assert.equal(noVideos.reason, "no_videos");
  assert.deepEqual(dryRun.jobs, []);
});
