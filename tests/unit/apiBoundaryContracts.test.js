const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PLAYER_RADAR_EVIDENCE_ERROR = /Player Radar .*(needs at least 2 verifiable reasons|contains unverifiable displayed)/;

test("analyze API parses untrusted patch text without polynomial regular expressions", () => {
  const source = fs.readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const unsafePatterns = [
    "/\\(([^)]*)\\)/g",
    "/\\s*([＋+\\-−]\\d)/g",
    "/\\s*（\\s*/g",
    "/\\s*）\\s*/g",
    "/\\s+(?:and|與)\\s+$/i",
    "/^(.+?)\\s*(?:⇒|→|->|>>>|=>|\\bto\\b)\\s*(.+)$/i",
    "/^(.*?)(-?\\d+(?:\\.\\d+)?%?(?:\\s*\\([^)]*\\))?)$/",
    "/【([^】]+)】[：:]\\s*([\\s\\S]*?)(?=\\n{2,}【|$)/g",
    "/([A-Za-z\\u4e00-\\u9fff%/()（）\\s+\\-]{1,40}?)[:：]?\\s*(-?\\d+(?:\\.\\d+)?%?)\\s*(?:⇒|→|->|>>>|=>| to )\\s*(-?\\d+(?:\\.\\d+)?%?)/gi",
  ];

  for (const pattern of unsafePatterns) assert.equal(source.includes(pattern), false, pattern);
});

function buildTestRadarStats(rawStats = {}) {
  const { buildRadarStats } = require(path.join(ROOT, "utils/esports/seriesAggregator.js"));
  return buildRadarStats(rawStats);
}

function statByLabel(stats = [], label = "") {
  return stats.find((stat) => stat.label === label);
}

