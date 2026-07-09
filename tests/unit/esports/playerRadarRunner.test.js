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

const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

function makePlayer(team, role, name, values = {}) {
  const isSupport = role === "Support";
  const rawStats = {
    role,
    kills: values.kills ?? 4,
    deaths: values.deaths ?? 2,
    assists: values.assists ?? 8,
    kda: values.kda ?? 6,
    dpm: values.dpm ?? 520,
    kp: values.kp ?? 0.7,
    gpm: values.gpm ?? 420,
    csm: isSupport ? 0.8 : values.csm ?? 8.1,
    vpm: isSupport ? values.vpm ?? 2.4 : values.vpm ?? 1.1,
  };
  const roleMetric = isSupport
    ? { label: "VPM", rawValue: String(rawStats.vpm), normalizedScore: values.roleScore ?? 70 }
    : { label: "CSM", rawValue: String(rawStats.csm), normalizedScore: values.roleScore ?? 70 };

  return {
    name,
    team,
    role,
    champions: [`${role} Champ`],
    rawStats,
    radarStats: [
      { label: "KDA", rawValue: String(rawStats.kda), normalizedScore: values.kdaScore ?? 70 },
      { label: "DPM", rawValue: String(rawStats.dpm), normalizedScore: values.dpmScore ?? 70 },
      { label: "KP%", rawValue: `${Math.round(rawStats.kp * 100)}%`, normalizedScore: values.kpScore ?? 70 },
      { label: "GPM", rawValue: String(rawStats.gpm), normalizedScore: values.gpmScore ?? 70 },
      roleMetric,
    ],
  };
}

function makeSnapshot() {
  const left = {
    Top: makePlayer("T1", "Top", "T1 Top", { kdaScore: 62, dpmScore: 60, kpScore: 61, gpmScore: 62, roleScore: 63, dpm: 470, kp: 0.58, gpm: 380, csm: 7.8 }),
    Jungle: makePlayer("T1", "Jungle", "T1 Jungle", { kdaScore: 88, dpmScore: 82, kpScore: 90, gpmScore: 84, roleScore: 77, dpm: 610, kp: 0.84, gpm: 430, csm: 6.4 }),
    Mid: makePlayer("T1", "Mid", "T1 Mid", { kdaScore: 96, dpmScore: 94, kpScore: 95, gpmScore: 92, roleScore: 91, kda: 9, dpm: 720, kp: 0.86, gpm: 470, csm: 9.3 }),
    Adc: makePlayer("T1", "Adc", "T1 Adc", { kdaScore: 72, dpmScore: 74, kpScore: 70, gpmScore: 75, roleScore: 74, dpm: 590, kp: 0.66, gpm: 440, csm: 8.9 }),
    Support: makePlayer("T1", "Support", "T1 Support", { kdaScore: 76, dpmScore: 45, kpScore: 82, gpmScore: 42, roleScore: 84, dpm: 210, kp: 0.78, gpm: 270, vpm: 2.8 }),
  };
  const right = {
    Top: makePlayer("GEN", "Top", "GEN Top", { kdaScore: 58, dpmScore: 57, kpScore: 59, gpmScore: 58, roleScore: 57, dpm: 440, kp: 0.55, gpm: 365, csm: 7.4 }),
    Jungle: makePlayer("GEN", "Jungle", "GEN Jungle", { kdaScore: 70, dpmScore: 68, kpScore: 69, gpmScore: 67, roleScore: 66, dpm: 500, kp: 0.66, gpm: 390, csm: 5.7 }),
    Mid: makePlayer("GEN", "Mid", "GEN Mid", { kdaScore: 35, dpmScore: 38, kpScore: 40, gpmScore: 37, roleScore: 36, kda: 2.1, dpm: 360, kp: 0.48, gpm: 330, csm: 6.7 }),
    Adc: makePlayer("GEN", "Adc", "GEN Adc", { kdaScore: 68, dpmScore: 70, kpScore: 66, gpmScore: 69, roleScore: 68, dpm: 560, kp: 0.62, gpm: 420, csm: 8.5 }),
    Support: makePlayer("GEN", "Support", "GEN Support", { kdaScore: 72, dpmScore: 48, kpScore: 76, gpmScore: 44, roleScore: 78, dpm: 230, kp: 0.72, gpm: 265, vpm: 2.5 }),
  };
  const roleMatchups = ROLES.map((role) => ({ role, left: left[role], right: right[role] }));
  const players = roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]);

  return {
    scanId: "scan-radar",
    createdAt: new Date().toISOString(),
    candidates: [{
      seriesId: "series-1",
      league: "LCK",
      teamA: "T1",
      teamB: "GEN",
      teams: ["T1", "GEN"],
      winningTeam: "T1",
      seriesScore: "2-0",
      score: "2-0",
      players,
      roleMatchups,
      recommendedMvp: { name: "T1 Jungle", team: "T1", role: "Jungle", score: 84 },
    }],
  };
}

