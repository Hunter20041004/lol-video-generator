const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertNoPreciseEventNarrative,
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
      reasons: [{ metric: "KDA", winnerValue: 13.67, loserValue: 0.64, delta: 13.03 }],
    },
    proofSegment: {
      player: proofPlayer,
      proofReasons: [{ metric: "DPM", rawValue: "806" }],
    },
    selection: {},
    locale: "zh",
  };
}

test("post-match read storyboard is exactly five beats and 750 frames", () => {
  const viewModel = buildPostMatchReadViewModel(makeInput());

  assert.deepEqual(viewModel.storyboard.map(({ tag, durationInFrames }) => [tag, durationInFrames]), [
    ["RESULT_HOOK", 120],
    ["MATCHUP_EDGE", 150],
    ["GAME_FLOW", 240],
    ["PLAYER_PROOF", 150],
    ["FINAL_READ", 90],
  ]);
  assert.equal(viewModel.storyboard.reduce((sum, scene) => sum + scene.durationInFrames, 0), 750);
});

test("post-match read carries the series date into asset identity context", () => {
  const input = makeInput();
  input.series.date = "2026-08-27";

  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.seriesContext.matchDate, "2026-08-27");
  assert.equal(viewModel.seriesContext.season, "2026");
});

test("post-match read preserves canonical team names beside short display labels", () => {
  const input = makeInput();
  input.series.teamA = "BNK FEARX";
  input.series.teamB = "Nongshim RedForce";

  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.seriesContext.teamA, "BF");
  assert.equal(viewModel.seriesContext.teamB, "NR");
  assert.equal(viewModel.seriesContext.teamAIdentity, "BNK FEARX");
  assert.equal(viewModel.seriesContext.teamBIdentity, "Nongshim RedForce");
});

test("Mid matchup copy is role-aware and exposes its primary evidence", () => {
  const input = makeInput();
  const edgePlayer = { name: "Chovy", team: "GEN", role: "Mid" };
  const opponentPlayer = { name: "Zeka", team: "HLE", role: "Mid" };
  input.matchupSegment = {
    role: "Mid",
    edgePlayer,
    focusPlayer: edgePlayer,
    opponentPlayer,
    reasons: [
      { metric: "GPM", winnerValue: 460, loserValue: 388, delta: 72 },
      { metric: "DPM", winnerValue: 768, loserValue: 649, delta: 119 },
    ],
  };

  const model = buildPostMatchReadViewModel(input);

  assert.equal(model.matchup.role, "Mid");
  assert.equal(model.matchup.primaryEvidence.displayValue, "+72 GPM");
  assert.equal(model.matchup.claim, "不是一波打贏。是每分鐘都在擴大差距。");
  assert.doesNotMatch(JSON.stringify(model), /打野拉開|下路把優勢/);
});

test("game flow is derived from two ScoreboardTeams final records", () => {
  const input = makeInput();
  input.series.teamA = "GEN";
  input.series.teamB = "HLE";
  input.series.winningTeam = "GEN";
  input.series.gameTeamStats = [{
    gameNumber: 1,
    gameId: "gen-hle-g1",
    winningTeam: "GEN",
    hasEventTimestamps: false,
    teams: [
      { team: "HLE", voidGrubs: 3, riftHeralds: 1, barons: 0, towers: 4, gold: 68114, source: "ScoreboardTeams", snapshotType: "team-final" },
      { team: "GEN", voidGrubs: 0, riftHeralds: 0, barons: 1, towers: 8, gold: 77031, source: "ScoreboardTeams", snapshotType: "team-final" },
    ],
  }];

  const model = buildPostMatchReadViewModel(input);

  assert.deepEqual(model.gameFlow, {
    gameNumber: 1,
    gameId: "gen-hle-g1",
    earlyResourceTeam: "HLE",
    finalMapTeam: "GEN",
    earlyResources: { voidGrubs: 3, riftHeralds: 1, displayValue: "3＋1" },
    conversion: { barons: 1, towers: 8, displayValue: "1 → 8" },
    goldDelta: 8917,
    towerScore: "8–4",
    teamFinals: input.series.gameTeamStats[0].teams,
    analysisClaim: "HLE 拿到前期資源，GEN 最後拿走地圖。",
    conclusion: "物件本身不是勝點，物件之後換到幾座塔才是。",
    claimBasis: {
      source: "ScoreboardTeams",
      snapshotType: "team-final",
      fields: ["VoidGrubs", "RiftHeralds", "Barons", "Towers", "Gold"],
      hasEventTimestamps: false,
    },
  });
});

test("team-final narratives reject precise event time and route claims", () => {
  assert.throws(
    () => assertNoPreciseEventNarrative("18:00 巴龍團後 → 上路推進"),
    /event timestamp or precise path/i,
  );
});

test("result hook splits the score and final read only recaps displayed evidence", () => {
  const input = makeInput();
  input.series.teamA = "GEN";
  input.series.teamB = "HLE";
  input.series.winningTeam = "GEN";
  input.matchupSegment.reasons[0] = {
    metric: "GPM", winnerValue: 460, loserValue: 388, delta: 72,
  };
  input.proofSegment.player = {
    name: "Ruler",
    team: "GEN",
    role: "Adc",
    rawStats: { role: "Adc", csm: 9.88, gpm: 473, dpm: 739 },
  };

  const model = buildPostMatchReadViewModel(input);

  assert.deepEqual(model.resultHook.scoreParts, { left: "2", separator: "–", right: "0" });
  assert.equal(model.finalRead.conclusion, "GEN 的勝點不是搶得多，而是把每次領先換成塔與輸出。");
  assert.deepEqual(model.finalRead.recapReferences, [
    { source: "matchup", metric: "GPM", displayValue: "+72 GPM" },
    { source: "proof", metric: "CSM", displayValue: "9.88 CSM" },
  ]);
});

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

test("public matchup names omit parenthetical real names", () => {
  const input = makeInput();
  input.matchupSegment.edgePlayer.name = "Jackal (Lee Su-min)";
  input.matchupSegment.focusPlayer.name = "Jackal (Lee Su-min)";

  const viewModel = buildPostMatchReadViewModel(input);

  assert.equal(viewModel.matchup.edgePlayer.name, "Jackal");
  assert.equal(viewModel.matchup.focusPlayer.name, "Jackal");
});

test("proof identity separates the public handle from the original name", () => {
  const input = makeInput();
  input.proofSegment.player.name = "Taeyoon (Kim Tae-yoon)";
  input.series.recommendedMvp.name = "Taeyoon (Kim Tae-yoon)";

  const model = buildPostMatchReadViewModel(input);

  assert.equal(model.proof.player.name, "Taeyoon");
  assert.equal(model.proof.player.originalName, "Kim Tae-yoon");
  assert.equal(model.proof.claim, "數據 MVP 候選: Taeyoon");
});