function makeValidPlayerRadarAnalysis(overrides = {}) {
  const proofRawStats = { role: "Mid", dpm: 720, kp: 0.84 };
  const proofRadarStats = buildTestRadarStats(proofRawStats);
  const edgeRawStats = { role: "Mid", dpm: 720, kp: 0.86 };
  const loserRawStats = { role: "Mid", dpm: 360, kp: 0.48 };
  const edgeRadarStats = buildTestRadarStats(edgeRawStats);
  const loserRadarStats = buildTestRadarStats(loserRawStats);
  const edgeScore = ((statByLabel(edgeRadarStats, "DPM").normalizedScore + statByLabel(edgeRadarStats, "KP%").normalizedScore) / 2)
    - ((statByLabel(loserRadarStats, "DPM").normalizedScore + statByLabel(loserRadarStats, "KP%").normalizedScore) / 2);
  const storyboard = [
    { tag: "RESULT_HOOK", text: "GEN 2-0 T1", durationInFrames: 120 },
    { tag: "MATCHUP_EDGE", text: "中路對位差距是系列賽最大斷層。", durationInFrames: 150 },
    { tag: "GAME_FLOW", text: "T1 先拿巢蟲，GEN 靠 8-4 防禦塔把優勢轉成勝利。", durationInFrames: 240 },
    { tag: "PLAYER_PROOF", text: "關鍵人物 GEN Mid，720 DPM。", durationInFrames: 150 },
    { tag: "FINAL_READ", text: "對位差距與傷害輸出共同完成收尾。", durationInFrames: 90 },
  ];
  return {
    dataType: "PLAYER_RADAR",
    locale: "zh",
    matchContext: { league: "LCK", teamA: "GEN", teamB: "T1", winningTeam: "GEN", seriesScore: "2-0" },
    player: {
      name: "GEN Mid",
      team: "GEN",
      role: "Mid",
      rawStats: proofRawStats,
      radarStats: proofRadarStats,
    },
    matchupSegment: {
      role: "Mid",
      edgeType: "loser-highlight",
      edgeScore,
      focusPlayer: { name: "GEN Mid", team: "GEN", role: "Mid", rawStats: loserRawStats, radarStats: loserRadarStats },
      edgePlayer: { name: "T1 Mid", team: "T1", role: "Mid", rawStats: edgeRawStats, radarStats: edgeRadarStats },
      opponentPlayer: { name: "T1 Mid", team: "T1", role: "Mid", rawStats: edgeRawStats, radarStats: edgeRadarStats },
      edgeWinnerTeam: "T1",
      reasons: [
        { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 },
        { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
      ],
    },
    proofSegment: {
      player: {
        name: "GEN Mid",
        team: "GEN",
        role: "Mid",
        rawStats: proofRawStats,
        radarStats: proofRadarStats,
      },
      proofReasons: [
        { metric: "KP%", rawValue: statByLabel(proofRadarStats, "KP%").rawValue, score: statByLabel(proofRadarStats, "KP%").normalizedScore },
        { metric: "DPM", rawValue: statByLabel(proofRadarStats, "DPM").rawValue, score: statByLabel(proofRadarStats, "DPM").normalizedScore },
      ],
    },
    postMatchRead: {
      branding: { publicTitle: "賽後判讀", publicTitleEn: "POST MATCH READ" },
      seriesContext: { league: "LCK", seriesId: "series-1", teamA: "GEN", teamB: "T1", score: "2-0", gameCount: 2, scopeLabel: "LCK · 2-0" },
      hook: { metric: "DPM", leftRaw: 720, rightRaw: 360, displayValue: "約 2×", comparisonType: "ratio", approximate: true, question: "這個系列賽，中路差距有多誇張？" },
      resultHook: { score: "2-0", scoreParts: ["2", "0"], resultClaim: "GEN 以 2-0 擊敗 T1", displayOrder: ["GEN", "2-0", "T1"] },
      matchup: {
        claimScope: "series-maximum",
        scopeClaim: "系列賽最大對位差距",
        claim: "中路對位是 GEN 取勝的重要突破口。",
        scopeLabel: "LCK · 2-0",
        primaryEvidence: { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360, displayValue: "+360 DPM" },
      },
      gameFlow: {
        gameNumber: 1,
        gameId: "series-1-game-1",
        earlyResourceTeam: "T1",
        finalMapTeam: "GEN",
        earlyResources: { voidGrubs: 3, riftHeralds: 1 },
        conversion: { barons: 1, towers: 8 },
        goldDelta: 8917,
        towerScore: "8–4",
        teamFinals: [
          { team: "GEN", isWinner: true, gold: 77031, towers: 8, barons: 1, voidGrubs: 0, riftHeralds: 0, source: "ScoreboardTeams", snapshotType: "team-final", hasEventTimestamps: false },
          { team: "T1", isWinner: false, gold: 68114, towers: 4, barons: 0, voidGrubs: 3, riftHeralds: 1, source: "ScoreboardTeams", snapshotType: "team-final", hasEventTimestamps: false },
        ],
        analysisClaim: "T1 先拿 3 隻巢蟲與 1 隻預示者，GEN 最後靠 1 條巴龍與 8-4 防禦塔完成轉換。",
        conclusion: "前期資源領先不等於最終地圖控制。",
        claimBasis: { source: "ScoreboardTeams", snapshotType: "team-final", hasEventTimestamps: false },
      },
      proof: { labelType: "key-player", label: "關鍵人物", claim: "關鍵人物: GEN Mid" },
      finalRead: {
        conclusion: "中路對位差距與 GEN Mid 的傷害輸出共同完成收尾。",
        recapReferences: [
          { source: "matchup", metric: "DPM", displayValue: "+360 DPM" },
          { source: "proof", metric: "DPM", displayValue: "720 DPM" },
        ],
      },
      assets: {},
      audioPlan: null,
      storyboard,
    },
    storyboard,
    ...overrides,
  };
}

test("player radar evidence requires the fixed post-match read model", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({ postMatchRead: null })),
    /Player Radar postMatchRead model is required/
  );
});

test("player radar evidence requires the fixed five-scene storyboard order", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();
  const wrongOrder = [base.postMatchRead.storyboard[1], base.postMatchRead.storyboard[0], ...base.postMatchRead.storyboard.slice(2)];

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: { ...base.postMatchRead, storyboard: wrongOrder },
    })),
    /Player Radar postMatchRead storyboard must use the fixed scene order/
  );
});

test("player radar evidence requires a 750-frame post-match read", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();
  const tooLong = base.postMatchRead.storyboard.map((scene, index) => index === 0
    ? { ...scene, durationInFrames: 121 }
    : scene);

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: { ...base.postMatchRead, storyboard: tooLong },
    })),
    /Player Radar postMatchRead storyboard must total 750 frames/
  );
});

