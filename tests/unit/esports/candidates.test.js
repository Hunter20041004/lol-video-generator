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

function savedScan(overrides = {}) {
  return {
    scanId: "saved-scan",
    createdAt: "2026-06-21T08:00:00.000Z",
    date: "2026-06-20",
    activeMode: "daily",
    activeModeDetails: { tournaments: ["LCK", "LPL"] },
    languages: ["zh", "en"],
    tournamentScope: "configured",
    sourceStatus: { provider: "Leaguepedia", status: "ready", candidateCount: 1 },
    candidates: [aggregatedSeries()],
    ...overrides,
  };
}

test("latest compatible candidate snapshot selects the newest complete exact match", async () => {
  await withTempProject(async () => {
    const store = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const criteria = savedScan();
    store.writeCandidateSnapshot(savedScan());
    store.writeCandidateSnapshot(savedScan({ scanId: "latest", createdAt: "2026-06-21T09:00:00Z", languages: ["EN", "zh", "en"] }));
    for (const [index, mismatch] of [
      { date: "2026-06-19" }, { activeMode: "msi" }, { languages: ["zh"] },
      { tournamentScope: "LCK" }, { activeModeDetails: { tournaments: ["LEC"] } },
      { candidates: [] }, { candidates: [{ ...aggregatedSeries(), players: [] }] },
      { sourceStatus: { status: "empty" } }, { createdAt: "bad-date" },
      { createdAt: "2026-06-22T09:00:00Z" },
    ].entries()) {
      store.writeCandidateSnapshot(savedScan({ createdAt: "2026-06-21T09:30:00Z", ...mismatch, scanId: `mismatch-${index}` }));
    }
    const before = fs.readFileSync(store.STORE_PATH, "utf8");
    const options = { now: () => new Date("2026-06-21T10:00:00Z") };
    assert.equal(store.findLatestCompatibleSnapshot(criteria, options)?.scanId, "latest");
    assert.equal(store.findLatestCompatibleSnapshot(criteria, { ...options, maxAgeMs: 1000 }), null);
    assert.equal(fs.readFileSync(store.STORE_PATH, "utf8"), before);
  });
});

test("historical fresh scans reuse saved data without fetching or rewriting provenance", async () => {
  await withTempProject(async () => {
    const store = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const options = { date: "2026-06-20", activeMode: "daily", languages: ["zh", "en"] };
    const first = await scanEsportsCandidates(options, {
      now: () => new Date("2026-06-21T08:00:00Z"),
      fetchSeriesCandidates: async () => [aggregatedSeries()],
    });
    const before = fs.readFileSync(store.STORE_PATH, "utf8");
    const second = await scanEsportsCandidates({ ...options, languages: ["EN", "zh", "en"] }, {
      now: () => new Date("2026-06-21T09:00:00Z"),
      fetchSeriesCandidates: async () => assert.fail("unexpected upstream query"),
    });
    assert.equal(second.scanId, first.scanId);
    assert.equal(second.createdAt, first.createdAt);
    assert.equal(second.sourceStatus.status, "cached");
    assert.equal(second.sourceStatus.cacheReason, "fresh");
    assert.equal(second.sourceStatus.cachedAt, first.createdAt);
    assert.equal(fs.readFileSync(store.STORE_PATH, "utf8"), before);
  });
});

test("rate limited historical scans return a seven-day fallback with original provenance", async () => {
  await withTempProject(async () => {
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const options = { date: "2026-06-20", activeMode: "daily" };
    const first = await scanEsportsCandidates(options, {
      now: () => new Date("2026-06-21T08:00:00Z"),
      fetchSeriesCandidates: async () => [aggregatedSeries()],
    });
    const fallback = await scanEsportsCandidates(options, {
      now: () => new Date("2026-06-23T08:00:00Z"),
      fetchSeriesCandidates: async () => { throw Object.assign(new Error("limited"), { code: "LEAGUEPEDIA_RATE_LIMITED" }); },
    });
    assert.equal(fallback.scanId, first.scanId);
    assert.equal(fallback.createdAt, first.createdAt);
    assert.deepEqual(fallback.candidates, first.candidates);
    assert.equal(fallback.sourceStatus.status, "cached");
    assert.equal(fallback.sourceStatus.cacheReason, "rate_limit");
    assert.equal(fallback.sourceStatus.cachedAt, first.createdAt);
  });
});

test("real persisted cooldown fallback remains readable by preview after process restart", async () => {
  await withTempProject(async (dir) => {
    const { execFileSync } = require("node:child_process");
    const store = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const cooldown = require(path.join(ROOT, "utils/esports/sourceCooldown.js"));
    const nowMs = Date.now();
    const date = new Date(nowMs - 3 * 86400000).toISOString().slice(0, 10);
    const options = { date, activeMode: "daily" };
    const original = await scanEsportsCandidates(options, {
      now: () => new Date(nowMs - 2 * 86400000),
      fetchSeriesCandidates: async () => [{ ...aggregatedSeries(), date }],
    });
    assert.throws(() => store.readCandidateSnapshot(original.scanId), /expired/);
    cooldown.recordSourceCooldown("leaguepedia", { nowMs, cooldownMs: 60000 });
    const cooldownBefore = fs.readFileSync(cooldown.storePath(), "utf8");
    const fallback = await scanEsportsCandidates(options);
    assert.equal(fallback.sourceStatus.cacheReason, "rate_limit");
    // A separate process uses the exact default reader used by the preview runner.
    const reread = JSON.parse(execFileSync(process.execPath, ["-e",
      `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.join(ROOT, "utils/esports/candidateStore.js"))}).readCandidateSnapshot(${JSON.stringify(original.scanId)})))`,
    ], { cwd: dir, encoding: "utf8" }));
    assert.deepEqual(reread, fallback);
    assert.equal(reread.createdAt, original.createdAt);
    assert.equal(fs.readFileSync(cooldown.storePath(), "utf8"), cooldownBefore);
    const again = await scanEsportsCandidates(options);
    assert.equal(again.scanId, fallback.scanId);
    assert.throws(() => store.readCandidateSnapshot(original.scanId, { maxAgeMs: 86400000 }), /expired/);
    assert.throws(() => store.readCandidateSnapshot(original.scanId, { now: () => new Date(nowMs + 6 * 86400000) }), /expired/);
  });
});

