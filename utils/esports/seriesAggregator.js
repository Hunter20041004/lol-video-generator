const ROLE_ORDER = ["Top", "Jungle", "Mid", "Adc", "Support"];

const ROLE_ALIASES = {
  top: "Top",
  toplane: "Top",
  jungle: "Jungle",
  jungler: "Jungle",
  jg: "Jungle",
  mid: "Mid",
  middle: "Mid",
  midlane: "Mid",
  adc: "Adc",
  bot: "Adc",
  bottom: "Adc",
  botlane: "Adc",
  marksman: "Adc",
  support: "Support",
  sup: "Support",
  supp: "Support",
};

const RADAR_BOUNDS = {
  KDA: { min: 0, max: 10 },
  DPM: { min: 200, max: 900 },
  "KP%": { min: 0.35, max: 0.95 },
  GPM: { min: 220, max: 520 },
  CSM: { min: 0, max: 10 },
  VPM: { min: 0, max: 3 },
};

function normalizeRole(role = "") {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_ALIASES[key] || role || "Mid";
}

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function getDurationSeconds(game = {}) {
  if (Number.isFinite(Number(game.durationSeconds))) return Number(game.durationSeconds);
  if (Number.isFinite(Number(game.durationMinutes))) return Number(game.durationMinutes) * 60;
  if (Number.isFinite(Number(game.gamelengthMin))) return Number(game.gamelengthMin) * 60;
  const raw = String(game.gamelengthStr || game.Gamelength || "");
  const match = raw.match(/(\d+)\s*[:m]\s*(\d+)?/i);
  if (match) return Number(match[1]) * 60 + Number(match[2] || 0);
  return 0;
}

function getTeams(game = {}) {
  const teamA = game.teamA || game.team1 || game.Team1 || game.matchContext?.teamA || "";
  const teamB = game.teamB || game.team2 || game.Team2 || game.matchContext?.teamB || "";
  return [teamA, teamB].filter(Boolean);
}

function getTeamKills(players = [], team) {
  return players
    .filter((player) => player.team === team || player.Team === team)
    .reduce((sum, player) => sum + number(player.kills ?? player.Kills ?? player.stats?.kills), 0);
}

function readPlayerStat(player = {}, names = []) {
  for (const name of names) {
    if (player[name] !== undefined) return number(player[name]);
    if (player.stats?.[name] !== undefined) return number(player.stats[name]);
  }
  return 0;
}

function normalizePlayer(player = {}) {
  return {
    name: player.name || player.Name || player.Link || "Unknown",
    team: player.team || player.Team || "",
    role: normalizeRole(player.role || player.Role || ""),
    champion: player.champion || player.Champion || "",
    kills: readPlayerStat(player, ["kills", "Kills"]),
    deaths: readPlayerStat(player, ["deaths", "Deaths"]),
    assists: readPlayerStat(player, ["assists", "Assists"]),
    damageToChampions: readPlayerStat(player, ["damageToChampions", "DamageToChampions", "DamageToChamps"]),
    gold: readPlayerStat(player, ["gold", "Gold"]),
    cs: readPlayerStat(player, ["cs", "CS"]),
    visionScore: readPlayerStat(player, ["visionScore", "VisionScore", "vision"]),
  };
}

function normalizeScore(value, bounds) {
  const clamped = Math.max(bounds.min, Math.min(bounds.max, value));
  return Math.round(((clamped - bounds.min) / (bounds.max - bounds.min)) * 100);
}

function buildRadarStats(rawStats = {}) {
  return [
    ["KDA", rawStats.kda],
    ["DPM", rawStats.dpm],
    ["KP%", rawStats.kp],
    ["GPM", rawStats.gpm],
    [rawStats.role === "Support" ? "VPM" : "CSM", rawStats.role === "Support" ? rawStats.vpm : rawStats.csm],
  ].map(([label, value]) => ({
    label,
    rawValue: label === "KP%" ? `${Math.round(value * 100)}%` : String(value),
    normalizedScore: normalizeScore(value, RADAR_BOUNDS[label] || RADAR_BOUNDS.CSM),
  }));
}

function comparePlayers(a, b) {
  const teamCompare = String(a.team).localeCompare(String(b.team));
  if (teamCompare !== 0) return teamCompare;
  return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
}