test("buildPlayerRadarPayload auto-selects max matchup edge and MVP proof segment", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, {}, "zh");

    assert.equal(payload.dataType, "PLAYER_RADAR");
    assert.equal(payload.matchupSegment.role, "Mid");
    assert.equal(payload.matchupSegment.focusPlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.opponentPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgeWinnerTeam, "T1");
    assert.equal(payload.matchupSegment.edgeType, "winner-breakpoint");
    assert.equal(payload.matchupSegment.reasons.length >= 2, true);
    assert.equal(payload.proofSegment.player.name, "T1 Jungle");
    assert.equal(payload.proofSegment.proofType, "mvp");
    assert.equal(payload.proofSegment.isRecommendedMvp, true);
    assert.equal(payload.proofSegment.proofReasons.length >= 2, true);
    assert.equal(payload.player.name, "T1 Jungle");
  });
});

test("playerName overrides both matchup focus and proof player", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, { playerName: "GEN Mid" }, "zh");

    assert.equal(payload.matchupSegment.role, "Mid");
    assert.equal(payload.matchupSegment.focusPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.matchupSegment.opponentPlayer.name, "T1 Mid");
    assert.notEqual(payload.matchupSegment.focusPlayer.name, payload.matchupSegment.opponentPlayer.name);
    assert.notEqual(payload.matchupSegment.focusPlayer.name, payload.matchupSegment.edgePlayer.name);
    assert.equal(payload.proofSegment.player.name, "GEN Mid");
    assert.equal(payload.proofSegment.proofType, "key-player");
    assert.equal(payload.proofSegment.isRecommendedMvp, false);
  });
});

test("mvpPlayerName and matchupPlayerName can override separate segments", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];

    const payload = buildPlayerRadarPayload(series, {
      mvpPlayerName: "T1 Top",
      matchupPlayerName: "GEN Mid",
    }, "zh");

    assert.equal(payload.matchupSegment.focusPlayer.name, "GEN Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(payload.proofSegment.player.name, "T1 Top");
    assert.equal(payload.proofSegment.proofType, "key-player");
  });
});

test("player radar fails clearly for unknown players, missing opponents, and weak reasons", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const snapshot = makeSnapshot();
    const series = snapshot.candidates[0];

    assert.throws(
      () => buildPlayerRadarPayload(series, { playerName: "Unknown Player" }, "zh"),
      /Player not found in snapshot: Unknown Player/
    );

    const missingOpponentSeries = {
      ...series,
      players: series.players.filter((player) => player.name !== "GEN Mid"),
      roleMatchups: series.roleMatchups.map((matchup) =>
        matchup.role === "Mid" ? { ...matchup, right: null } : matchup
      ),
    };
    assert.throws(
      () => buildPlayerRadarPayload(missingOpponentSeries, { matchupPlayerName: "T1 Mid" }, "zh"),
      /Opponent not found in snapshot for player: T1 Mid/
    );

    const weakSeries = {
      ...series,
      roleMatchups: [{
        role: "Mid",
        left: {
          ...series.roleMatchups[2].left,
          rawStats: { role: "Mid", kda: 3, dpm: 400, kp: 0.5, gpm: 350, csm: 7 },
        },
        right: {
          ...series.roleMatchups[2].right,
          rawStats: { role: "Mid", kda: 3, dpm: 400, kp: 0.5, gpm: 350, csm: 7 },
        },
      }],
    };
    assert.throws(
      () => buildPlayerRadarPayload(weakSeries, {}, "zh"),
      /needs at least 2 verifiable reasons/
    );
  });
});

