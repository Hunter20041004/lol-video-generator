const test = require("node:test");
const assert = require("node:assert/strict");

const ROLES = ["Top", "Jungle", "Mid", "Adc", "Support"];

function makePlayer(team, role, name, dpm, kp) {
  return {
    team,
    role,
    name,
    champions: [`${role} Champ`],
    rawStats: {
      role,
      kills: dpm > 500 ? 6 : 2,
      deaths: 2,
      assists: 8,
      kda: dpm > 500 ? 7 : 3,
      dpm,
      gpm: dpm > 500 ? 440 : 360,
      csm: role === "Support" ? 0.7 : 8.5,
      vpm: role === "Support" ? 2.4 : 1.1,
      kp,
    },
    radarStats: [
      { label: "KDA", rawValue: String(dpm > 500 ? 7 : 3), normalizedScore: dpm > 500 ? 80 : 40 },
      { label: "DPM", rawValue: String(dpm), normalizedScore: dpm > 500 ? 78 : 45 },
      { label: "KP%", rawValue: `${Math.round(kp * 100)}%`, normalizedScore: dpm > 500 ? 82 : 50 },
      { label: "GPM", rawValue: String(dpm > 500 ? 440 : 360), normalizedScore: dpm > 500 ? 72 : 52 },
      { label: role === "Support" ? "VPM" : "CSM", rawValue: role === "Support" ? "2.4" : "8.5", normalizedScore: dpm > 500 ? 74 : 48 },
    ],
  };
}

function makeAggregatedSeries() {
  const roleMatchups = ROLES.map((role, index) => ({
    role,
    left: makePlayer("T1", role, `T1 ${role}`, 620 - index * 20, 0.74 - index * 0.02),
    right: makePlayer("GEN", role, `GEN ${role}`, 450 - index * 15, 0.58 - index * 0.01),
  }));
  const players = roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]);
  return {
    seriesId: "lck-t1-gen-2026-06-20",
    league: "LCK",
    tournament: "LCK 2026 Summer",
    date: "2026-06-20",
    teams: ["T1", "GEN"],
    teamA: "T1",
    teamB: "GEN",
    winningTeam: "T1",
    score: "2-0",
    games: 2,
    players,
    roleMatchups,
    teamStats: {
      T1: { kills: 34, damageToChampions: 91000, gold: 118000, visionScore: 250 },
      GEN: { kills: 20, damageToChampions: 70000, gold: 101000, visionScore: 205 },
    },
    completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true, missingRoles: [] },
  };
}

test("planSeriesContent derives zh and en payloads from the same matchup edges and recap points", () => {
  const { planSeriesContent } = require("../../../utils/esports/contentPlanner");

  const plan = planSeriesContent(makeAggregatedSeries());

  assert.equal(plan.semantic.matchupEdges.length, 5);
  assert.equal(plan.semantic.recapPoints.length >= 3, true);
  assert.equal(plan.localized.zh.radar.dataType, "ESPORTS_H2H_RADAR");
  assert.equal(plan.localized.en.recap.dataType, "ESPORTS_MATCH_RECAP");
  assert.deepEqual(plan.localized.zh.radar.matchupEdges, plan.localized.en.radar.matchupEdges);
  assert.deepEqual(
    plan.localized.zh.recap.recapPoints.map((point) => point.id),
    plan.localized.en.recap.recapPoints.map((point) => point.id)
  );
});

test("planSeriesContent marks incomplete data as needs_review and can award right-side edges", () => {
  const { planSeriesContent } = require("../../../utils/esports/contentPlanner");
  const series = makeAggregatedSeries();
  series.completeness = { hasTenPlayers: false, hasFiveRoleMatchups: false, missingRoles: ["Support"] };
  series.roleMatchups[0] = {
    role: "Top",
    left: makePlayer("T1", "Top", "T1 Top", 300, 0.42),
    right: makePlayer("GEN", "Top", "GEN Top", 680, 0.78),
  };

  const plan = planSeriesContent(series);

  assert.equal(plan.semantic.contentConfidence, "needs_review");
  assert.equal(plan.semantic.matchupEdges[0].edgeWinner, "GEN");
  assert.equal(plan.localized.en.radar.roleSegments[0].role, "Top");
});

test("planSeriesContent tolerates sparse matchup data and falls back to team fields", () => {
  const { planSeriesContent, buildMatchupEdges, buildRecapPoints } = require("../../../utils/esports/contentPlanner");
  const series = {
    seriesId: "sparse-series",
    teamA: "AAA",
    teamB: "BBB",
    score: "",
    roleMatchups: [{
      role: "Coach",
      left: {
        team: "AAA",
        name: "AAA Coach",
        role: "Coach",
        champions: "not-array",
        rawStats: { kda: "bad", dpm: 0 },
        radarStats: [],
      },
      right: null,
    }],
    teamStats: {},
    completeness: {},
  };

  const edges = buildMatchupEdges(series);
  const pointsWithoutEdges = buildRecapPoints({ teamA: "AAA", teamB: "BBB" }, []);
  const plan = planSeriesContent(series);

  assert.equal(edges[0].edgeWinner, "AAA");
  assert.deepEqual(edges[0].left.champions, []);
  assert.equal(edges[0].reasons.length, 0);
  assert.equal(pointsWithoutEdges.length, 3);
  assert.deepEqual(plan.semantic.match.teams, ["AAA", "BBB"]);
  assert.equal(plan.semantic.contentConfidence, "needs_review");
  assert.equal(plan.localized.en.radar.roleSegments[0].role, "Coach");
  assert.equal(plan.semantic.recapPoints[1].metric, "radar");
});
