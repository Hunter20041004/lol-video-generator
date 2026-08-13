const test = require("node:test");
const assert = require("node:assert/strict");

const {
  rankMatchupReasons,
} = require("../../../utils/esports/playerRadarEvidenceRanker");

test("rankMatchupReasons ranks unlike metrics by normalized gap instead of raw delta", () => {
  const reasons = rankMatchupReasons({
    role: "Jungle",
    winner: {
      rawStats: {
        role: "Jungle",
        kda: 13.67,
        dpm: 421,
        kp: 0.78,
        gpm: 410,
        csm: 7.38,
      },
    },
    loser: {
      rawStats: {
        role: "Jungle",
        kda: 0.64,
        dpm: 335,
        kp: 0.52,
        gpm: 350,
        csm: 6.42,
      },
    },
    winnerRadarStats: [
      { label: "KDA", normalizedScore: 98 },
      { label: "DPM", normalizedScore: 67 },
    ],
    loserRadarStats: [
      { label: "KDA", normalizedScore: 20 },
      { label: "DPM", normalizedScore: 55 },
    ],
  });

  assert.equal(reasons[0].metric, "KDA");
  assert.equal(reasons[0].delta, 13.03);
  assert.equal(reasons[0].normalizedGap, 78);
  assert.equal(reasons[1].metric, "DPM");
  assert.equal(reasons[1].delta, 86);
});

test("rankMatchupReasons uses the approved role priority when normalized gaps tie", () => {
  const expectedFirstMetric = {
    Top: "DPM",
    Jungle: "KDA",
    Mid: "DPM",
    Adc: "DPM",
    Support: "KP%",
  };
  const winner = {
    rawStats: { kda: 6, dpm: 600, kp: 0.7, gpm: 450, csm: 8, vpm: 3 },
  };
  const loser = {
    rawStats: { kda: 4, dpm: 500, kp: 0.6, gpm: 400, csm: 7, vpm: 2 },
  };
  const winnerRadarStats = ["KDA", "DPM", "KP%", "GPM", "CSM", "VPM"]
    .map((label) => ({ label, normalizedScore: 70 }));
  const loserRadarStats = ["KDA", "DPM", "KP%", "GPM", "CSM", "VPM"]
    .map((label) => ({ label, normalizedScore: 60 }));

  for (const [role, expected] of Object.entries(expectedFirstMetric)) {
    const reasons = rankMatchupReasons({
      role,
      winner,
      loser,
      winnerRadarStats,
      loserRadarStats,
    });
    assert.equal(reasons[0].metric, expected, role);
  }
});

test("rankMatchupReasons preserves comparable evidence when both radar scores hit the ceiling", () => {
  const reasons = rankMatchupReasons({
    role: "Mid",
    winner: {
      rawStats: { kda: 16, gpm: 675, csm: 12.25 },
    },
    loser: {
      rawStats: { kda: 1.5, gpm: 520, csm: 11 },
    },
    winnerRadarStats: [
      { label: "KDA", normalizedScore: 100 },
      { label: "GPM", normalizedScore: 100 },
      { label: "CSM", normalizedScore: 100 },
    ],
    loserRadarStats: [
      { label: "KDA", normalizedScore: 15 },
      { label: "GPM", normalizedScore: 100 },
      { label: "CSM", normalizedScore: 100 },
    ],
  });

  assert.deepEqual(reasons.map((reason) => reason.metric), ["KDA", "GPM", "CSM"]);
  assert.equal(reasons[1].normalizedGap, 51.67);
  assert.equal(reasons[2].normalizedGap, 12.5);
});