test("runPlayerRadarFromSnapshot renders one dual-read video per locale and queues IG/Threads jobs", async () => {
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
        return { videoUrl: `/renders/${payload.locale}-player-radar.mp4`, fileName: `${payload.locale}.mp4` };
      },
      createPublishJobs: async (payload) => {
        queued.push(payload);
        return { success: true, jobs: payload.videos.flatMap((video) => ["instagram", "threads"].map((platform) => ({ platform, locale: video.locale }))) };
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.player.name, "T1 Jungle");
    assert.equal(result.matchupSegment.edgePlayer.name, "T1 Mid");
    assert.equal(result.proofSegment.player.name, "T1 Jungle");
    assert.deepEqual(renderedPayloads.map((payload) => payload.locale), ["zh", "en"]);
    assert.deepEqual(renderedPayloads[0].storyboard.map((scene) => scene.tag), [
      "HOOK",
      "MATCHUP_EDGE",
      "PLAYER_PROOF",
      "CONCLUSION_CTA",
    ]);
    assert.equal(renderedPayloads[0].renderLanguages[0], "zh");
    assert.equal(renderedPayloads[1].renderLanguages[0], "en");
    assert.equal(result.videos.length, 2);
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
    assert.equal(result.payloads[0].matchupSegment.focusPlayer.name, "GEN Support");
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
    assert.equal(englishPayload.proofSegment.player.name, "T1 Top");
    assert.equal(englishPayload.proofSegment.proofType, "key-player");
    assert.match(englishPayload.verdict, /key-player case/);

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
    const weakTopOpponent = {
      ...snapshot.candidates[0].players.find((player) => player.name === "GEN Top"),
      radarStats: [
        { label: "KDA", rawValue: "1.8", normalizedScore: 12 },
        { label: "DPM", rawValue: "280", normalizedScore: 11 },
        { label: "KP%", rawValue: "41%", normalizedScore: 10 },
        { label: "GPM", rawValue: "310", normalizedScore: 12 },
        { label: "CSM", rawValue: "6.1", normalizedScore: 11 },
      ],
    };
    snapshot.candidates[0].recommendedMvp = { name: "Stale MVP" };
    snapshot.candidates[0].players.push({
      name: "No Stats",
      team: "T1",
      role: "Top",
      champion: "Gnar",
      radarStats: [],
    });
    snapshot.candidates[0].roleMatchups.push({
      role: "Top",
      left: snapshot.candidates[0].players.find((player) => player.name === "No Stats"),
      right: weakTopOpponent,
    });
    writeCandidateSnapshot(snapshot);

    const {
      buildPlayerRadarPayload,
      normalizeLanguages,
      runPlayerRadarFromSnapshot,
    } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));

    assert.deepEqual(normalizeLanguages([]), ["zh", "en"]);
    assert.deepEqual(normalizeLanguages("en"), ["zh", "en"]);

    assert.throws(
      () => buildPlayerRadarPayload(snapshot.candidates[0], {
        matchupPlayerName: "T1 Mid",
        mvpPlayerName: "No Stats",
      }, "zh"),
      /proof segment needs at least 2 verifiable reasons/
    );

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

test("runPlayerRadarFromSnapshot rejects label-only and NaN proof stats before render and publish", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const snapshot = makeSnapshot();
    const jungle = snapshot.candidates[0].players.find((player) => player.name === "T1 Jungle");
    jungle.radarStats = [
      { label: "KDA" },
      { label: "DPM", rawValue: String(jungle.rawStats.dpm), normalizedScore: Number.NaN },
      { label: "KP%", rawValue: `${Math.round(jungle.rawStats.kp * 100)}%` },
      { label: "GPM", normalizedScore: 84 },
      { label: "CSM", rawValue: String(jungle.rawStats.csm), normalizedScore: null },
    ];
    writeCandidateSnapshot(snapshot);

    const { runPlayerRadarFromSnapshot } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    let renderCalls = 0;
    let publishCalls = 0;

    await assert.rejects(
      () => runPlayerRadarFromSnapshot({
        scanId: "scan-radar",
        seriesId: "series-1",
        matchupPlayerName: "T1 Mid",
        languages: ["zh"],
      }, {
        renderVideosFromRequest: async () => {
          renderCalls += 1;
          return { videoUrl: "/renders/zh.mp4", fileName: "zh.mp4" };
        },
        createPublishJobs: async () => {
          publishCalls += 1;
          return { success: true, jobs: [] };
        },
      }),
      /proof segment needs at least 2 verifiable reasons/
    );

    assert.equal(renderCalls, 0);
    assert.equal(publishCalls, 0);
  });
});

