const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRatioHook,
  buildPostMatchReadViewModel,
} = require("../../../utils/esports/postMatchReadBuilder");

function makeRoleMatchup(role) {
  return {
    role,
    left: { name: `T1 ${role}`, team: "T1", role },
    right: { name: `GEN ${role}`, team: "GEN", role },
  };
}

function makeInput() {
  const edgePlayer = { name: "T1 Jungle", team: "T1", role: "Jungle" };
  const opponentPlayer = { name: "GEN Jungle", team: "GEN", role: "Jungle" };
  const proofPlayer = { name: "T1 Adc", team: "T1", role: "Adc" };
  return {
    series: {
      league: "LCK",
      seriesId: "t1-gen",
      teamA: "T1",
      teamB: "GEN",
      score: "2-0",
      games: [{}, {}],
      roleMatchups: ["Top", "Jungle", "Mid", "Adc"].map(makeRoleMatchup),
      recommendedMvp: { name: "T1 Adc" },
    },
    matchupSegment: {
      role: "Jungle",
      edgePlayer,
      focusPlayer: edgePlayer,
      opponentPlayer,
      reasons: [{ metric: "KDA", winnerValue: 13.67, loserValue: 0.64 }],
    },
    proofSegment: {
      player: proofPlayer,
      proofReasons: [{ metric: "DPM", rawValue: "806" }],
    },
    selection: {},
    locale: "zh",
  };
}

test("incomplete role coverage cannot claim the selected matchup is the series maximum", () => {
  const viewModel = buildPostMatchReadViewModel(makeInput());

  assert.equal(viewModel.matchup.hasAllFiveRoles, false);
  assert.equal(viewModel.matchup.claimScope, "role-local");
  assert.doesNotMatch(viewModel.matchup.claim, /最大|biggest/i);
});

test("a recommended player is labeled as a data MVP candidate, never an official MVP", () => {
  const input = makeInput();
  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.proof.labelType, "data-mvp-candidate");
  assert.equal(viewModel.proof.label, "數據 MVP 候選");
  assert.doesNotMatch(viewModel.proof.claim, /官方/);
});

test("only a source-backed official MVP receives the official MVP label", () => {
  const input = makeInput();
  input.series.officialMvp = { name: "T1 Adc" };

  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.proof.labelType, "official-mvp");
  assert.equal(viewModel.proof.label, "官方 MVP");
});

test("a large positive comparison is presented as an approximate rounded ratio", () => {
  const hook = buildRatioHook({ metric: "KDA", winnerValue: 13.67, loserValue: 0.64 }, "zh");

  assert.equal(hook.displayValue, "約 21×");
  assert.equal(hook.comparisonType, "ratio");
  assert.equal(hook.approximate, true);
});

test("a zero denominator stays side by side and never produces a fake multiplier", () => {
  const hook = buildRatioHook({ metric: "KDA", winnerValue: 5, loserValue: 0 }, "zh");

  assert.equal(hook.comparisonType, "side-by-side");
  assert.doesNotMatch(hook.displayValue, /∞|×/);
});

test("series context derives short labels from the fallback teams array", () => {
  const input = makeInput();
  delete input.series.teamA;
  delete input.series.teamB;
  input.series.teams = ["Bilibili Gaming Esports", "Gen Challengers"];

  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.seriesContext.teamA, "BG");
  assert.equal(viewModel.seriesContext.teamB, "GEN");
});