test("player radar evidence rejects game-flow totals that do not match team-final evidence", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: {
        ...base.postMatchRead,
        gameFlow: { ...base.postMatchRead.gameFlow, goldDelta: 9000 },
      },
    })),
    /Player Radar game flow gold delta must match team-final evidence/
  );
});

test("player radar evidence rejects final recaps that are not backed by matchup and proof stats", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();
  const forgedReferences = base.postMatchRead.finalRead.recapReferences.map((reference, index) => index === 1
    ? { ...reference, metric: "KDA", displayValue: "+99 KDA" }
    : reference);

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: {
        ...base.postMatchRead,
        finalRead: { ...base.postMatchRead.finalRead, recapReferences: forgedReferences },
      },
    })),
    /Player Radar final read recap must match matchup and proof evidence/
  );
});

test("player radar evidence rejects ratio hooks with a zero denominator", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: {
        ...base.postMatchRead,
        hook: { ...base.postMatchRead.hook, comparisonType: "ratio", rightRaw: 0, displayValue: "約 720×" },
      },
    })),
    /Player Radar ratio hook needs a positive denominator/
  );
});

test("player radar evidence requires an approximation marker for Chinese ratio hooks", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: {
        ...base.postMatchRead,
        hook: { ...base.postMatchRead.hook, approximate: true, displayValue: "2×" },
      },
    })),
    /Player Radar approximate Chinese ratio hook must include 約/
  );
});

test("player radar evidence rejects official MVP copy without official source status", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      postMatchRead: {
        ...base.postMatchRead,
        proof: { ...base.postMatchRead.proof, labelType: "data-mvp-candidate", label: "官方 MVP" },
      },
    })),
    /Player Radar non-official proof cannot use official MVP copy/
  );
});

test("analyze API guard rejects removed dataTypes before invoking analysis dependencies", () => {
  const { validateAnalyzeRequest } = require(path.join(ROOT, "utils/apiGuards.js"));

  assert.throws(
    () => validateAnalyzeRequest({ dataType: "TIER_LIST", role: "MID" }),
    /Unsupported dataType: TIER_LIST/
  );
  assert.deepEqual(validateAnalyzeRequest({ dataType: "PATCH", championName: "Quinn" }), {
    dataType: "PATCH",
  });
});

test("analyze API guard rejects player radar on the generic route with a redirect message", () => {
  const { validateAnalyzeRequest } = require(path.join(ROOT, "utils/apiGuards.js"));

  assert.throws(
    () => validateAnalyzeRequest({ dataType: "PLAYER_RADAR", playerName: "Faker" }),
    /PLAYER_RADAR must use \/api\/esports\/player-radar/
  );
});

test("render service rejects removed dataTypes without producing render files", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-render-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    await assert.rejects(
      () => renderVideosFromRequest({
        dataType: "ESPORTS_DRAMA",
        title: "removed",
      }, {
        execRenderImpl: async () => {
          throw new Error("render should not be called");
        },
      }),
      /Unsupported dataType: ESPORTS_DRAMA/
    );
    assert.equal(fs.existsSync(path.join(dir, "public", "renders")), true);
    assert.deepEqual(fs.readdirSync(path.join(dir, "public", "renders")), []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render service rejects player radar without dual-read evidence before producing render files", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-render-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest({
        dataType: "player_radar",
        title: "Bypass attempt",
        matchupSegment: {
          role: "Mid",
          reasons: [{ metric: "DPM", winnerValue: 720 }],
        },
      }, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("publish API guard rejects removed dataTypes and unsupported platforms", () => {
  const { validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));

  assert.throws(
    () => validatePublishRequest({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PRO_BUILD" },
      platforms: ["instagram"],
    }),
    /Unsupported dataType: PRO_BUILD/
  );
  assert.throws(
    () => validatePublishRequest({
      videoUrl: "/renders/clip.mp4",
      analysis: { dataType: "PATCH" },
      platforms: ["youtube"],
    }),
    /Unsupported platform: youtube/
  );
  assert.throws(
    () => validatePublishRequest({
      videoUrl: "/renders/clip.mp4",
      analysis: {
        dataType: "PLAYER_RADAR",
        matchupSegment: {
          role: "Mid",
          reasons: [{ metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 }],
        },
        proofSegment: {
          player: { name: "T1 Jungle" },
          proofReasons: [{ metric: "KP%", rawValue: "84%", score: 90 }],
        },
      },
      platforms: ["instagram"],
    }),
    PLAYER_RADAR_EVIDENCE_ERROR
  );
  assert.deepEqual(
    validatePublishRequest({ analysis: { dataType: "PATCH" }, platform: "all" }),
    { dataType: "PATCH", platforms: ["instagram", "threads"] }
  );
  assert.deepEqual(validatePublishRequest({ dataType: "SYSTEM_UPDATE" }), {
    dataType: "SYSTEM_UPDATE",
    platforms: ["instagram"],
  });
  assert.deepEqual(validatePublishRequest({
    analysis: { dataType: "RUNE_UPDATE" },
    platforms: ["threads"],
  }), {
    dataType: "RUNE_UPDATE",
    platforms: ["threads"],
  });
});

