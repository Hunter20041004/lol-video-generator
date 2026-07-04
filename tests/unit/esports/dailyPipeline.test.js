const test = require("node:test");
const assert = require("node:assert/strict");

const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

function makePlayer(team, role, score) {
  return {
    team,
    role,
    name: `${team} ${role}`,
    champions: [`${role} Champ`],
    rawStats: {
      role,
      kills: score > 50 ? 5 : 2,
      deaths: 2,
      assists: 8,
      kda: score > 50 ? 6.5 : 3,
      dpm: score > 50 ? 620 : 420,
      gpm: score > 50 ? 440 : 350,
      csm: role === "Support" ? 0.7 : 8.2,
      vpm: role === "Support" ? 2.2 : 1,
      kp: score > 50 ? 0.72 : 0.51,
    },
    radarStats: [
      { label: "KDA", rawValue: "6.5", normalizedScore: score },
      { label: "DPM", rawValue: "620", normalizedScore: score },
      { label: "KP%", rawValue: "72%", normalizedScore: score },
      { label: "GPM", rawValue: "440", normalizedScore: score },
      { label: role === "Support" ? "VPM" : "CSM", rawValue: "8.2", normalizedScore: score },
    ],
  };
}

function makeAggregatedSeries() {
  const roleMatchups = ROLES.map((role) => ({
    role,
    left: makePlayer("T1", role, 82),
    right: makePlayer("GEN", role, 48),
  }));
  return {
    seriesId: "lck-t1-gen-2026-06-20",
    date: "2026-06-20",
    league: "LCK",
    tournament: "LCK 2026 Summer",
    teams: ["T1", "GEN"],
    teamA: "T1",
    teamB: "GEN",
    winningTeam: "T1",
    score: 88,
    scoreLabel: "2-0",
    games: 2,
    players: roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]),
    roleMatchups,
    teamStats: {
      T1: { kills: 30, damageToChampions: 90000, gold: 114000, visionScore: 240 },
      GEN: { kills: 18, damageToChampions: 68000, gold: 99000, visionScore: 205 },
    },
    completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true, missingRoles: [] },
  };
}

function makeFakeDeps() {
  return {
    fetchSeriesCandidates: async () => [makeAggregatedSeries()],
    hasPublishedSeries: () => false,
    renderSeriesVideos: async () => [
      { type: "radar", locale: "zh", videoUrl: "/renders/radar-zh.mp4", exists: true },
      { type: "radar", locale: "en", videoUrl: "/renders/radar-en.mp4", exists: true },
      { type: "recap", locale: "zh", videoUrl: "/renders/recap-zh.mp4", exists: true },
      { type: "recap", locale: "en", videoUrl: "/renders/recap-en.mp4", exists: true },
    ],
    createEsportsPublishJobs: async () => {
      throw new Error("dry run must not publish");
    },
    upsertRun: (run) => run,
  };
}

test("runDailyEsportsPipeline dry run renders four test videos per selected series without queueing official publish jobs", async () => {
  const { runDailyEsportsPipeline } = require("../../../utils/esports/dailyPipeline");

  const result = await runDailyEsportsPipeline({ dryRun: true, date: "2026-06-20", activeMode: "regular" }, makeFakeDeps());

  assert.equal(result.selected.length, 1);
  assert.equal(result.outputs[0].videos.length, 4);
  assert.equal(result.outputs[0].gate.passed, true);
  assert.equal(result.publishJobs.length, 0);
});

test("runDailyEsportsPipeline queues publish jobs when not dry run and skips already published series", async () => {
  const { runDailyEsportsPipeline } = require("../../../utils/esports/dailyPipeline");
  const published = makeAggregatedSeries();
  const fresh = { ...makeAggregatedSeries(), seriesId: "lpl-blg-tes-2026-06-20", league: "LPL", teamA: "BLG", teamB: "TES", teams: ["BLG", "TES"] };
  const savedRuns = [];

  const result = await runDailyEsportsPipeline({ dryRun: false, date: "2026-06-20", activeMode: "regular" }, {
    fetchSeriesCandidates: async () => [published, fresh],
    hasPublishedSeries: (seriesId) => seriesId === published.seriesId,
    renderSeriesVideos: makeFakeDeps().renderSeriesVideos,
    createEsportsPublishJobs: async () => ({
      success: true,
      jobs: [{ id: "pub-ig", platform: "instagram", locale: "zh" }],
    }),
    upsertRun: (run) => {
      savedRuns.push(run);
      return run;
    },
  });

  assert.deepEqual(result.selected.map((series) => series.seriesId), [fresh.seriesId]);
  assert.equal(result.publishJobs.length, 1);
  assert.equal(result.status, "PUBLISHED");
  assert.equal(savedRuns[0].status, "PUBLISHED");
});

test("runSingleSeriesTest selects a requested candidate and rejects an empty fetch result", async () => {
  const { runSingleSeriesTest } = require("../../../utils/esports/dailyPipeline");
  const target = { ...makeAggregatedSeries(), seriesId: "target-series" };
  const other = { ...makeAggregatedSeries(), seriesId: "other-series" };

  const result = await runSingleSeriesTest({ seriesId: "target-series", date: "2026-06-20" }, {
    fetchSeriesCandidates: async () => [other, target],
    hasPublishedSeries: () => true,
    renderSeriesVideos: makeFakeDeps().renderSeriesVideos,
    upsertRun: (run) => run,
  });

  assert.equal(result.runId, "test-target-series");
  assert.equal(result.selected[0].seriesId, "target-series");
  await assert.rejects(
    () => runSingleSeriesTest({ seriesId: "missing" }, { fetchSeriesCandidates: async () => [] }),
    /No series candidate/
  );
});

test("runDailyEsportsPipeline uses default renderer and rejects missing fetch dependency", async () => {
  const { runDailyEsportsPipeline } = require("../../../utils/esports/dailyPipeline");
  const series = { ...makeAggregatedSeries(), seriesId: "Series With Spaces!" };

  await assert.rejects(
    () => runDailyEsportsPipeline({ dryRun: true, date: "2026-06-20" }, { upsertRun: (run) => run }),
    /fetchSeriesCandidates dependency/
  );

  const result = await runDailyEsportsPipeline({ dryRun: true, date: new Date("2026-06-20T03:00:00.000Z"), activeMode: "regular" }, {
    fetchSeriesCandidates: async () => [series],
    hasPublishedSeries: () => false,
    upsertRun: (run) => run,
  });

  assert.equal(result.outputs[0].videos[0].videoUrl, "/renders/series-with-spaces--radar-zh.mp4");
  assert.equal(result.status, "DRY_RUN_COMPLETE");
});