test("player radar rejects matchup reasons with missing opponent raw stats before render and publish", async () => {
  await withTempProject(async () => {
    const { writeCandidateSnapshot } = require(path.join(ROOT, "utils/esports/candidateStore.js"));
    const snapshot = makeSnapshot();
    const midMatchup = snapshot.candidates[0].roleMatchups.find((matchup) => matchup.role === "Mid");
    const midOpponent = snapshot.candidates[0].players.find((player) => player.name === "GEN Mid");
    const topMatchup = snapshot.candidates[0].roleMatchups.find((matchup) => matchup.role === "Top");

    midMatchup.right = {
      ...midMatchup.right,
      rawStats: {
        role: "Mid",
        kda: null,
        dpm: undefined,
        kp: "",
        gpm: Number.NaN,
        csm: null,
      },
    };
    const opponentIndex = snapshot.candidates[0].players.findIndex((player) => player.name === "GEN Mid");
    snapshot.candidates[0].players[opponentIndex] = midMatchup.right;

    topMatchup.left = {
      ...topMatchup.left,
      rawStats: {
        ...topMatchup.right.rawStats,
        kda: topMatchup.right.rawStats.kda + 0.1,
      },
    };

    writeCandidateSnapshot(snapshot);

    const {
      buildPlayerRadarPayload,
      runPlayerRadarFromSnapshot,
    } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    let renderCalls = 0;
    let publishCalls = 0;

    assert.throws(
      () => buildPlayerRadarPayload(snapshot.candidates[0], { matchupPlayerName: "T1 Mid" }, "zh"),
      /matchup segment needs at least 2 verifiable reasons for Mid/
    );

    await assert.rejects(
      () => runPlayerRadarFromSnapshot({
        scanId: "scan-radar",
        seriesId: "series-1",
        languages: ["zh"],
      }, {
        renderVideosFromRequest: async () => {
          renderCalls += 1;
          return { videoUrl: "/renders/zh.mp4", fileName: "zh.mp4" };
        },
        createPublishJobs: async () => {
          publishCalls += 1;
          return { success: true, jobs: [] };
        },
      }),
      /matchup segment needs at least 2 verifiable reasons for Mid/
    );

    assert.equal(renderCalls, 0);
    assert.equal(publishCalls, 0);
    assert.equal(midOpponent.name, "GEN Mid");
  });
});

test("auto matchup selection skips weaker invalid roles but manual weak matchup still throws", async () => {
  await withTempProject(async () => {
    const { buildPlayerRadarPayload } = require(path.join(ROOT, "utils/esports/playerRadarRunner.js"));
    const series = makeSnapshot().candidates[0];
    const topMatchup = series.roleMatchups.find((matchup) => matchup.role === "Top");

    topMatchup.left = {
      ...topMatchup.left,
      rawStats: {
        ...topMatchup.right.rawStats,
        kda: topMatchup.right.rawStats.kda + 0.1,
      },
    };
    topMatchup.right = {
      ...topMatchup.right,
      rawStats: {
        ...topMatchup.right.rawStats,
      },
    };

    const payload = buildPlayerRadarPayload(series, {}, "zh");
    assert.equal(payload.matchupSegment.role, "Mid");
    assert.equal(payload.matchupSegment.edgePlayer.name, "T1 Mid");

    assert.throws(
      () => buildPlayerRadarPayload(series, { matchupPlayerName: "T1 Top" }, "zh"),
      /matchup segment needs at least 2 verifiable reasons for Top/
    );
  });
});
