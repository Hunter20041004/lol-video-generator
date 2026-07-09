const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PLAYER_RADAR_EVIDENCE_ERROR = /Player Radar .*(needs at least 2 verifiable reasons|contains unverifiable displayed)/;

function makeValidPlayerRadarAnalysis(overrides = {}) {
  return {
    dataType: "PLAYER_RADAR",
    matchupSegment: {
      role: "Mid",
      focusPlayer: { name: "GEN Mid", team: "GEN", role: "Mid" },
      edgePlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
      opponentPlayer: { name: "T1 Mid", team: "T1", role: "Mid" },
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
        radarStats: [
          { label: "KP%", rawValue: "84%", normalizedScore: 90 },
          { label: "DPM", rawValue: "720", normalizedScore: 88 },
        ],
      },
      proofReasons: [
        { metric: "KP%", rawValue: "84%", score: 90 },
        { metric: "DPM", rawValue: "720", score: 88 },
      ],
    },
    ...overrides,
  };
}

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
