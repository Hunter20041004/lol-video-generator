const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

function makeRun(overrides = {}) {
  return {
    seriesId: "lck-t1-gen-2026-06-20",
    status: "RENDERED",
    series: {
      players: Array.from({ length: 10 }, (_, index) => ({ name: `Player ${index + 1}` })),
    },
    semantic: {
      matchupEdges: ["Top", "Jungle", "Mid", "Adc", "Support"].map((role) => ({
        role,
        edgeWinner: "T1",
        edgePlayer: `T1 ${role}`,
      })),
      recapPoints: ["mid pressure", "bot gold", "team damage"].map((summary, index) => ({
        id: `point-${index + 1}`,
        summary,
      })),
    },
    videos: [
      { type: "radar", locale: "zh", videoUrl: "/renders/radar-zh.mp4", exists: true },
      { type: "radar", locale: "en", videoUrl: "/renders/radar-en.mp4", exists: true },
      { type: "recap", locale: "zh", videoUrl: "/renders/recap-zh.mp4", exists: true },
      { type: "recap", locale: "en", videoUrl: "/renders/recap-en.mp4", exists: true },
    ],
    publishReady: true,
    ...overrides,
  };
}

test("evaluateSeriesGate blocks publishing when recap has fewer than three points", () => {
  const { evaluateSeriesGate } = require("../../../utils/esports/gatekeeper");

  const result = evaluateSeriesGate(makeRun({
    semantic: {
      matchupEdges: ["Top", "Jungle", "Mid", "Adc", "Support"].map((role) => ({ role, edgeWinner: "T1" })),
      recapPoints: [{ id: "one" }, { id: "two" }],
    },
  }));

  assert.equal(result.passed, false);
  assert.match(result.reasons.join(" "), /recap/i);
});

test("evaluateSeriesGate blocks publishing when a matchup edge is missing the edge player", () => {
  const { evaluateSeriesGate } = require("../../../utils/esports/gatekeeper");

  const run = makeRun({
    semantic: {
      matchupEdges: [
        { role: "Top", edgeWinner: "T1", edgePlayer: "" },
        ...["Jungle", "Mid", "Adc", "Support"].map((role) => ({ role, edgeWinner: "T1", edgePlayer: `T1 ${role}` })),
      ],
      recapPoints: [{ id: "one" }, { id: "two" }, { id: "three" }],
    },
  });
  const result = evaluateSeriesGate(run);

  assert.equal(result.passed, false);
  assert.match(result.reasons.join(" "), /Top/);
});

test("evaluateSeriesGate reports all hard completeness failures and accepts real local video files", () => {
  const { evaluateSeriesGate, videoExists } = require("../../../utils/esports/gatekeeper");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-esports-gate-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(dir);
    fs.mkdirSync(path.join(dir, "public", "renders"), { recursive: true });
    const filePath = path.join(dir, "public", "renders", "ok.mp4");
    fs.writeFileSync(filePath, "video");

    assert.equal(videoExists({ videoUrl: "/renders/ok.mp4" }), true);
    assert.equal(videoExists({ videoUrl: "https://cdn.example.com/video.mp4" }), false);

    const result = evaluateSeriesGate(makeRun({
      status: "FAILED",
      series: { players: [] },
      semantic: { matchupEdges: [], recapPoints: [] },
      videos: [{ type: "radar", locale: "zh", videoUrl: "/renders/missing.mp4" }],
      publishReady: false,
    }));

    assert.equal(result.passed, false);
    assert.match(result.reasons.join(" "), /render status/);
    assert.match(result.reasons.join(" "), /expected 10 players/);
    assert.match(result.reasons.join(" "), /missing localized videos/);
    assert.match(result.reasons.join(" "), /missing video files/);
    assert.match(result.reasons.join(" "), /publish jobs/);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("videoExists supports explicit file paths and rejects empty or missing relative URLs", () => {
  const { videoExists, evaluateSeriesGate } = require("../../../utils/esports/gatekeeper");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-esports-gate-file-"));
  try {
    const filePath = path.join(dir, "video.mp4");
    fs.writeFileSync(filePath, "video");

    assert.equal(videoExists({ filePath }), true);
    assert.equal(videoExists({}), false);
    assert.equal(videoExists({ videoUrl: "renders/not-found.mp4" }), false);
    assert.equal(videoExists({ exists: true, videoUrl: "" }), true);

    const result = evaluateSeriesGate(makeRun({
      status: "READY",
      semantic: undefined,
      matchupEdges: ["Top", "Jungle", "Mid", "Adc", "Support"].map((role) => ({
        role,
        edgeWinner: "T1",
        edgePlayer: `T1 ${role}`,
      })),
      recapPoints: [{ id: "one" }, { id: "two" }, { id: "three" }],
      videos: [
        { type: "radar", locale: "zh", filePath },
        { type: "radar", locale: "en", exists: true },
        { type: "recap", locale: "zh", exists: true },
        { type: "recap", locale: "en", exists: true },
      ],
    }));

    assert.equal(result.passed, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