test("publish job creation rejects player radar without dual-read evidence before queueing tasks", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-publish-boundary-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");

    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    await assert.rejects(
      () => createPublishJobs({
        videoUrl: "/renders/clip.mp4",
        analysis: {
          dataType: "PLAYER_RADAR",
          matchupSegment: {
            role: "Mid",
            reasons: [{ metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 }],
          },
          proofSegment: {
            player: { name: "T1 Jungle" },
            proofReasons: [{ metric: "KP%", rawValue: "84%", score: 90 }],
          },
        },
        platforms: ["instagram"],
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("publish boundaries validate localized player radar payloads before queueing tasks", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-localized-publish-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip-en.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");

    const analysis = makeValidPlayerRadarAnalysis({
      localizedPayloads: {
        en: makeValidPlayerRadarAnalysis({
          proofSegment: {
            player: { name: "GEN Mid", team: "GEN", role: "Mid" },
            proofReasons: [
              { metric: "KP%", rawValue: "trust me", score: 90 },
              { metric: "DPM", rawValue: "720", score: 88 },
            ],
          },
        }),
      },
    });

    const { validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    assert.throws(
      () => validatePublishRequest({ analysis, platforms: ["instagram"] }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    await assert.rejects(
      () => createPublishJobs({
        videos: [{ locale: "en", videoUrl: "/renders/clip-en.mp4" }],
        analysis,
        platforms: ["instagram"],
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("publish boundaries reject localized-only player radar payloads without wrapper dataType", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-localized-only-publish-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip-en.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");

    const analysis = {
      localizedPayloads: {
        en: makeValidPlayerRadarAnalysis({
          proofSegment: {
            player: { name: "GEN Mid", team: "GEN", role: "Mid" },
            proofReasons: [
              { metric: "KP%", rawValue: "trust me", score: 90 },
              { metric: "DPM", rawValue: "720", score: 88 },
            ],
          },
        }),
      },
    };

    const { validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    assert.throws(
      () => validatePublishRequest({ analysis, platforms: ["instagram"] }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    await assert.rejects(
      () => createPublishJobs({
        videos: [{ locale: "en", videoUrl: "/renders/clip-en.mp4" }],
        analysis,
        platforms: ["instagram"],
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render and publish boundaries reject malformed localized player radar payload entries", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-malformed-localized-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip-en.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");

    const { validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest({
        ...makeValidPlayerRadarAnalysis(),
        renderLanguages: ["zh", "en"],
        localizedPayloads: { en: null },
      }, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar localized payload must be an object/
    );

    assert.equal(renderCalls, 0);

    const malformedPublishAnalysis = makeValidPlayerRadarAnalysis({
      localizedPayloads: { en: "not a payload" },
    });

    assert.throws(
      () => validatePublishRequest({ analysis: malformedPublishAnalysis, platforms: ["instagram"] }),
      /Player Radar localized payload must be an object/
    );
    assert.throws(
      () => validatePublishRequest({
        analysis: makeValidPlayerRadarAnalysis({ localizedPayloads: [] }),
        platforms: ["instagram"],
      }),
      /Player Radar localizedPayloads must be an object/
    );

    await assert.rejects(
      () => createPublishJobs({
        videos: [{ locale: "en", videoUrl: "/renders/clip-en.mp4" }],
        analysis: malformedPublishAnalysis,
        platforms: ["instagram"],
      }),
      /Player Radar localized payload must be an object/
    );

    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.readdirSync(rendersDir), ["clip-en.mp4"]);
    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render and publish boundaries reject bogus player radar evidence before side effects", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-bogus-boundary-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");

    const bogusAnalysis = {
      dataType: "PLAYER_RADAR",
      matchupSegment: {
        role: "Mid",
        focusPlayer: { name: "GEN Mid", team: "GEN", role: "Mid" },
        edgePlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
        opponentPlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
        edgeWinnerTeam: "T1",
        reasons: [
          { metric: "DPM", winnerValue: "trust me", loserValue: "?", delta: "huge" },
          { metric: "KP%", winnerValue: "ahead", loserValue: "behind", delta: "a lot" },
        ],
      },
      proofSegment: {
        player: { name: "GEN Mid", team: "GEN", role: "Mid" },
        proofReasons: [
          { metric: "KP%", rawValue: "84%", score: "elite" },
          { metric: "DPM", rawValue: "720", score: "high" },
        ],
      },
    };

    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(bogusAnalysis, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    assert.equal(renderCalls, 0);
    assert.deepEqual(fs.readdirSync(path.join(dir, "public", "renders")), ["clip.mp4"]);

    await assert.rejects(
      () => createPublishJobs({
        videoUrl: "/renders/clip.mp4",
        analysis: bogusAnalysis,
        platforms: ["instagram"],
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects malformed displayed player radar reasons even when two reasons are valid", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-displayed-reasons-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          reasons: [
            { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 },
            { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
            { metric: "GPM", winnerValue: "ahead", loserValue: "behind", delta: "large" },
          ],
        },
        proofSegment: {
          player: { name: "GEN Mid", team: "GEN", role: "Mid" },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: 90 },
            { metric: "DPM", rawValue: "720", score: 88 },
            { metric: "GPM", rawValue: "trust me", score: 87 },
          ],
        },
      }), {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar .*contains unverifiable displayed/
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects player radar proof charts without verifiable displayed stats", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-chart-stats-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(makeValidPlayerRadarAnalysis({
        proofSegment: {
          player: { name: "GEN Mid", team: "GEN", role: "Mid" },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: 90 },
            { metric: "DPM", rawValue: "720", score: 88 },
          ],
        },
      }), {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar proof segment needs at least 2 verifiable radar stats/
    );

    assert.equal(renderCalls, 0);

    await assert.rejects(
      () => renderVideosFromRequest(makeValidPlayerRadarAnalysis({
        proofSegment: {
          player: {
            name: "GEN Mid",
            team: "GEN",
            role: "Mid",
            radarStats: [
              { label: "KP%", rawValue: "84%", normalizedScore: 90 },
              { label: "DPM", rawValue: "720", normalizedScore: 88 },
              { label: "GPM", rawValue: "trust me", normalizedScore: 87 },
            ],
          },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: 90 },
            { metric: "DPM", rawValue: "720", score: 88 },
          ],
        },
      }), {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar proof segment contains unverifiable displayed radar stats/
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects player radar evidence with incomplete segment identity before rendering", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-identity-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest({
        dataType: "PLAYER_RADAR",
        matchupSegment: {
          role: "Mid",
          edgeType: "winner-breakpoint",
          edgeScore: 360,
          focusPlayer: { name: "GEN Mid", team: "GEN" },
          edgePlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
          opponentPlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
          edgeWinnerTeam: "T1",
          reasons: [
            { metric: "DPM", winnerValue: "720", loserValue: "360", delta: "360" },
            { metric: "KP%", winnerValue: "0.86", loserValue: "0.48", delta: "0.38" },
          ],
        },
        proofSegment: {
          player: { name: "GEN Mid", team: "GEN" },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: "90" },
            { metric: "DPM", rawValue: "720", score: "88" },
          ],
        },
      }, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar .*needs complete player identity/
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects non-string identities and non-scalar numeric evidence", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-type-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          focusPlayer: { name: 123, team: "GEN", role: "Mid" },
          reasons: [
            { metric: "DPM", winnerValue: true, loserValue: false, delta: [1] },
            { metric: "KP%", winnerValue: ["0.86"], loserValue: "0.48", delta: "0.38" },
          ],
        },
        proofSegment: {
          player: { name: "GEN Mid", team: "GEN", role: "Mid" },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: true },
            { metric: "DPM", rawValue: "720", score: [88] },
          ],
        },
      }), {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects bogus player radar proof raw values even with finite scores", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-proof-raw-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(makeValidPlayerRadarAnalysis({
        proofSegment: {
          player: { name: "GEN Mid", team: "GEN", role: "Mid" },
          proofReasons: [
            { metric: "KP%", rawValue: "trust me", score: 90 },
            { metric: "DPM", rawValue: [720], score: 88 },
          ],
        },
      }), {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects semantically malformed player radar matchup and proof evidence", async () => {
  const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
  const cases = [
    {
      name: "missing edge type",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          edgeType: undefined,
        },
      }),
      message: /Player Radar matchup segment needs a valid edge type/,
    },
    {
      name: "invalid edge score",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          edgeScore: -1,
        },
      }),
      message: /Player Radar matchup segment needs a finite nonnegative edge score/,
    },
    {
      name: "duplicate metric",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          reasons: [
            { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 },
            { metric: "DPM", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
          ],
        },
      }),
      message: /Player Radar matchup segment needs unique displayed metrics/,
    },
    {
      name: "inconsistent delta",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          reasons: [
            { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 10 },
            { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
          ],
        },
      }),
      message: /Player Radar matchup segment contains inconsistent displayed deltas/,
    },
    {
      name: "proof reason missing chart stat",
      analysis: makeValidPlayerRadarAnalysis({
        proofSegment: {
          player: {
            name: "GEN Mid",
            team: "GEN",
            role: "Mid",
            radarStats: [
              { label: "KP%", rawValue: "84%", normalizedScore: 90 },
              { label: "DPM", rawValue: "720", normalizedScore: 88 },
            ],
          },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: 90 },
            { metric: "GPM", rawValue: "420", score: 88 },
          ],
        },
      }),
      message: /Player Radar proof segment reasons must match displayed radar stats/,
    },
  ];

  for (const scenario of cases) {
    let renderCalls = 0;
    await assert.rejects(
      () => renderVideosFromRequest(scenario.analysis, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      scenario.message,
      scenario.name
    );
    assert.equal(renderCalls, 0, scenario.name);
  }
});

