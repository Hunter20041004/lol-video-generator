const test = require("node:test");
const assert = require("node:assert/strict");

function candidate(seriesId, league, score) {
  return {
    seriesId,
    league,
    score,
    teams: [`${league} A`, `${league} B`],
    players: [],
  };
}

test("selectDailySeries keeps one LCK and one LPL series in regular mode unless override gap is reached", () => {
  const { selectDailySeries } = require("../../../utils/esports/matchScorer");

  const result = selectDailySeries([
    candidate("lck-best", "LCK", 91),
    candidate("lck-second", "LCK", 84),
    candidate("lpl-best", "LPL", 76),
  ], {
    activeMode: "regular",
    maxDailySeries: 2,
    regularLeagues: ["LCK", "LPL"],
    regularOverrideThreshold: 15,
  });

  assert.deepEqual(result.map((item) => item.seriesId), ["lck-best", "lpl-best"]);
});

test("selectDailySeries allows a same-league override when the second series clears the configured score gap", () => {
  const { selectDailySeries } = require("../../../utils/esports/matchScorer");

  const result = selectDailySeries([
    candidate("lck-best", "LCK", 94),
    candidate("lck-second", "LCK", 92),
    candidate("lpl-best", "LPL", 70),
  ], {
    activeMode: "regular",
    maxDailySeries: 2,
    regularLeagues: ["LCK", "LPL"],
    regularOverrideThreshold: 15,
  });

  assert.deepEqual(result.map((item) => item.seriesId), ["lck-best", "lck-second"]);
});

test("scoreSeries applies 40/35/25 weights plus configured hot team and player bonuses", () => {
  const { scoreSeries } = require("../../../utils/esports/matchScorer");

  const score = scoreSeries({
    importanceScore: 80,
    trafficScore: 70,
    anomalyScore: 60,
    teams: ["T1", "GEN"],
    players: [{ name: "Faker" }, { name: "Chovy" }],
  }, {
    hotTeams: { T1: 5 },
    hotPlayers: { Faker: 3 },
  });

  assert.equal(score, 71.5 + 8);
});

test("selectDailySeries scopes international modes to the active tournament only", () => {
  const { selectDailySeries } = require("../../../utils/esports/matchScorer");

  const result = selectDailySeries([
    candidate("lck-best", "LCK", 99),
    candidate("msi-best", "MSI", 88),
    candidate("msi-second", "MSI", 81),
  ], {
    activeMode: "msi",
    maxDailySeries: 2,
  });

  assert.deepEqual(result.map((item) => item.seriesId), ["msi-best", "msi-second"]);
});

test("selectDailySeries computes missing scores, clamps daily max, and falls back to configured league fill", () => {
  const { selectDailySeries } = require("../../../utils/esports/matchScorer");

  const oneResult = selectDailySeries([
    {
      seriesId: "computed-score",
      league: "LCK",
      importance: "90",
      traffic: "80",
      anomaly: "70",
      teams: ["T1", "BRO"],
      players: [{ playerName: "Faker" }],
    },
    candidate("lpl-low", "LPL", 40),
  ], {
    activeMode: "regular",
    maxDailySeries: 0,
    regularLeagues: [],
    hotTeams: { T1: "2.5" },
    hotPlayers: { Faker: "1.5" },
  });
  const fillResult = selectDailySeries([
    candidate("lck-only", "LCK", 70),
    candidate("lec-guest", "LEC", 90),
    candidate("lpl-only", "LPL", "bad"),
  ], {
    activeMode: "regular",
    maxDailySeries: 4,
    regularLeagues: ["LCK"],
  });

  assert.deepEqual(oneResult.map((item) => item.seriesId), ["computed-score"]);
  assert.equal(oneResult[0].score, 85.5);
  assert.deepEqual(fillResult.map((item) => item.seriesId), ["lck-only", "lpl-only"]);
});

test("selectDailySeries scopes Worlds mode separately from MSI and regional leagues", () => {
  const { selectDailySeries, scoreSeries } = require("../../../utils/esports/matchScorer");

  const result = selectDailySeries([
    candidate("msi-best", "MSI", 99),
    candidate("worlds-best", "Worlds", 88),
    candidate("lck-best", "LCK", 95),
  ], {
    activeMode: "worlds",
    maxDailySeries: 2,
  });

  assert.deepEqual(result.map((item) => item.seriesId), ["worlds-best"]);
  assert.equal(scoreSeries({ importanceScore: "bad", trafficScore: null, anomalyScore: undefined }, {
    scoringWeights: { importance: 0.4, traffic: 0.35, anomaly: 0.25 },
    hotTeams: { T1: "bad" },
    hotPlayers: {},
  }), 0);
});
