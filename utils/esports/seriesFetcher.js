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
  const [teamA, teamB] = getTeams(match)
    .map((team) => String(team || "").trim())
    .sort((left, right) => left.localeCompare(right));
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
    teamFinalStats: Array.isArray(detail.teamFinalStats) ? detail.teamFinalStats : [],
  };
}

async function fetchCompletedSeriesForDate(options = {}, deps = {}) {
  const date = normalizeDate(options.date || new Date().toISOString());
  const tournaments = options.activeMode?.tournaments || [];
  const fetchRecentMatches = deps.fetchRecentMatches || leaguepedia.fetchRecentMatches;
  const fetchMatchesForDate = deps.fetchMatchesForDate
    || (deps.fetchRecentMatches ? ((selectedDate, tournament) => fetchRecentMatches(36, tournament)) : leaguepedia.fetchMatchesForDate)
    || ((selectedDate, tournament) => fetchRecentMatches(36, tournament));
  const fetchMatchPlayers = deps.fetchMatchPlayers || leaguepedia.fetchMatchPlayers;
  const fetchMatchTeamStats = deps.fetchMatchTeamStats || leaguepedia.fetchMatchTeamStats;
  const groups = new Map();

  for (const tournament of tournaments) {
    const matches = await fetchMatchesForDate(date, tournament);
    for (const match of matches) {
      const matchDate = normalizeDate(match.dateUtc || match.DateTime_UTC || match.date);
      if (matchDate && date && matchDate !== date) continue;
      const gameId = match.gameId || match.GameId || match.uniqueGame;
      const detail = await fetchMatchPlayers(gameId);
      if (!detail) continue;
      const teamFinalStats = await fetchMatchTeamStats(gameId);
      const game = normalizeGame({ ...detail, teamFinalStats });
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
