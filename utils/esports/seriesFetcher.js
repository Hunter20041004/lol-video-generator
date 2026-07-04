const leaguepedia = require("../leaguepediaApi");

function normalizeDate(value = "") {
  return String(value || "").slice(0, 10);
}

function getTeams(match = {}) {
  const teamA = match.teamA || match.team1 || match.Team1 || match.matchContext?.teamA || "";
  const teamB = match.teamB || match.team2 || match.Team2 || match.matchContext?.teamB || "";
  return [teamA, teamB];
}

function seriesKey(match = {}) {
  const [teamA, teamB] = getTeams(match);
  return [
    match.matchId || match.MatchId || match.seriesId || "",
    match.tournament || match.Tournament || "",
    normalizeDate(match.dateUtc || match.DateTime_UTC || match.date),
    teamA,
    teamB,
  ].filter(Boolean).join("::");
}

function normalizeGame(detail = {}) {
  const match = detail.match || detail;
  const [teamA, teamB] = getTeams(match);
  return {
    gameId: match.gameId || match.GameId || match.uniqueGame || "",
    seriesId: seriesKey(match),
    date: normalizeDate(match.dateUtc || match.DateTime_UTC || match.date),
    league: match.league || match.matchContext?.league || "",
    tournament: match.tournament || match.Tournament || "",
    teamA,
    teamB,
    winTeam: match.winTeam || match.WinTeam || "",
    gamelengthStr: match.gamelengthStr || match.Gamelength || "",
    gamelengthMin: match.gamelengthMin,
    players: Array.isArray(detail.players) ? detail.players : [],
  };
}

async function fetchCompletedSeriesForDate(options = {}, deps = {}) {
  const date = normalizeDate(options.date || new Date().toISOString());
  const tournaments = options.activeMode?.tournaments || [];
  const fetchRecentMatches = deps.fetchRecentMatches || leaguepedia.fetchRecentMatches;
  const fetchMatchPlayers = deps.fetchMatchPlayers || leaguepedia.fetchMatchPlayers;
  const groups = new Map();

  for (const tournament of tournaments) {
    const matches = await fetchRecentMatches(36, tournament);
    for (const match of matches) {
      const matchDate = normalizeDate(match.dateUtc || match.DateTime_UTC || match.date);
      if (matchDate && date && matchDate !== date) continue;
      const detail = await fetchMatchPlayers(match.gameId || match.GameId || match.uniqueGame);
      if (!detail) continue;
      const game = normalizeGame(detail);
      const key = seriesKey(game);
      if (!groups.has(key)) {
        groups.set(key, {
          seriesId: key,
          date: game.date || date,
          league: game.league,
          tournament: game.tournament,
          teams: [game.teamA, game.teamB],
          teamA: game.teamA,
          teamB: game.teamB,
          games: [],
        });
      }
      groups.get(key).games.push(game);
    }
  }

  return [...groups.values()];
}

module.exports = {
  fetchCompletedSeriesForDate,
  normalizeGame,
  seriesKey,
};