function aggregateSeries(gamesInput = []) {
  const games = Array.isArray(gamesInput) ? gamesInput : [];
  if (games.length === 0) {
    throw new Error("aggregateSeries requires at least one game.");
  }

  const first = games[0];
  const teams = getTeams(first);
  const seriesId = first.seriesId || first.matchId || first.MatchId || [first.date, ...teams].filter(Boolean).join("::");
  const playerMap = new Map();
  const teamStats = {};
  const score = {};

  for (const team of teams) {
    teamStats[team] = {
      kills: 0,
      deaths: 0,
      assists: 0,
      damageToChampions: 0,
      gold: 0,
      cs: 0,
      visionScore: 0,
    };
    score[team] = 0;
  }

  for (const game of games) {
    const durationSeconds = getDurationSeconds(game);
    const gamePlayers = (Array.isArray(game.players) ? game.players : []).map(normalizePlayer);
    const perTeamKills = Object.fromEntries(teams.map((team) => [team, getTeamKills(gamePlayers, team)]));
    if (game.winTeam && score[game.winTeam] !== undefined) score[game.winTeam] += 1;

    for (const player of gamePlayers) {
      const key = [player.team, player.role, player.name].join("::");
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: player.name,
          team: player.team,
          role: player.role,
          champions: [],
          totals: {
            kills: 0,
            deaths: 0,
            assists: 0,
            damageToChampions: 0,
            gold: 0,
            cs: 0,
            visionScore: 0,
            durationSeconds: 0,
            teamKills: 0,
          },
        });
      }

      const aggregate = playerMap.get(key);
      if (player.champion) aggregate.champions.push(player.champion);
      aggregate.totals.kills += player.kills;
      aggregate.totals.deaths += player.deaths;
      aggregate.totals.assists += player.assists;
      aggregate.totals.damageToChampions += player.damageToChampions;
      aggregate.totals.gold += player.gold;
      aggregate.totals.cs += player.cs;
      aggregate.totals.visionScore += player.visionScore;
      aggregate.totals.durationSeconds += durationSeconds;
      aggregate.totals.teamKills += perTeamKills[player.team] || 0;

      if (teamStats[player.team]) {
        teamStats[player.team].kills += player.kills;
        teamStats[player.team].deaths += player.deaths;
        teamStats[player.team].assists += player.assists;
        teamStats[player.team].damageToChampions += player.damageToChampions;
        teamStats[player.team].gold += player.gold;
        teamStats[player.team].cs += player.cs;
        teamStats[player.team].visionScore += player.visionScore;
      }
    }
  }

  const players = [...playerMap.values()].map((player) => {
    const minutes = player.totals.durationSeconds / 60 || 1;
    const rawStats = {
      role: player.role,
      kills: player.totals.kills,
      deaths: player.totals.deaths,
      assists: player.totals.assists,
      damageToChampions: player.totals.damageToChampions,
      gold: player.totals.gold,
      cs: player.totals.cs,
      visionScore: player.totals.visionScore,
      kda: player.totals.deaths === 0
        ? player.totals.kills + player.totals.assists
        : round((player.totals.kills + player.totals.assists) / player.totals.deaths, 2),
      dpm: Math.round(player.totals.damageToChampions / minutes),
      gpm: Math.round(player.totals.gold / minutes),
      csm: round(player.totals.cs / minutes, 2),
      vpm: round(player.totals.visionScore / minutes, 2),
      kp: player.totals.teamKills > 0
        ? round((player.totals.kills + player.totals.assists) / player.totals.teamKills, 2)
        : 0,
    };
    return {
      name: player.name,
      team: player.team,
      role: player.role,
      champions: [...new Set(player.champions)],
      rawStats,
      radarStats: buildRadarStats(rawStats),
    };
  }).sort(comparePlayers);

  const roleMatchups = ROLE_ORDER.map((role) => {
    const left = players.find((player) => player.team === teams[0] && player.role === role) || null;
    const right = players.find((player) => player.team === teams[1] && player.role === role) || null;
    return { role, left, right };
  });

  const missingRoles = roleMatchups
    .filter((matchup) => !matchup.left || !matchup.right)
    .map((matchup) => matchup.role);

  return {
    seriesId,
    date: first.date || first.dateUtc || first.DateTime_UTC || "",
    league: first.league || first.matchContext?.league || "",
    tournament: first.tournament || first.Tournament || "",
    teams,
    teamA: teams[0] || "",
    teamB: teams[1] || "",
    winningTeam: Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] || first.winTeam || "",
    score: teams.length >= 2 ? `${score[teams[0]] || 0}-${score[teams[1]] || 0}` : "",
    games: games.length,
    players,
    roleMatchups,
    teamStats,
    completeness: {
      hasTenPlayers: players.length === 10,
      hasFiveRoleMatchups: missingRoles.length === 0,
      missingRoles,
    },
  };
}

module.exports = {
  ROLE_ORDER,
  aggregateSeries,
  buildRadarStats,
  normalizeRole,
};