test("render boundary rejects player radar evidence without source-backed stats and complete context", async () => {
  const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
  const cases = [
    {
      name: "missing match context",
      analysis: makeValidPlayerRadarAnalysis({ matchContext: undefined }),
      message: /Player Radar needs complete match context/,
    },
    {
      name: "top-level player mismatch",
      analysis: makeValidPlayerRadarAnalysis({
        player: { name: "Other Mid", team: "GEN", role: "Mid" },
      }),
      message: /Player Radar top-level player must match proof player/,
    },
    {
      name: "matchup reason mismatches raw stats",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          reasons: [
            { metric: "DPM", winnerValue: 999, loserValue: 100, delta: 899 },
            { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
          ],
        },
      }),
      message: /Player Radar matchup segment reasons must match source stats/,
    },
    {
      name: "unknown matchup metric",
      analysis: makeValidPlayerRadarAnalysis({
        matchupSegment: {
          ...makeValidPlayerRadarAnalysis().matchupSegment,
          reasons: [
            { metric: "Gold Diff", winnerValue: 500, loserValue: 100, delta: 400 },
            { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
          ],
        },
      }),
      message: /Player Radar matchup segment contains unknown displayed metrics/,
    },
    {
      name: "proof score out of range",
      analysis: makeValidPlayerRadarAnalysis({
        proofSegment: {
          player: {
            name: "GEN Mid",
            team: "GEN",
            role: "Mid",
            rawStats: { dpm: 720, kp: 0.84 },
            radarStats: [
              { label: "KP%", rawValue: "84%", normalizedScore: 101 },
              { label: "DPM", rawValue: "720", normalizedScore: 88 },
            ],
          },
          proofReasons: [
            { metric: "KP%", rawValue: "84%", score: 101 },
            { metric: "DPM", rawValue: "720", score: 88 },
          ],
        },
      }),
      message: /Player Radar proof segment scores must be between 0 and 100/,
    },
  ];

  for (const scenario of cases) {
    let renderCalls = 0;
    await assert.rejects(
      () => renderVideosFromRequest(scenario.analysis, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      scenario.message,
      scenario.name
    );
    assert.equal(renderCalls, 0, scenario.name);
  }
});

