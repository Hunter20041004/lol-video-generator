const { ROLE_ORDER } = require("./seriesAggregator");

function makeSamplePlayer(team, role, score, side) {
  const stronger = score >= 70;
  return {
    team,
    role,
    name: `${team} ${role}`,
    champions: [`${role} Champion ${side}`],
    rawStats: {
      role,
      kills: stronger ? 6 : 2,
      deaths: stronger ? 2 : 4,
      assists: stronger ? 9 : 5,
      damageToChampions: stronger ? 36000 : 24000,
      gold: stronger ? 26000 : 21800,
      cs: role === "Support" ? 42 : stronger ? 520 : 470,
      visionScore: role === "Support" ? (stronger ? 152 : 118) : stronger ? 76 : 61,
      kda: stronger ? 7.5 : 1.75,
      dpm: stronger ? 640 : 430,
      gpm: stronger ? 462 : 388,
      csm: role === "Support" ? 0.7 : stronger ? 9.2 : 8.1,
      vpm: role === "Support" ? (stronger ? 2.55 : 1.95) : stronger ? 1.27 : 1.01,
      kp: stronger ? 0.75 : 0.52,
    },
    radarStats: [
      { label: "KDA", rawValue: stronger ? "7.5" : "1.75", normalizedScore: stronger ? score : 44 },
      { label: "DPM", rawValue: stronger ? "640" : "430", normalizedScore: stronger ? score - 2 : 48 },
      { label: "KP%", rawValue: stronger ? "75%" : "52%", normalizedScore: stronger ? score + 1 : 50 },
      { label: "GPM", rawValue: stronger ? "462" : "388", normalizedScore: stronger ? score - 5 : 52 },
      { label: role === "Support" ? "VPM" : "CSM", rawValue: role === "Support" ? "2.55" : "9.2", normalizedScore: stronger ? score - 4 : 49 },
    ],
  };
}

function makeSampleAggregatedSeries(overrides = {}) {
  const roleMatchups = ROLE_ORDER.map((role, index) => ({
    role,
    left: makeSamplePlayer("T1", role, 84 - index, "A"),
    right: makeSamplePlayer("GEN", role, 48 + index, "B"),
  }));

  return {
    seriesId: "sample-lck-t1-gen-2026-06-20",
    date: "2026-06-20",
    league: "LCK",
    tournament: "LCK 2026 Summer",
    teams: ["T1", "GEN"],
    teamA: "T1",
    teamB: "GEN",
    winningTeam: "T1",
    seriesScore: "2-0",
    scoreLabel: "2-0",
    selectionScore: 92,
    importanceScore: 85,
    trafficScore: 90,
    anomalyScore: 78,
    games: 2,
    players: roleMatchups.flatMap((matchup) => [matchup.left, matchup.right]),
    roleMatchups,
    teamStats: {
      T1: { kills: 36, deaths: 18, assists: 71, damageToChampions: 180000, gold: 130000, cs: 2122, visionScore: 456 },
      GEN: { kills: 21, deaths: 36, assists: 42, damageToChampions: 121000, gold: 109000, cs: 1922, visionScore: 377 },
    },
    completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true, missingRoles: [] },
    ...overrides,
  };
}

async function fetchSampleSeriesCandidates() {
  return [makeSampleAggregatedSeries()];
}

module.exports = {
  makeSampleAggregatedSeries,
  fetchSampleSeriesCandidates,
};
