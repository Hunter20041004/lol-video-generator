const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");

function clearCandidateModules() {
  [
    "utils/esports/candidateStore.js",
    "utils/esports/candidateScanner.js",
  ].forEach((file) => {
    delete require.cache[path.join(ROOT, file)];
  });
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-esports-candidates-"));
  process.chdir(dir);
  clearCandidateModules();
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    clearCandidateModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function player(name, team, role, score) {
  return {
    name,
    team,
    role,
    champions: ["Azir"],
    rawStats: { kda: score / 10, dpm: score * 8, kp: 0.72, gpm: 430, csm: 8.4, role },
    radarStats: [
      { label: "KDA", normalizedScore: score },
      { label: "DPM", normalizedScore: score - 3 },
      { label: "KP%", normalizedScore: score - 1 },
      { label: "GPM", normalizedScore: score - 4 },
      { label: role === "Support" ? "VPM" : "CSM", normalizedScore: score - 2 },
    ],
  };
}

function aggregatedSeries() {
  const roles = ["Top", "Jungle", "Mid", "Adc", "Support"];
  const roleMatchups = roles.map((role, index) => ({
    role,
    left: player(`T1 ${role}`, "T1", role, 86 - index),
    right: player(`GEN ${role}`, "GEN", role, 54 + index),
  }));
  return {
    seriesId: "lck-2026-06-20-t1-gen",
    date: "2026-06-20",
    league: "LCK",
    tournament: "LCK Summer",
    teams: ["T1", "GEN"],
    teamA: "T1",
    teamB: "GEN",
    winningTeam: "T1",
    seriesScore: "2-0",
    players: roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]),
    roleMatchups,
    completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true, missingRoles: [] },
  };
}

test("scanEsportsCandidates stores a scanId snapshot with candidates and recommended MVP", async () => {
  await withTempProject(async () => {
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const { readCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));

    const result = await scanEsportsCandidates({
      date: "2026-06-20",
      activeMode: "daily",
      languages: ["zh", "en"],
      tournamentScope: "LCK",
    }, {
      fetchSeriesCandidates: async () => [aggregatedSeries()],
      now: () => new Date("2026-06-20T08:00:00.000Z"),
    });

    assert.match(result.scanId, /^scan-2026-06-20-/);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].seriesId, "lck-2026-06-20-t1-gen");
    assert.equal(result.candidates[0].completeness.hasTenPlayers, true);
    assert.equal(result.candidates[0].recommendedMvp.name, "T1 Top");
    assert.equal(result.sourceStatus.status, "ready");

    const stored = readCandidateSnapshot(result.scanId, {
      now: () => new Date("2026-06-20T08:10:00.000Z"),
    });
    assert.equal(stored.scanId, result.scanId);
    assert.equal(stored.candidates[0].recommendedMvp.name, "T1 Top");
  });
});

test("candidate snapshots return clear errors for missing or expired scanIds", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot, readCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));

    assert.throws(() => readCandidateSnapshot("missing-scan"), /Candidate scan not found/);

    writeCandidateSnapshot({
      scanId: "old-scan",
      createdAt: "2026-06-20T08:00:00.000Z",
      candidates: [],
    });

    assert.throws(
      () => readCandidateSnapshot("old-scan", {
        maxAgeMs: 60 * 1000,
        now: () => new Date("2026-06-20T08:02:01.000Z"),
      }),
      /Candidate scan expired/
    );
  });
});

test("scanEsportsCandidates rejects runtime sample mode", async () => {
  await withTempProject(async () => {
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));

    await assert.rejects(
      () => scanEsportsCandidates({ date: "2026-06-20", useSample: true }, {
        fetchSeriesCandidates: async () => [aggregatedSeries()],
      }),
      /useSample is not supported/
    );
  });
});

test("scanEsportsCandidates handles empty scans and raw game candidates", async () => {
  await withTempProject(async () => {
    const { scanEsportsCandidates, averageRadarScore, pickRecommendedMvp } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));

    const empty = await scanEsportsCandidates({}, {
      fetchSeriesCandidates: async (query) => {
        assert.deepEqual(query.languages, ["zh", "en"]);
        return null;
      },
      now: () => "2026-06-20T09:00:00.000Z",
    });
    assert.equal(empty.scanId.startsWith("scan-unknown-"), true);
    assert.equal(empty.sourceStatus.status, "empty");
    assert.deepEqual(empty.languages, ["zh", "en"]);
    assert.deepEqual(empty.candidates, []);
    assert.equal(averageRadarScore({ radarStats: [] }), 0);
    assert.equal(pickRecommendedMvp([]), null);

    const raw = await scanEsportsCandidates({
      date: "2026-06-20",
      activeMode: "msi",
      languages: ["EN", "zh", "", "en-US"],
    }, {
      fetchSeriesCandidates: async () => [{
        games: [{
          gameId: "game-1",
          date: "2026-06-20",
          league: "LCK",
          tournament: "LCK Summer",
          teamA: "T1",
          teamB: "GEN",
          durationMinutes: 32,
          winTeam: "T1",
          players: aggregatedSeries().players.map((entry, index) => ({
            name: entry.name,
            team: entry.team,
            role: entry.role,
            champion: entry.champions[0],
            kills: index < 5 ? 4 : 1,
            deaths: index < 5 ? 1 : 4,
            assists: index < 5 ? 8 : 3,
            damageToChampions: index < 5 ? 22000 : 11000,
            gold: index < 5 ? 14000 : 10000,
            cs: entry.role === "Support" ? 28 : 270,
            visionScore: entry.role === "Support" ? 78 : 32,
          })),
        }],
      }],
      now: () => new Date("2026-06-20T10:00:00.000Z"),
    });

    assert.deepEqual(raw.languages, ["en", "zh"]);
    assert.equal(raw.candidates.length, 1);
    assert.equal(raw.candidates[0].completeness.hasFiveRoleMatchups, true);
    assert.equal(raw.tournamentScope, "configured");
  });
});

test("candidate store recovers malformed snapshots and replaces duplicate scanIds", async () => {
  await withTempProject(async (dir) => {
    const { readStore, writeCandidateSnapshot, readCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));

    fs.mkdirSync(path.join(dir, ".data"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".data", "esports-candidate-scans.json"), "{bad json");
    assert.deepEqual(readStore(), { version: 1, scans: [] });

    assert.throws(() => writeCandidateSnapshot({ candidates: [] }), /scanId is required/);

    writeCandidateSnapshot({ scanId: "same-scan", createdAt: "2026-06-20T08:00:00.000Z", candidates: [{ seriesId: "old" }] });
    writeCandidateSnapshot({ scanId: "same-scan", createdAt: "2026-06-20T08:01:00.000Z", candidates: [{ seriesId: "new" }] });

    const scan = readCandidateSnapshot("same-scan", {
      maxAgeMs: 0,
      now: () => new Date("2026-06-20T08:01:00.000Z"),
    });
    assert.equal(scan.candidates[0].seriesId, "new");
    assert.equal(readStore().scans.length, 1);
  });
});