test("render boundary rejects forged player radar scores even when raw stats match", async () => {
  const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
  const valid = makeValidPlayerRadarAnalysis();
  const forgedProofStats = valid.proofSegment.player.radarStats.map((stat) =>
    stat.label === "KP%" ? { ...stat, normalizedScore: 99 } : stat
  );
  const forgedAnalysis = makeValidPlayerRadarAnalysis({
    matchupSegment: {
      ...valid.matchupSegment,
      edgeScore: 99,
    },
    player: {
      ...valid.player,
      radarStats: forgedProofStats,
    },
    proofSegment: {
      ...valid.proofSegment,
      player: {
        ...valid.proofSegment.player,
        radarStats: forgedProofStats,
      },
      proofReasons: valid.proofSegment.proofReasons.map((reason) =>
        reason.metric === "KP%" ? { ...reason, score: 99 } : reason
      ),
    },
  });
  let renderCalls = 0;

  await assert.rejects(
    () => renderVideosFromRequest(forgedAnalysis, {
      execRenderImpl: async () => {
        renderCalls += 1;
        return null;
      },
    }),
    /Player Radar .*score must match source stats/
  );
  assert.equal(renderCalls, 0);
});

test("player radar evidence rejects forged matchup pair semantics", () => {
  const { assertPlayerRadarEvidence } = require(path.join(ROOT, "utils/esports/playerRadarEvidence.js"));
  const base = makeValidPlayerRadarAnalysis();
  const sameTeamOpponent = {
    name: "T1 Academy Mid",
    team: "T1",
    role: "Mid",
    rawStats: { dpm: 360, kp: 0.48 },
  };
  const otherFocus = {
    name: "GEN Other Mid",
    team: "GEN",
    role: "Mid",
    rawStats: { dpm: 360, kp: 0.48 },
  };

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      matchContext: { ...base.matchContext, winningTeam: "T1" },
      matchupSegment: {
        ...base.matchupSegment,
        edgeType: "winner-breakpoint",
        focusPlayer: base.matchupSegment.edgePlayer,
        opponentPlayer: sameTeamOpponent,
        reasons: [
          { metric: "DPM", winnerValue: 720, loserValue: 360, delta: 360 },
          { metric: "KP%", winnerValue: 0.86, loserValue: 0.48, delta: 0.38 },
        ],
      },
    })),
    /Player Radar matchup segment players must be one opposing pair/
  );

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      matchupSegment: {
        ...base.matchupSegment,
        focusPlayer: otherFocus,
        opponentPlayer: { name: "GEN Mid", team: "GEN", role: "Mid", rawStats: { dpm: 360, kp: 0.48 } },
      },
    })),
    /Player Radar matchup segment players must be one opposing pair/
  );

  assert.throws(
    () => assertPlayerRadarEvidence(makeValidPlayerRadarAnalysis({
      matchupSegment: {
        ...base.matchupSegment,
        edgeType: "winner-breakpoint",
      },
    })),
    /Player Radar matchup edge type must match winning team/
  );
});

