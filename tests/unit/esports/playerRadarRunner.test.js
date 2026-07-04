const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  [
    "utils/esports/playerRadarRunner.js",
    "utils/esports/candidateStore.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-"));
  process.chdir(dir);
  clearModules();
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function makeSnapshot() {
  const players = [
    {
      name: "T1 Mid",
      team: "T1",
      role: "Mid",
      champions: ["Azir"],
      rawStats: { kda: 9, dpm: 700, kp: 0.82, gpm: 470, csm: 9.1 },
      radarStats: [
        { label: "KDA", rawValue: "9", normalizedScore: 92 },
        { label: "DPM", rawValue: "700", normalizedScore: 90 },
        { label: "KP%", rawValue: "82%", normalizedScore: 94 },
        { label: "GPM", rawValue: "470", normalizedScore: 88 },
        { label: "CSM", rawValue: "9.1", normalizedScore: 86 },
      ],
    },
    {
      name: "GEN Support",
      team: "GEN",
      role: "Support",
      champions: ["Rell"],
      rawStats: { kda: 4, dpm: 220, kp: 0.55, gpm: 270, vpm: 2.4 },
      radarStats: [
        { label: "KDA", rawValue: "4", normalizedScore: 56 },
        { label: "DPM", rawValue: "220", normalizedScore: 44 },
        { label: "KP%", rawValue: "55%", normalizedScore: 50 },
        { label: "GPM", rawValue: "270", normalizedScore: 46 },
        { label: "VPM", rawValue: "2.4", normalizedScore: 72 },
      ],
    },
  ];
  return {
    scanId: "scan-radar",
    createdAt: new Date().toISOString(),
    candidates: [{
      seriesId: "series-1",
      league: "LCK",
      teamA: "T1",
      teamB: "GEN",
      seriesScore: "2-0",
      players,
      recommendedMvp: { name: "T1 Mid", team: "T1", role: "Mid", score: 90 },
    }],
  };
}

test("runPlayerRadarFromSnapshot auto-selects MVP and queues IG/Threads jobs", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot(makeSnapshot());
    const { runPlayerRadarFromSnapshot } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const renderedPayloads = [];
    const queued = [];

    const result = await runPlayerRadarFromSnapshot({
      scanId: "scan-radar",
      seriesId: "series-1",
      languages: ["zh", "en"],
    }, {
      renderVideosFromRequest: async (payload) => {
        renderedPayloads.push(payload);
        return { videoUrl: `/renders/${payload.player.name}-${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` };
      },
      createPublishJobs: async (payload) => {
        queued.push(payload);
        return { success: true, jobs: payload.videos.flatMap((video) => ["instagram", "threads"].map((platform) => ({ platform, locale: video.locale }))) };
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.player.name, "T1 Mid");
    assert.deepEqual(renderedPayloads.map((payload) => payload.locale), ["zh", "en"]);
    assert.equal(renderedPayloads[0].dataType, "PLAYER_RADAR");
    assert.deepEqual(queued[0].platforms, ["instagram", "threads"]);
    assert.equal(result.publish.jobs.length, 4);
  });
});