test("cache safety guards keep ongoing dates, upstream errors and invalid fallbacks blocked", async () => {
  await withTempProject(async () => {
    const store = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const options = { date: "2026-06-20", activeMode: "daily" };
    const clock = (date) => () => new Date(date);
    const now = clock("2026-06-21T08:00:00Z");
    const first = await scanEsportsCandidates(options, { now, fetchSeriesCandidates: async () => [aggregatedSeries()] });
    const limited = Object.assign(new Error("limited"), { code: "LEAGUEPEDIA_RATE_LIMITED" });
    const upstream = Object.assign(new Error("upstream"), { code: "LEAGUEPEDIA_UPSTREAM_ERROR" });
    await assert.rejects(() => scanEsportsCandidates(options, {
      now: clock("2026-06-23T08:00:00Z"), fetchSeriesCandidates: async () => { throw upstream; },
    }), (error) => error === upstream);
    for (const date of ["2026-06-20", "2026-06-19"]) {
      await assert.rejects(() => scanEsportsCandidates(options, {
        now: clock(`${date}T09:00:00Z`), fetchSeriesCandidates: async () => { throw limited; },
      }), (error) => error === limited);
    }
    await assert.rejects(() => scanEsportsCandidates(options, {
      now: clock("2026-06-29T08:00:00Z"), fetchSeriesCandidates: async () => { throw limited; },
    }), (error) => error === limited);
    const sourceStatus = { ...first.sourceStatus, status: "cached", cacheReason: "rate_limit", cachedAt: first.createdAt };
    for (const [index, invalid] of [
      { candidates: [] }, { date: "2026-06-23" }, { date: "2026-06-24" },
      { date: "2026-02-30" }, { sourceStatus: { ...sourceStatus, cacheReason: "fresh" } },
      { sourceStatus: { ...sourceStatus, cachedAt: "2026-06-23T08:00:00Z" } },
    ].entries()) {
      const snapshot = { ...first, sourceStatus, ...invalid, scanId: `invalid-${index}` };
      store.writeCandidateSnapshot(snapshot);
      assert.throws(() => store.readCandidateSnapshot(snapshot.scanId, { now: clock("2026-06-23T08:00:00Z") }), /expired/);
    }
  });
});

test("snapshot reader rejects invalid and future source timestamps", async () => {
  await withTempProject(async () => {
    const store = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    for (const createdAt of ["invalid", "2026-06-25T08:00:00Z"]) {
      const scan = savedScan({ createdAt, sourceStatus: { status: "cached", cacheReason: "rate_limit", cachedAt: createdAt } });
      store.writeCandidateSnapshot(scan);
      assert.throws(() => store.readCandidateSnapshot(scan.scanId, { now: () => new Date("2026-06-23T08:00:00Z") }), /expired/);
    }
  });
});

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

test("scanEsportsCandidates resolves daily mode into active tournament filters before fetching", async () => {
  await withTempProject(async () => {
    const { scanEsportsCandidates } = require(path.join(ROOT, "utils/esports/candidateScanner.js"));
    const fetchQueries = [];

    const result = await scanEsportsCandidates({
      date: "2026-07-06",
      activeMode: "daily",
      languages: ["zh"],
    }, {
      fetchSeriesCandidates: async (query) => {
        fetchQueries.push(query);
        return [aggregatedSeries()];
      },
      now: () => new Date("2026-07-07T08:00:00.000Z"),
    });

    assert.equal(fetchQueries.length, 1);
    assert.equal(fetchQueries[0].date, "2026-07-06");
    assert.equal(fetchQueries[0].activeMode.mode, "msi");
    assert.deepEqual(fetchQueries[0].activeMode.tournaments, ["MSI", "Mid-Season Invitational"]);
    assert.equal(result.activeMode, "msi");
    assert.equal(result.sourceStatus.status, "ready");
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

test("candidate store resolves its data path from the operation-time cwd", async () => {
  await withTempProject(async (rootDir) => {
    const projectA = path.join(rootDir, "project-a");
    const projectB = path.join(rootDir, "project-b");
    fs.mkdirSync(projectA, { recursive: true });
    fs.mkdirSync(projectB, { recursive: true });
    process.chdir(projectA);
    clearCandidateModules();
    const { writeCandidateSnapshot, readCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));

    process.chdir(projectB);
    writeCandidateSnapshot({ scanId: "operation-cwd", candidates: [] });

    assert.equal(fs.existsSync(path.join(projectA, ".data", "esports-candidate-scans.json")), false);
    assert.equal(readCandidateSnapshot("operation-cwd").scanId, "operation-cwd");
    assert.equal(fs.existsSync(path.join(projectB, ".data", "esports-candidate-scans.json")), true);
  });
});