test("render boundary validates every localized player radar payload before rendering any locale", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-localized-boundary-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest({
        ...makeValidPlayerRadarAnalysis(),
        renderLanguages: ["zh", "en"],
        localizedPayloads: {
          en: makeValidPlayerRadarAnalysis({
            proofSegment: {
              player: { name: "GEN Mid", team: "GEN", role: "Mid" },
              proofReasons: [
                { metric: "KP%", rawValue: "84%", score: "elite" },
                { metric: "DPM", rawValue: "720", score: "high" },
              ],
            },
          }),
        },
      }, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      PLAYER_RADAR_EVIDENCE_ERROR
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render and publish boundaries reject missing requested player radar localized payloads", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-missing-locale-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip-en.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");
    const analysis = makeValidPlayerRadarAnalysis({
      locale: "zh",
      localizedPayloads: {
        zh: makeValidPlayerRadarAnalysis({ locale: "zh" }),
      },
      renderLanguages: ["zh", "en"],
    });
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest(analysis, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar localized payload missing for locale: en/
    );
    assert.equal(renderCalls, 0);

    await assert.rejects(
      () => createPublishJobs({
        videos: [{ locale: "en", videoUrl: "/renders/clip-en.mp4" }],
        analysis,
        platforms: ["instagram"],
      }),
      /Player Radar localized payload missing for locale: en/
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render boundary rejects localized-only player radar wrappers for missing requested locales", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-localized-only-render-"));
  process.chdir(dir);
  try {
    const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService.js"));
    let renderCalls = 0;

    await assert.rejects(
      () => renderVideosFromRequest({
        renderLanguages: ["zh"],
        localizedPayloads: {
          en: makeValidPlayerRadarAnalysis({ locale: "en" }),
        },
      }, {
        execRenderImpl: async () => {
          renderCalls += 1;
          return null;
        },
      }),
      /Player Radar localized payload missing for locale: zh/
    );

    assert.equal(renderCalls, 0);
    const rendersDir = path.join(dir, "public", "renders");
    assert.deepEqual(fs.existsSync(rendersDir) ? fs.readdirSync(rendersDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("publish boundary rejects localized-only player radar wrappers for missing requested video locales", async () => {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-player-radar-localized-only-publish-missing-"));
  process.chdir(dir);
  try {
    const videoPath = path.join(dir, "public", "renders", "clip-zh.mp4");
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, "fake video", "utf8");
    const { createPublishJobs } = require(path.join(ROOT, "utils/publishing/index.js"));

    await assert.rejects(
      () => createPublishJobs({
        videos: [{ locale: "zh", videoUrl: "/renders/clip-zh.mp4" }],
        analysis: {
          localizedPayloads: {
            en: makeValidPlayerRadarAnalysis({ locale: "en" }),
          },
        },
        platforms: ["instagram"],
      }),
      /Player Radar localized payload missing for locale: zh/
    );

    const queuePath = path.join(dir, ".data", "publish-queue.json");
    const packagesDir = path.join(dir, "public", "publish-packages");
    assert.deepEqual(fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, "utf8")) : [], []);
    assert.deepEqual(fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [], []);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("schema normalization accepts new meta payloads while API guards reject retired ones", () => {
  const { validateAnalyzeRequest, validatePublishRequest } = require(path.join(ROOT, "utils/apiGuards.js"));
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  assert.deepEqual(validateAnalyzeRequest({ dataType: "META_OFFMETA_PICK" }), {
    dataType: "META_OFFMETA_PICK",
  });
  assert.deepEqual(validatePublishRequest({
    analysis: { dataType: "META_TIER_RANKING" },
    platforms: ["instagram", "threads"],
  }), {
    dataType: "META_TIER_RANKING",
    platforms: ["instagram", "threads"],
  });
  assert.throws(() => validateAnalyzeRequest({ dataType: "PRO_BUILD" }), /Unsupported dataType: PRO_BUILD/);
  assert.throws(() => validateAnalyzeRequest({ dataType: "TIER_LIST" }), /Unsupported dataType: TIER_LIST/);

  const offmeta = normalizePipelinePayload({
    dataType: "META_OFFMETA_PICK",
    champion: "Velkoz",
    role: "Support",
    score: "82",
    sampleSize: "18420",
  });
  assert.equal(offmeta.data.dataType, "META_OFFMETA_PICK");
  assert.equal(offmeta.data.score, 82);
  assert.equal(offmeta.data.sampleSize, 18420);

  const tier = normalizePipelinePayload({
    dataType: "META_TIER_RANKING",
    role: "Mid",
    entries: [{ champion: "Azir", rank: 1, tierScore: "88" }],
  });
  assert.equal(tier.data.dataType, "META_TIER_RANKING");
  assert.equal(tier.data.entries[0].tierScore, 88);
});

test("pipeline schema preserves muted and user-supplied audio", () => {
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  assert.equal(normalizePipelinePayload({ dataType: "PATCH" }).data.bgmFile, null);
  assert.equal(normalizePipelinePayload({ dataType: "PATCH", bgmFile: null }).data.bgmFile, null);
  assert.equal(
    normalizePipelinePayload({ dataType: "PATCH", bgmFile: "audio/licensed-by-user.mp3" }).data.bgmFile,
    "audio/licensed-by-user.mp3",
  );
});

test("pipeline schema recovers parseable AI metric strings and drops malformed ones", () => {
  const { normalizePipelinePayload } = require(path.join(ROOT, "src/schemas/pipelineSchemas.js"));

  const normalized = normalizePipelinePayload({
    dataType: "PATCH",
    storyboard: [{
      tag: "SKILL_SHOWCASE",
      metrics: [
        "Passive Mark Damage: 15 -> 20",
        "buffed somehow",
      ],
    }],
  });

  assert.deepEqual(normalized.data.storyboard[0].metrics, [{
    metricName: "Passive Mark Damage",
    beforeValue: "15",
    afterValue: "20",
    trend: "ADJUST",
  }]);
});