test("runPlayerRadarFromSnapshot can render a manually selected player without rescanning", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot(makeSnapshot());
    const { runPlayerRadarFromSnapshot } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));

    const result = await runPlayerRadarFromSnapshot({
      scanId: "scan-radar",
      seriesId: "series-1",
      playerName: "GEN Support",
      languages: ["zh"],
    }, {
      renderVideosFromRequest: async (payload) => ({ videoUrl: `/renders/${payload.player.name}-${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }),
      createPublishJobs: async (payload) => ({ success: true, jobs: payload.videos.map((video) => ({ platform: "instagram", locale: video.locale })) }),
    });

    assert.equal(result.player.name, "GEN Support");
    assert.deepEqual(result.videos.map((video) => video.locale), ["zh"]);
  });
});

test("runPlayerRadarFromSnapshot reports missing series or player clearly", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot(makeSnapshot());
    const { runPlayerRadarFromSnapshot } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));

    await assert.rejects(
      () => runPlayerRadarFromSnapshot({ scanId: "scan-radar", seriesId: "missing" }),
      /Series not found/
    );
    await assert.rejects(
      () => runPlayerRadarFromSnapshot({ scanId: "scan-radar", seriesId: "series-1", playerName: "Unknown" }),
      /Player not found/
    );
  });
});

test("player radar falls back to radar score, videos array render results, and team array payloads", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const snapshot = makeSnapshot();
    delete snapshot.candidates[0].recommendedMvp;
    delete snapshot.candidates[0].teamA;
    delete snapshot.candidates[0].teamB;
    snapshot.candidates[0].teams = ["T1", "GEN"];
    writeCandidateSnapshot(snapshot);

    const {
      buildPlayerRadarPayload,
      runPlayerRadarFromSnapshot,
      selectPlayer,
      normalizeLanguages,
    } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));

    assert.deepEqual(normalizeLanguages(["EN", "zh", "", "en-US"]), ["en", "zh"]);
    assert.throws(() => selectPlayer({ players: [] }), /Player not found in snapshot: MVP/);

    const englishPayload = buildPlayerRadarPayload(snapshot.candidates[0], snapshot.candidates[0].players[0], "en");
    assert.equal(englishPayload.matchContext.teamA, "T1");
    assert.equal(englishPayload.matchContext.teamB, "GEN");
    assert.match(englishPayload.verdict, /is the data lead/);

    const result = await runPlayerRadarFromSnapshot({
      scanId: "scan-radar",
      seriesId: "series-1",
      languages: ["en"],
    }, {
      renderVideosFromRequest: async () => ({
        videos: [{ locale: "en", videoUrl: "/renders/radar-en.mp4", fileName: "radar-en.mp4" }],
      }),
      createPublishJobs: async (payload) => ({ success: true, jobs: payload.videos.map((video) => ({ platform: "threads", locale: video.locale })) }),
    });

    assert.equal(result.player.name, "T1 Mid");
    assert.deepEqual(result.videos, [{
      locale: "en",
      videoUrl: "/renders/radar-en.mp4",
      fileName: "radar-en.mp4",
      type: "player-radar",
    }]);
  });
});

test("player radar payloads handle empty stats and stale MVP names", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const snapshot = makeSnapshot();
    snapshot.candidates[0].recommendedMvp = { name: "Stale MVP" };
    snapshot.candidates[0].players.push({
      name: "No Stats",
      team: "T1",
      role: "Top",
      champion: "Gnar",
      radarStats: [],
    });
    writeCandidateSnapshot(snapshot);

    const {
      buildPlayerRadarPayload,
      normalizeLanguages,
      runPlayerRadarFromSnapshot,
    } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));

    assert.deepEqual(normalizeLanguages([]), ["zh", "en"]);
    assert.deepEqual(normalizeLanguages("en"), ["zh", "en"]);

    const sparsePayload = buildPlayerRadarPayload({}, snapshot.candidates[0].players.at(-1), "zh");
    assert.equal(sparsePayload.matchContext.teamA, "");
    assert.equal(sparsePayload.matchContext.seriesScore, "");
    assert.equal(sparsePayload.player.championPlayed, "Gnar");
    assert.equal(sparsePayload.highlight, "");
    assert.equal(sparsePayload.weakness, "");
    assert.match(sparsePayload.storyboard[1].text, /雷達/);

    const result = await runPlayerRadarFromSnapshot({
      scanId: "scan-radar",
      seriesId: "series-1",
      languages: ["zh"],
    }, {
      renderVideosFromRequest: async (payload) => ({ videoUrl: `/renders/${payload.locale}.mp4`, fileName: `${payload.locale}.mp4` }),
      createPublishJobs: async () => ({ success: true, jobs: [] }),
    });

    assert.equal(result.player.name, "T1 Mid");
  });
});
