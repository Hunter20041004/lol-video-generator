// Frozen rendering evidence for the approved 2026-08-12 GEN 2-0 HLE design.
// Player and series fields map to Leaguepedia; team finals map to ScoreboardTeams.
// This tracked fixture deliberately replaces runtime .data reads in the preview canary.
const chovy = {
  playerId: "chovy", name: "Chovy", team: "GEN", role: "Mid",
  champions: ["Ryze"], rawStats: { role: "Mid", gpm: 460, dpm: 768 },
};
const zeka = {
  playerId: "zeka", name: "Zeka", team: "HLE", role: "Mid",
  champions: ["Orianna"], rawStats: { role: "Mid", gpm: 388, dpm: 649 },
};
const ruler = {
  playerId: "ruler", name: "Ruler", team: "GEN", role: "Adc",
  champions: ["Caitlyn", "Seraphine"],
  rawStats: { role: "Adc", csm: 9.88, gpm: 473, dpm: 739 },
};

const snapshot = {
  scanId: "canary-gen-hle-2026",
  candidates: [{
    seriesId: "LCK-2026-GEN-HLE-2-0",
    date: "2026-08-12",
    league: "LCK",
    tournament: "LCK 2026",
    teams: ["GEN", "HLE"], teamA: "GEN", teamB: "HLE",
    winningTeam: "GEN", score: "2-0", games: 2,
    players: [chovy, zeka, ruler],
    roleMatchups: [{ role: "Mid", left: chovy, right: zeka }],
    recommendedMvp: { playerId: "ruler", name: "Ruler", team: "GEN", role: "Adc" },
    gameTeamStats: [{
      gameNumber: 1, gameId: "gen-hle-g1", winningTeam: "GEN", hasEventTimestamps: false,
      teams: [
        { team: "HLE", isWinner: false, voidGrubs: 3, riftHeralds: 1, barons: 0, towers: 4, gold: 68114, source: "ScoreboardTeams", snapshotType: "team-final", hasEventTimestamps: false },
        { team: "GEN", isWinner: true, voidGrubs: 0, riftHeralds: 0, barons: 1, towers: 8, gold: 77031, source: "ScoreboardTeams", snapshotType: "team-final", hasEventTimestamps: false },
      ],
    }],
  }],
};

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

module.exports = deepFreeze(snapshot);
