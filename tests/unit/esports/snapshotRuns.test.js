const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  [
    "utils/esports/apiHandlers.js",
    "utils/esports/candidateStore.js",
    "utils/esports/dailyPipeline.js",
    "utils/esports/gatekeeper.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-esports-snapshot-run-"));
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
  const roles = ["Top", "Jungle", "Mid", "Adc", "Support"];
  const players = roles.flatMap((role, index) => [
    {
      name: `T1 ${role}`,
      team: "T1",
      role,
      champions: ["Azir"],
      rawStats: { role, kda: 8 - index, dpm: 620 - index, kp: 0.75, gpm: 450, csm: 8.8, vpm: 2.1 },
      radarStats: [
        { label: "KDA", normalizedScore: 86 - index },
        { label: "DPM", normalizedScore: 84 - index },
        { label: "KP%", normalizedScore: 85 - index },
        { label: "GPM", normalizedScore: 82 - index },
        { label: role === "Support" ? "VPM" : "CSM", normalizedScore: 83 - index },
      ],
    },
    {
      name: `GEN ${role}`,
      team: "GEN",
      role,
      champions: ["Orianna"],
      rawStats: { role, kda: 3 + index, dpm: 440 + index, kp: 0.52, gpm: 380, csm: 7.4, vpm: 1.5 },
      radarStats: [
        { label: "KDA", normalizedScore: 50 + index },
        { label: "DPM", normalizedScore: 49 + index },
        { label: "KP%", normalizedScore: 51 + index },
        { label: "GPM", normalizedScore: 48 + index },
        { label: role === "Support" ? "VPM" : "CSM", normalizedScore: 47 + index },
      ],
    },
  ]);
  const roleMatchups = roles.map((role) => ({
    role,
    left: players.find((player) => player.team === "T1" && player.role === role),
    right: players.find((player) => player.team === "GEN" && player.role === role),
  }));

  return {
    scanId: "scan-test",
    createdAt: new Date().toISOString(),
    candidates: [{
      seriesId: "series-1",
      date: "2026-06-20",
      league: "LCK",
      tournament: "LCK Summer",
      teams: ["T1", "GEN"],
      teamA: "T1",
      teamB: "GEN",
      winningTeam: "T1",
      seriesScore: "2-0",
      score: "2-0",
      games: 2,
      players,
      roleMatchups,
      teamStats: {
        T1: { damageToChampions: 180000, gold: 130000 },
        GEN: { damageToChampions: 121000, gold: 109000 },
      },
      completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true, missingRoles: [] },
      recommendedMvp: { name: "T1 Top", team: "T1", role: "Top", score: 84 },
    }],
  };
}

test("handleDailyApiRequest runs Gate first from scan snapshot for selected languages only", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    writeCandidateSnapshot(makeSnapshot());
    const { handleDailyApiRequest } = require(path.join(ROOT, "utils/esports/apiHandlers.js"));

    const result = await handleDailyApiRequest({
      scanId: "scan-test",
      seriesId: "series-1",
      dryRun: true,
      languages: ["zh"],
    });

    assert.equal(result.success, true);
    assert.equal(result.run.selected.length, 1);
    assert.equal(result.run.outputs[0].gate.passed, true);
    assert.deepEqual(result.run.outputs[0].videos.map((video) => `${video.type}:${video.locale}`), ["radar:zh", "recap:zh"]);
    assert.equal(result.run.publishJobs.length, 0);
  });
});

test("handleDailyApiRequest rejects useSample and missing scan snapshots", async () => {
  await withTempProject(async () => {
    const { handleDailyApiRequest } = require(path.join(ROOT, "utils/esports/apiHandlers.js"));

    await assert.rejects(
      () => handleDailyApiRequest({ useSample: true, dryRun: true }),
      /useSample is not supported/
    );
    await assert.rejects(
      () => handleDailyApiRequest({ scanId: "missing", seriesId: "series-1", dryRun: true }),
      /Candidate scan not found/
    );
  });
});
